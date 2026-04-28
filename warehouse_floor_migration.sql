-- Migration: Warehouse vs Floor Management
-- This migration separates stock into 'warehouse' and 'floor' (barista) locations.

-- 1. Create location enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_location') THEN
        CREATE TYPE batch_location AS ENUM ('warehouse', 'floor');
    END IF;
END$$;

-- 2. Add location column to inventory_batches
ALTER TABLE inventory_batches 
ADD COLUMN IF NOT EXISTS location batch_location DEFAULT 'warehouse';

-- 3. Backfill: Existing opened batches move to 'floor', others to 'warehouse'
UPDATE inventory_batches 
SET location = 'floor' 
WHERE is_opened = true;

UPDATE inventory_batches 
SET location = 'warehouse' 
WHERE is_opened = false OR is_opened IS NULL;

-- 4. Update add_batch RPC to ensure it sets location to 'warehouse'
CREATE OR REPLACE FUNCTION add_batch(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_unit_cost NUMERIC,
    p_supplier_name TEXT DEFAULT NULL,
    p_received_date DATE DEFAULT CURRENT_DATE,
    p_expired_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_batch_number TEXT;
    v_item_name TEXT;
BEGIN
    -- Get item name for batch number
    SELECT name INTO v_item_name FROM inventory_items WHERE id = p_item_id;
    
    -- Generate batch number: ITEM-YYYYMMDD-SEQ
    v_batch_number := UPPER(LEFT(v_item_name, 3)) || '-' || 
                     TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                     LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

    INSERT INTO inventory_batches (
        item_id,
        quantity,
        remaining_quantity,
        cost_per_unit,
        supplier_name,
        received_date,
        expired_date,
        notes,
        batch_number,
        is_opened,
        location
    )
    VALUES (
        p_item_id,
        p_quantity,
        p_quantity,
        p_unit_cost,
        p_supplier_name,
        p_received_date,
        p_expired_date,
        p_notes,
        v_batch_number,
        FALSE,
        'warehouse'
    )
    RETURNING id INTO v_batch_id;

    -- Record transaction
    INSERT INTO inventory_transactions (
        item_id,
        type,
        quantity,
        employee_id
    )
    VALUES (
        p_item_id,
        'in',
        p_quantity,
        NULL
    );

    -- Update main inventory stock (Warehouse Stock)
    UPDATE inventory_items 
    SET stock = stock + p_quantity,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = p_item_id;

    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Create transfer_batch_to_floor function
-- This handles "Stock Out" from Warehouse to Barista Floor
CREATE OR REPLACE FUNCTION transfer_batch_to_floor(
    p_batch_id UUID,
    p_quantity NUMERIC,
    p_actor_name TEXT DEFAULT 'System'
)
RETURNS VOID AS $$
DECLARE
    v_item_id UUID;
    v_remaining_in_batch NUMERIC;
    v_new_batch_id UUID;
    v_warehouse_batch RECORD;
BEGIN
    -- Get warehouse batch details
    SELECT item_id, remaining_quantity, cost_per_unit, supplier_name, received_date, expired_date, notes, batch_number
    INTO v_warehouse_batch
    FROM inventory_batches 
    WHERE id = p_batch_id AND location = 'warehouse';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse batch not found';
    END IF;

    IF v_warehouse_batch.remaining_quantity < p_quantity THEN
        RAISE EXCEPTION 'Insufficient quantity in warehouse batch';
    END IF;

    -- A. Decrease quantity from Warehouse Batch
    UPDATE inventory_batches 
    SET remaining_quantity = remaining_quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- B. Decrease master stock (Gudang Utama)
    UPDATE inventory_items 
    SET stock = stock - p_quantity,
        last_updated = NOW()
    WHERE id = v_warehouse_batch.item_id;

    -- C. Create or find a "Floor" batch for this item
    -- We create a NEW batch record for the floor so it has its own tracking in "Batch Tracking"
    -- This follows the user request: "1 nya stock out itu akan masuk ke batch tracking"
    INSERT INTO inventory_batches (
        item_id,
        quantity,
        remaining_quantity,
        cost_per_unit,
        supplier_name,
        received_date,
        expired_date,
        notes,
        batch_number,
        is_opened,
        location
    )
    VALUES (
        v_warehouse_batch.item_id,
        p_quantity,
        p_quantity,
        v_warehouse_batch.cost_per_unit,
        v_warehouse_batch.supplier_name,
        v_warehouse_batch.received_date,
        v_warehouse_batch.expired_date,
        v_warehouse_batch.notes || ' (Moved from warehouse)',
        v_warehouse_batch.batch_number || '-FLOOR',
        TRUE, -- Automatically "Opened" or at least on floor
        'floor'
    );

    -- D. Record transaction
    INSERT INTO inventory_transactions (
        item_id,
        type,
        quantity,
        notes
    )
    VALUES (
        v_warehouse_batch.item_id,
        'out',
        p_quantity,
        'Transfer to Barista Floor'
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Update process_menu_sales_fifo to ONLY deduct from 'floor'
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
        SELECT item_id, quantity 
        FROM public.menu_recipes 
        WHERE menu_id = p_menu_id
    ) LOOP
        v_total_needed := r_item.quantity * p_quantity;

        -- ONLY look for 'floor' batches
        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = r_item.item_id 
              AND location = 'floor'
              AND remaining_quantity > 0
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
        
        -- Note: We DO NOT update inventory_items.stock here because 
        -- it was already subtracted when moved to the floor.
        -- inventory_items.stock now represents Warehouse Stock only.
    END LOOP;
END;
$$ LANGUAGE plpgsql;
