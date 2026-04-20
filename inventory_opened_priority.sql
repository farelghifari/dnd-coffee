-- 1. Update the sales FIFO function to prioritize "Opened" batches
-- This ensures that system always empties an open container before opening a new one.
CREATE OR REPLACE FUNCTION public.process_menu_sales_fifo(
    p_menu_id UUID,
    p_quantity INT,
    p_price NUMERIC,
    p_actor_name TEXT,
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    r_item RECORD;
    v_total_needed NUMERIC;
    v_current_batch RECORD;
    v_batch_deduct NUMERIC;
    v_order_id TEXT;
BEGIN
    v_order_id := 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    IF p_quantity > 0 THEN
        INSERT INTO public.sales_logs (menu_id, quantity, total_price, created_at)
        VALUES (p_menu_id, p_quantity, p_price, NOW());
    END IF;

    FOR r_item IN (
        SELECT inventory_item_id as item_id, quantity, unit 
        FROM public.menu_recipes 
        WHERE menu_item_id = p_menu_id
    ) LOOP
        v_total_needed := r_item.quantity * p_quantity;

        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = r_item.item_id 
              AND remaining_quantity > 0
            -- ORDER: 1. Opened First, 2. FEFO (Expired First), 3. FIFO (Created First)
            ORDER BY is_opened DESC, expired_date ASC NULLS LAST, created_at ASC
        ) LOOP
            IF v_total_needed <= 0 THEN
                EXIT;
            END IF;

            IF v_current_batch.remaining_quantity >= v_total_needed THEN
                v_batch_deduct := v_total_needed;
            ELSE
                v_batch_deduct := v_current_batch.remaining_quantity;
            END IF;

            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity - v_batch_deduct,
                updated_at = NOW()
            WHERE id = v_current_batch.id;

            v_total_needed := v_total_needed - v_batch_deduct;
        END LOOP;

        UPDATE public.inventory_items
        SET stock = stock - (r_item.quantity * p_quantity),
            last_updated = NOW()
        WHERE id = r_item.item_id;

        IF (r_item.quantity * p_quantity) > 0 THEN
             INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
             VALUES (r_item.item_id, p_actor_id, 'out', r_item.quantity * p_quantity, p_actor_name, NOW());
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. REFACTOR Manual Stock Out to correctly deduct from batches
-- This ensures manual usage logs (waste, damage, etc) actually reduce the batch totals.
CREATE OR REPLACE FUNCTION public.stock_out_manual(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT,
    p_actor_name TEXT DEFAULT 'System',
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_total_needed NUMERIC;
    v_current_batch RECORD;
    v_batch_deduct NUMERIC;
    v_old_batch RECORD;
BEGIN
    -- 1. AUTO-WASTE: Check for any existing opened batch that still has stock
    -- If we are opening a new batch manually, the old one must be discarded.
    FOR v_old_batch IN (
        SELECT id, remaining_quantity 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id 
          AND is_opened = true 
          AND remaining_quantity > 0
    ) LOOP
        -- Record the waste transaction
        INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
        VALUES (p_item_id, p_actor_id, 'waste', v_old_batch.remaining_quantity, p_actor_name, NOW());

        -- Update master stock to subtract the waste
        UPDATE public.inventory_items
        SET stock = stock - v_old_batch.remaining_quantity,
            last_updated = NOW()
        WHERE id = p_item_id;

        -- Close the old batch
        UPDATE public.inventory_batches
        SET remaining_quantity = 0,
            is_opened = false,
            updated_at = NOW()
        WHERE id = v_old_batch.id;
    END LOOP;

    -- 2. PROCESS NEW STOCK OUT
    v_total_needed := p_quantity;

    -- Update batches using FEFO/FIFO logic (excluding the one we just wasted)
    FOR v_current_batch IN (
        SELECT id, remaining_quantity 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id 
          AND remaining_quantity > 0
          AND is_opened = false -- Prioritize the NEXT sealed one
        ORDER BY expired_date ASC NULLS LAST, created_at ASC
    ) LOOP
        IF v_total_needed <= 0 THEN
            EXIT;
        END IF;

        IF v_current_batch.remaining_quantity >= v_total_needed THEN
            v_batch_deduct := v_total_needed;
        ELSE
            v_batch_deduct := v_current_batch.remaining_quantity;
        END IF;

        UPDATE public.inventory_batches
        SET remaining_quantity = remaining_quantity - v_batch_deduct,
            is_opened = true, -- Mark the new batch as opened
            updated_at = NOW()
        WHERE id = v_current_batch.id;

        v_total_needed := v_total_needed - v_batch_deduct;
    END LOOP;

    -- Update master stock for the actual usage
    UPDATE public.inventory_items
    SET stock = stock - p_quantity,
        last_updated = NOW()
    WHERE id = p_item_id;

    -- Record transaction for the actual stock out
    INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
    VALUES (p_item_id, p_actor_id, 'out', p_quantity, p_actor_name, NOW());
END;
$$ LANGUAGE plpgsql;

-- 3. BULK version of the FIFO Sales logic
-- This matches the frontend bulkSellMenu function
CREATE OR REPLACE FUNCTION public.bulk_sell_menu_fifo(
    p_menu_ids UUID[],
    p_quantities INT[],
    p_actor_name TEXT DEFAULT 'System',
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..array_length(p_menu_ids, 1) LOOP
        PERFORM public.process_menu_sales_fifo(
            p_menu_ids[i],
            p_quantities[i],
            0, -- Price handled by sales_logs in the individual call
            p_actor_name,
            p_actor_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. STOCK OPNAME ADJUSTMENT Logic
-- This ensures that when an audit is performed, batches are synchronized.
CREATE OR REPLACE FUNCTION public.adjust_stock_from_opname(
    p_item_id UUID,
    p_difference NUMERIC,
    p_actor_name TEXT DEFAULT 'System',
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_remaining_diff NUMERIC;
    v_current_batch RECORD;
    v_batch_adj NUMERIC;
    v_opened_batch_id UUID;
BEGIN
    v_remaining_diff := p_difference;

    IF v_remaining_diff < 0 THEN
        -- LOSS (Waste): Deduct from batches, prioritizing Opened then FEFO
        v_remaining_diff := ABS(v_remaining_diff);
        
        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = p_item_id 
              AND remaining_quantity > 0
            ORDER BY is_opened DESC, expired_date ASC NULLS LAST, created_at ASC
        ) LOOP
            IF v_remaining_diff <= 0 THEN EXIT; END IF;

            IF v_current_batch.remaining_quantity >= v_remaining_diff THEN
                v_batch_adj := v_remaining_diff;
            ELSE
                v_batch_adj := v_current_batch.remaining_quantity;
            END IF;

            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity - v_batch_adj,
                updated_at = NOW()
            WHERE id = v_current_batch.id;

            v_remaining_diff := v_remaining_diff - v_batch_adj;
        END LOOP;

    ELSIF v_remaining_diff > 0 THEN
        -- GAIN (Found Stock): Add to the currently opened batch, or the newest one
        SELECT id INTO v_opened_batch_id 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id AND is_opened = true
        LIMIT 1;

        IF v_opened_batch_id IS NOT NULL THEN
            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity + v_remaining_diff,
                updated_at = NOW()
            WHERE id = v_opened_batch_id;
        ELSE
            -- No open batch? Add to the newest batch
            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity + v_remaining_diff,
                updated_at = NOW()
            WHERE id = (
                SELECT id FROM public.inventory_batches 
                WHERE item_id = p_item_id 
                ORDER BY created_at DESC LIMIT 1
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. SELF-HEALING: Repair items missing batches
-- This ensures that your 24 items in inventory are matched in Batch Tracking.
DO $$
DECLARE
    r_missing RECORD;
    v_batch_number TEXT;
BEGIN
    FOR r_missing IN (
        SELECT i.id, i.name, i.category, i.stock, i.unit_cost, i.supplier_name
        FROM public.inventory_items i
        LEFT JOIN public.inventory_batches b ON i.id = b.item_id
        WHERE b.id IS NULL AND i.stock > 0
    ) LOOP
        -- Generate batch number: AUTO-FIX-YYYYMMDD-SEQ
        v_batch_number := 'FIX-' || UPPER(LEFT(r_missing.name, 3)) || '-' || TO_CHAR(NOW(), 'YYYYMMDD');

        INSERT INTO public.inventory_batches (
            item_id,
            batch_number,
            quantity,
            remaining_quantity,
            cost_per_unit,
            supplier_name,
            received_date,
            is_opened,
            opened_at,
            created_at
        )
        VALUES (
            r_missing.id,
            v_batch_number,
            r_missing.stock,
            r_missing.stock,
            r_missing.unit_cost,
            r_missing.supplier_name,
            CURRENT_DATE,
            TRUE, -- Since it's the only batch, mark it as opened
            NOW(),
            NOW()
        );
    END LOOP;
END $$;
