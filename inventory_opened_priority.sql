-- THE FINAL SEQUENTIAL STOCK-OUT (V2)
-- Copy and run this entire script in Supabase!

-- 1. Create the function
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
    i INTEGER;
BEGIN
    -- Get item info
    SELECT name, unit_cost, unit INTO v_item_name, v_unit_cost, v_unit
    FROM public.inventory_items WHERE id = p_item_id;

    -- Calculate amount per row
    v_base_qty_per_batch := p_quantity / GREATEST(p_batch_count, 1);

    -- DEDUCT from Warehouse
    UPDATE public.inventory_items
    SET stock = stock - COALESCE(p_quantity, 0)
    WHERE id = p_item_id;

    -- LOOP: Create sequential rows
    FOR i IN 1..p_batch_count LOOP
        -- Next sequence
        SELECT COUNT(*) + 1 INTO v_current_seq 
        FROM public.inventory_batches 
        WHERE item_id = p_item_id;

        -- Numbering (e.g., MILK-012)
        v_batch_no := UPPER(LEFT(v_item_name, 3)) || '-' || LPAD(v_current_seq::TEXT, 3, '0');

        -- Create Floor Batch
        INSERT INTO public.inventory_batches (
            item_id, batch_number, quantity, remaining_quantity, 
            cost_per_unit, is_opened, opened_at, received_date, unit
        )
        VALUES (
            p_item_id, v_batch_no, v_base_qty_per_batch, v_base_qty_per_batch, 
            COALESCE(v_unit_cost, 0), TRUE, NOW(), CURRENT_DATE, v_unit
        );
    END LOOP;

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, waste_reason)
    VALUES (p_item_id, 'out', p_quantity, COALESCE(p_reason, 'manual'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESTORE TEST VALUES
UPDATE public.inventory_items SET stock = 10000 WHERE name ILIKE '%50:50%';
UPDATE public.inventory_items SET stock = 10000 WHERE name ILIKE '%Classic%';
UPDATE public.inventory_items SET stock = 11000 WHERE name ILIKE '%Milk%Diamond%';

-- 3. CONFIRMATION CHECK
SELECT name, stock, unit FROM public.inventory_items WHERE stock > 0 LIMIT 5;
