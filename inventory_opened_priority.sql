-- ==========================================================
-- FINAL INVENTORY SYNC: WAREHOUSE -> BARISTA FLOOR MODEL
-- ==========================================================

-- 1. HARD RESET: Wipe all legacy batches to start clean
-- This removes all RESTORE-, FIX-, and other cluttered data.
TRUNCATE public.inventory_batches RESTART IDENTITY;

-- 2. SALES LOGIC: Deducts from the OPENED container
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

        -- Deduct from OPENED batches (The Floor stock)
        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = r_item.item_id 
              AND remaining_quantity > 0
              AND is_opened = true
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
                updated_at = NOW()
            WHERE id = v_current_batch.id;

            v_total_needed := v_total_needed - v_batch_deduct;
        END LOOP;

        -- Update master stock (The Grand Total in building)
        UPDATE public.inventory_items
        SET stock = stock - (r_item.quantity * p_quantity),
            last_updated = NOW()
        WHERE id = r_item.item_id;

        -- Record transaction
        IF (r_item.quantity * p_quantity) > 0 THEN
             INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
             VALUES (r_item.item_id, p_actor_id, 'out', r_item.quantity * p_quantity, p_actor_name, NOW());
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. STOCK OUT LOGIC: "Opening a New Container"
CREATE OR REPLACE FUNCTION public.stock_out_manual(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT,
    p_actor_name TEXT DEFAULT 'System',
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_old_batch RECORD;
    v_item_name TEXT;
    v_unit_cost NUMERIC;
    v_supplier TEXT;
    v_batch_number TEXT;
BEGIN
    -- [STEP A] AUTO-WASTE: If another batch is still open, close it and record as waste
    FOR v_old_batch IN (
        SELECT id, remaining_quantity 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id 
          AND is_opened = true 
          AND remaining_quantity > 0
    ) LOOP
        -- Record waste transaction
        INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
        VALUES (p_item_id, p_actor_id, 'waste', v_old_batch.remaining_quantity, p_actor_name || ' (Auto-Waste)', NOW());

        -- Deduct the wasted amount from Grand Total
        UPDATE public.inventory_items
        SET stock = stock - v_old_batch.remaining_quantity,
            last_updated = NOW()
        WHERE id = p_item_id;

        -- Close the batch
        UPDATE public.inventory_batches
        SET remaining_quantity = 0, is_opened = false, updated_at = NOW()
        WHERE id = v_old_batch.id;
    END LOOP;

    -- [STEP B] CREATE THE NEW BATCH (Barista Area)
    SELECT name, unit_cost, supplier_name INTO v_item_name, v_unit_cost, v_supplier 
    FROM public.inventory_items WHERE id = p_item_id;

    v_batch_number := UPPER(LEFT(v_item_name, 3)) || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

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
        p_item_id,
        v_batch_number,
        p_quantity,
        p_quantity,
        COALESCE(v_unit_cost, 0),
        v_supplier,
        CURRENT_DATE,
        TRUE, 
        NOW(),
        NOW()
    );

    -- [STEP C] LOG THE EVENT
    INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity, actor_name, created_at)
    VALUES (p_item_id, p_actor_id, 'out', 0, p_actor_name || ' (Opened Container)', NOW());
END;
$$ LANGUAGE plpgsql;

-- 4. TARGETED RESTORE: Only create batches for the 4 items user confirmed as stocked out
-- Full Cream Milk Diamond = 2 kotak, the 3 beans = 1 batch each
-- IMPORTANT: Quantities must be stored in BASE UNITS (g, ml, pcs)
-- so we multiply display quantity by conversion_rate

-- First: clean up the wrong data from previous run
DELETE FROM public.inventory_batches;

INSERT INTO public.inventory_batches (
    item_id, batch_number, quantity, remaining_quantity, 
    cost_per_unit, supplier_name, received_date, 
    is_opened, opened_at, created_at
)
SELECT 
    i.id,
    UPPER(LEFT(i.name, 3)) || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0'),
    CASE 
        WHEN i.name ILIKE '%Milk Diamond%' THEN 2 * COALESCE(i.conversion_rate, 1)
        ELSE 1 * COALESCE(i.conversion_rate, 1)
    END,
    CASE 
        WHEN i.name ILIKE '%Milk Diamond%' THEN 2 * COALESCE(i.conversion_rate, 1)
        ELSE 1 * COALESCE(i.conversion_rate, 1)
    END,
    COALESCE(i.unit_cost, 0),
    i.supplier_name,
    CURRENT_DATE,
    TRUE,
    NOW(),
    NOW()
FROM public.inventory_items i
WHERE (
    i.name ILIKE '%Full Cream Milk Diamond%'
    OR i.name ILIKE '%Let Me Roast 70A:30R%'
    OR i.name ILIKE '%Dav Coffee 70A:30R%'
    OR i.name ILIKE '%Dav Coffee 50:50%'
);
