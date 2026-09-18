-- Migration to add actor_name to inventory_transactions
-- This allows tracking who performed a transaction even without an employee_id link

-- 1. Add the column to inventory_transactions
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS actor_name TEXT DEFAULT 'System';

-- 2. Update update_inventory_stock RPC to handle actor_name (if it's used as an RPC)
-- Most of our code uses direct insert for transactions, but let's update common functions

-- 3. Update add_batch RPC to record actor_name in transactions
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
    
    -- Generate batch number
    v_batch_number := UPPER(LEFT(v_item_name, 3)) || '-' || 
                     TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                     LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

    INSERT INTO inventory_batches (
        item_id, quantity, remaining_quantity, cost_per_unit, 
        supplier_name, received_date, expired_date, notes, 
        batch_number, is_opened
    )
    VALUES (
        p_item_id, p_quantity, p_quantity, p_unit_cost, 
        p_supplier_name, p_received_date, p_expired_date, p_notes, 
        v_batch_number, FALSE
    )
    RETURNING id INTO v_batch_id;

    -- Record transaction with actor_name
    INSERT INTO inventory_transactions (
        item_id, type, quantity, employee_id, actor_name
    )
    VALUES (
        p_item_id, 'in', p_quantity, NULL, p_actor_name
    );

    -- Update main inventory stock
    UPDATE inventory_items 
    SET stock = COALESCE(stock, 0) + p_quantity,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = p_item_id;

    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Update stock_out_manual RPC to record actor_name
CREATE OR REPLACE FUNCTION stock_out_manual(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT DEFAULT 'manual',
    p_actor_name TEXT DEFAULT 'System'
)
RETURNS VOID AS $$
BEGIN
    -- Record transaction
    INSERT INTO inventory_transactions (
        item_id, type, quantity, employee_id, actor_name
    )
    VALUES (
        p_item_id, 'out', p_quantity, NULL, p_actor_name
    );

    -- Update stock
    UPDATE inventory_items 
    SET stock = GREATEST(0, COALESCE(stock, 0) - p_quantity),
        last_updated = CURRENT_TIMESTAMP
    WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;
