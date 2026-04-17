-- SQL Migration: Inventory & COGS Overhaul
-- Run each section separately if needed

-- ============================================
-- SECTION 1: Monthly OPEX table
-- ============================================
CREATE TABLE IF NOT EXISTS public.monthly_opex (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.monthly_opex ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monthly_opex' AND policyname = 'Admin manage opex') THEN
        CREATE POLICY "Admin manage opex" ON public.monthly_opex
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.employees 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- ============================================
-- SECTION 2: Add unit column to menu_recipes
-- ============================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_recipes' AND column_name = 'unit') THEN
        ALTER TABLE public.menu_recipes ADD COLUMN unit TEXT DEFAULT 'pcs';
    END IF;
END $$;

-- ============================================
-- SECTION 3: Ensure numeric precision on batches
-- ============================================
DO $$
BEGIN
    -- Only alter if the columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'remaining_quantity') THEN
        ALTER TABLE public.inventory_batches ALTER COLUMN remaining_quantity TYPE NUMERIC;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'quantity') THEN
        ALTER TABLE public.inventory_batches ALTER COLUMN quantity TYPE NUMERIC;
    END IF;
END $$;

-- ============================================
-- SECTION 4: Ensure necessary columns on inventory_items
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'min_stock') THEN
        ALTER TABLE public.inventory_items ADD COLUMN min_stock NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'max_stock') THEN
        ALTER TABLE public.inventory_items ADD COLUMN max_stock NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'daily_usage') THEN
        ALTER TABLE public.inventory_items ADD COLUMN daily_usage NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'unit_cost') THEN
        ALTER TABLE public.inventory_items ADD COLUMN unit_cost NUMERIC DEFAULT 0;
    END IF;
    -- Check inventory_batches columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'batch_number') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN batch_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'cost_per_unit') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN cost_per_unit NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'supplier_name') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN supplier_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'expired_date') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN expired_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'received_date') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN received_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'notes') THEN
        ALTER TABLE public.inventory_batches ADD COLUMN notes TEXT;
    END IF;
END $$;

-- ============================================
-- SECTION 5: Update upsert_inventory RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_inventory(
    p_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unit TEXT DEFAULT NULL,
    p_stock NUMERIC DEFAULT 0,
    p_min_stock NUMERIC DEFAULT 0,
    p_max_stock NUMERIC DEFAULT 0,
    p_daily_usage NUMERIC DEFAULT 0,
    p_unit_cost NUMERIC DEFAULT 0
) RETURNS public.inventory_items AS $$
DECLARE
    v_item public.inventory_items;
BEGIN
    IF p_id IS NULL THEN
        -- INSERT
        INSERT INTO public.inventory_items (name, category, unit, stock, min_stock, max_stock, daily_usage, unit_cost)
        VALUES (p_name, p_category, p_unit, p_stock, p_min_stock, p_max_stock, p_daily_usage, p_unit_cost)
        RETURNING * INTO v_item;
    ELSE
        -- UPDATE
        UPDATE public.inventory_items
        SET 
            name = COALESCE(p_name, name),
            category = COALESCE(p_category, category),
            unit = COALESCE(p_unit, unit),
            stock = COALESCE(p_stock, stock),
            min_stock = COALESCE(p_min_stock, min_stock),
            max_stock = COALESCE(p_max_stock, max_stock),
            daily_usage = COALESCE(p_daily_usage, daily_usage),
            unit_cost = COALESCE(p_unit_cost, unit_cost),
            updated_at = NOW()
        WHERE id = p_id
        RETURNING * INTO v_item;
    END IF;
    
    RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 6: FIFO index (uses created_at as primary sort)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_batches_fifo 
ON public.inventory_batches (item_id, created_at ASC) 
WHERE remaining_quantity > 0;

-- ============================================
-- SECTION 6: FIFO consumption function
-- ============================================
CREATE OR REPLACE FUNCTION public.process_menu_sales_fifo(
    p_menu_ids UUID[],
    p_quantities INTEGER[],
    p_actor_name TEXT DEFAULT 'System'
) RETURNS VOID AS $$
DECLARE
    i INTEGER;
    v_menu_id UUID;
    v_qty INTEGER;
    v_recipe_row RECORD;
    v_batch_row RECORD;
    v_needed NUMERIC;
    v_to_deduct NUMERIC;
    v_menu_price NUMERIC;
BEGIN
    FOR i IN 1..cardinality(p_menu_ids) LOOP
        v_menu_id := p_menu_ids[i];
        v_qty := p_quantities[i];
        
        SELECT price INTO v_menu_price FROM public.menu_items WHERE id = v_menu_id;
        
        INSERT INTO public.sales_logs (menu_id, quantity, total_price, created_at)
        VALUES (v_menu_id, v_qty, COALESCE(v_menu_price, 0) * v_qty, NOW());
        
        FOR v_recipe_row IN 
            SELECT inventory_item_id, quantity
            FROM public.menu_recipes 
            WHERE menu_item_id = v_menu_id 
        LOOP
            v_needed := v_recipe_row.quantity * v_qty;
            
            FOR v_batch_row IN 
                SELECT id, remaining_quantity 
                FROM public.inventory_batches 
                WHERE item_id = v_recipe_row.inventory_item_id 
                AND remaining_quantity > 0 
                ORDER BY created_at ASC
            LOOP
                IF v_needed <= 0 THEN EXIT; END IF;
                
                v_to_deduct := LEAST(v_needed, v_batch_row.remaining_quantity);
                
                UPDATE public.inventory_batches 
                SET remaining_quantity = remaining_quantity - v_to_deduct 
                WHERE id = v_batch_row.id;
                
                UPDATE public.inventory_items 
                SET stock = stock - v_to_deduct 
                WHERE id = v_recipe_row.inventory_item_id;
                
                v_needed := v_needed - v_to_deduct;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
