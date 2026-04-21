-- THE IMPROVED SEQUENTIAL STOCK-OUT (V3 - SAFE VERSION)
-- Purpose: 
-- 1. Auto-wastes leftovers from old opened boxes when a new one is opened.
-- 2. Maintains current stock model while fixing batch integrity.

CREATE OR REPLACE FUNCTION public.stock_out_v2(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT DEFAULT 'manual',
    p_actor_name TEXT DEFAULT 'System',
    p_batch_count INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
    v_item_name TEXT;
    v_unit_cost NUMERIC;
    v_unit TEXT;
    v_batch_no TEXT;
    v_base_qty_per_batch NUMERIC;
    v_current_seq INTEGER;
    v_total_waste NUMERIC;
    i INTEGER;
BEGIN
    -- 1. Get info item
    SELECT name, unit_cost, unit INTO v_item_name, v_unit_cost, v_unit
    FROM public.inventory_items WHERE id = p_item_id;

    -- 2. AUTO-WASTE: Close previous opened batches for the same item
    SELECT SUM(remaining_quantity) INTO v_total_waste
    FROM public.inventory_batches 
    WHERE item_id = p_item_id AND is_opened = TRUE AND remaining_quantity > 0;

    IF v_total_waste > 0 THEN
        -- Log the waste in transactions
        INSERT INTO public.inventory_transactions (item_id, type, quantity, waste_reason, actor_name)
        VALUES (p_item_id, 'waste', v_total_waste, 'Auto-waste: Diganti dengan batch baru', p_actor_name);
        
        -- Set old batches to 0
        UPDATE public.inventory_batches 
        SET remaining_quantity = 0 
        WHERE item_id = p_item_id AND is_opened = TRUE AND remaining_quantity > 0;
    END IF;

    -- 3. DEDUCT from Warehouse (Master Stock)
    UPDATE public.inventory_items
    SET stock = stock - COALESCE(p_quantity, 0)
    WHERE id = p_item_id;

    -- 4. Buka Batch Baru
    v_base_qty_per_batch := p_quantity / GREATEST(p_batch_count, 1);

    FOR i IN 1..p_batch_count LOOP
        SELECT COUNT(*) + 1 INTO v_current_seq 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id;

        v_batch_no := UPPER(LEFT(v_item_name, 3)) || '-' || LPAD(v_current_seq::TEXT, 3, '0');

        INSERT INTO public.inventory_batches (
            item_id, batch_number, quantity, remaining_quantity, 
            cost_per_unit, is_opened, opened_at, received_date, unit
        )
        VALUES (
            p_item_id, v_batch_no, v_base_qty_per_batch, v_base_qty_per_batch, 
            COALESCE(v_unit_cost, 0), TRUE, NOW(), CURRENT_DATE, v_unit
        );
    END LOOP;

    -- 5. Catat transaksi 'out'
    INSERT INTO public.inventory_transactions (item_id, type, quantity, actor_name, waste_reason)
    VALUES (p_item_id, 'out', p_quantity, p_actor_name, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
