-- Migration: Inventory Simplification
-- 1. Reset all batches to 'warehouse' location
UPDATE inventory_batches SET location = 'warehouse';

-- 2. Update process_menu_sales_fifo to remove 'floor' restriction and sync master stock
CREATE OR REPLACE FUNCTION process_menu_sales_fifo(
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
BEGIN
    -- Log sales log
    IF p_quantity > 0 THEN
        INSERT INTO public.sales_logs (menu_id, quantity, total_price, created_at)
        VALUES (p_menu_id, p_quantity, p_price, NOW());
    END IF;

    -- Find recipe items
    FOR r_item IN (
        SELECT inventory_item_id as item_id, quantity 
        FROM public.menu_recipes 
        WHERE menu_item_id = p_menu_id
    ) LOOP
        v_total_needed := r_item.quantity * p_quantity;

        -- Look for ANY batches (FIFO: oldest first)
        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = r_item.item_id 
              AND remaining_quantity > 0
            ORDER BY received_date ASC, created_at ASC
        ) LOOP
            IF v_total_needed <= 0 THEN
                EXIT;
            END IF;

            IF v_current_batch.remaining_quantity >= v_total_needed THEN
                v_batch_deduct := v_total_needed;
            ELSE
                v_batch_deduct := v_current_batch.remaining_quantity;
            END IF;

            -- Deduct from batch
            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity - v_batch_deduct,
                updated_at = NOW()
            WHERE id = v_current_batch.id;
            
            -- Deduct from master stock
            UPDATE public.inventory_items
            SET stock = stock - v_batch_deduct,
                updated_at = NOW()
            WHERE id = r_item.item_id;

            v_total_needed := v_total_needed - v_batch_deduct;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a helper function for automatic waste deduction (FIFO)
CREATE OR REPLACE FUNCTION deduct_inventory_fifo(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_type TEXT, -- 'waste' or 'out'
    p_notes TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT 'System'
) RETURNS VOID AS $$
DECLARE
    v_remaining_to_deduct NUMERIC := p_quantity;
    v_current_batch RECORD;
    v_batch_deduct NUMERIC;
BEGIN
    FOR v_current_batch IN (
        SELECT id, remaining_quantity, batch_number 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id 
          AND remaining_quantity > 0
        ORDER BY received_date ASC, created_at ASC
    ) LOOP
        IF v_remaining_to_deduct <= 0 THEN
            EXIT;
        END IF;

        IF v_current_batch.remaining_quantity >= v_remaining_to_deduct THEN
            v_batch_deduct := v_remaining_to_deduct;
        ELSE
            v_batch_deduct := v_current_batch.remaining_quantity;
        END IF;

        -- Deduct from batch
        UPDATE public.inventory_batches
        SET remaining_quantity = remaining_quantity - v_batch_deduct,
            updated_at = NOW()
        WHERE id = v_current_batch.id;
        
        -- Deduct from master stock
        UPDATE public.inventory_items
        SET stock = stock - v_batch_deduct,
            updated_at = NOW()
        WHERE id = p_item_id;

        -- Record transaction log for this specific deduction
        INSERT INTO public.inventory_transactions (
            item_id,
            type,
            quantity,
            actor_name,
            waste_reason,
            created_at
        )
        VALUES (
            p_item_id,
            p_type,
            v_batch_deduct,
            p_actor_name,
            COALESCE(p_notes, '') || ' (Batch: ' || v_current_batch.batch_number || ')',
            NOW()
        );

        v_remaining_to_deduct := v_remaining_to_deduct - v_batch_deduct;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Fungsi untuk memproses Stock Opname secara akurat (Atomic)
CREATE OR REPLACE FUNCTION public.process_inventory_opname(
    p_item_id UUID,
    p_theoretical_stock DECIMAL,
    p_actual_stock DECIMAL,
    p_difference DECIMAL,
    p_reason TEXT,
    p_actor_name TEXT
) RETURNS VOID AS $$
DECLARE
    v_batch_id UUID;
    v_remaining DECIMAL := ABS(p_difference);
    v_deduct DECIMAL;
    v_timestamp TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Catat record opname
    INSERT INTO public.inventory_opname (
        item_id, theoretical_stock, actual_stock, difference, reason, actor_name, created_at
    ) VALUES (
        p_item_id, p_theoretical_stock, p_actual_stock, p_difference, p_reason, p_actor_name, v_timestamp
    );

    -- 2. Update stok utama
    UPDATE public.inventory_items 
    SET stock = p_actual_stock, updated_at = v_timestamp 
    WHERE id = p_item_id;

    -- 3. Sesuaikan Batch
    IF p_difference < 0 THEN
        -- Kasus Stok Berkurang (Waste/Shrinkage): Potong dari batch tertua (FIFO)
        FOR v_batch_id IN 
            SELECT id FROM public.inventory_batches 
            WHERE item_id = p_item_id AND remaining_quantity > 0 
            ORDER BY received_date ASC, created_at ASC
        LOOP
            IF v_remaining <= 0 THEN EXIT; END IF;

            SELECT LEAST(remaining_quantity, v_remaining) INTO v_deduct
            FROM public.inventory_batches WHERE id = v_batch_id;

            UPDATE public.inventory_batches 
            SET remaining_quantity = remaining_quantity - v_deduct,
                updated_at = v_timestamp
            WHERE id = v_batch_id;

            v_remaining := v_remaining - v_deduct;
        END LOOP;
    ELSIF p_difference > 0 THEN
        -- Kasus Stok Bertambah: Tambahkan batch penyesuaian baru
        INSERT INTO public.inventory_batches (
            item_id, batch_number, quantity, remaining_quantity, location, notes, received_date, created_at
        ) VALUES (
            p_item_id, 
            'ADJ-' || to_char(v_timestamp, 'YYYYMMDD-HH24MI'), 
            p_difference, 
            p_difference, 
            'warehouse', 
            'Opname Adjustment: ' || COALESCE(p_reason, 'Found extra stock'),
            v_timestamp::DATE,
            v_timestamp
        );
    END IF;

    -- 4. Catat ke log pergerakan stok (Movement Record)
    IF p_difference <> 0 THEN
        INSERT INTO public.inventory_transactions (
            item_id, type, quantity, actor_name, waste_reason, created_at
        ) VALUES (
            p_item_id, 
            CASE WHEN p_difference < 0 THEN 'waste' ELSE 'in' END,
            ABS(p_difference),
            p_actor_name,
            'Opname: ' || COALESCE(p_reason, ''),
            v_timestamp
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
