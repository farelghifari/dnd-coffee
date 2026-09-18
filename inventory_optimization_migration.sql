-- Inventory Optimization Migration
-- Adds tracking for opened batches, suppliers, and notes

-- 1. Add fields to inventory_batches
ALTER TABLE inventory_batches 
ADD COLUMN IF NOT EXISTS is_opened BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Add fields to inventory_items (for item-level defaults/tracking)
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Update add_batch RPC to handle new fields (if defined)
DROP FUNCTION IF EXISTS add_batch(uuid,numeric,numeric,text,date,date,text,text,boolean);
DROP FUNCTION IF EXISTS add_batch(uuid,numeric,numeric,text,date,date,text,text);
DROP FUNCTION IF EXISTS add_batch(uuid,numeric,numeric,text,date,date,text);
DROP FUNCTION IF EXISTS add_batch(uuid,numeric,numeric,text,date,text,text);
DROP FUNCTION IF EXISTS add_batch(uuid,numeric,numeric,text,date,date,text,text,text); 

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
        opened_at
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
        NULL
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

    -- Update main inventory stock
    UPDATE inventory_items 
    SET stock = stock + p_quantity,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = p_item_id;

    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;
