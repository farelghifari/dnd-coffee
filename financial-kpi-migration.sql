-- SQL Migration: KPI, Targets, and COGS Tracking
-- Run in Supabase SQL Editor

-- 1. Modify sales_logs to track COGS precisely
ALTER TABLE IF EXISTS public.sales_logs 
ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);

-- 2. Create employee_kpis for point and note tracking
CREATE TABLE IF NOT EXISTS public.employee_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    points INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    notes TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT -- usually 'Admin' or 'System'
);

ALTER TABLE public.employee_kpis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_kpis') THEN
        CREATE POLICY "Admin manage KPIs" ON public.employee_kpis
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.employees 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- 3. Create monthly_targets
CREATE TABLE IF NOT EXISTS public.monthly_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month TEXT NOT NULL UNIQUE, -- format: 'YYYY-MM'
    revenue_target NUMERIC DEFAULT 0,
    sales_target INTEGER DEFAULT 0,
    aov_target NUMERIC DEFAULT 0,
    growth_percentage NUMERIC DEFAULT 5,
    is_automatic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monthly_targets') THEN
        CREATE POLICY "Admin manage targets" ON public.monthly_targets
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.employees 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- 4. UPDATE FIFO function to calculate and record COGS
CREATE OR REPLACE FUNCTION public.process_menu_sales_fifo(
    p_menu_ids UUID[],
    p_quantities INTEGER[],
    p_actor_name TEXT DEFAULT 'System',
    p_employee_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    var_idx INTEGER;
    var_item_id UUID;
    var_qty INTEGER;
    var_recipe RECORD;
    var_batch RECORD;
    var_needed NUMERIC;
    var_to_deduct NUMERIC;
    var_item_price NUMERIC;
    var_calc_total_price NUMERIC;
    var_total_cogs NUMERIC;
    var_batch_cogs NUMERIC;
BEGIN
    FOR var_idx IN 1..cardinality(p_menu_ids) LOOP
        var_item_id := p_menu_ids[var_idx];
        var_qty := p_quantities[var_idx];
        var_total_cogs := 0;
        
        -- Get item price
        SELECT price INTO var_item_price FROM public.menu_items WHERE id = var_item_id;
        
        -- Calculate total price for this item before insertion
        var_calc_total_price := COALESCE(var_item_price, 0) * var_qty;

        -- Deduct from inventory using FIFO and calculate COGS
        FOR var_recipe IN 
            SELECT inventory_item_id, quantity
            FROM public.menu_recipes 
            WHERE menu_item_id = var_item_id 
        LOOP
            var_needed := var_recipe.quantity * var_qty;
            
            FOR var_batch IN 
                SELECT id, remaining_quantity, cost_per_unit 
                FROM public.inventory_batches 
                WHERE item_id = var_recipe.inventory_item_id 
                AND remaining_quantity > 0 
                ORDER BY created_at ASC
            LOOP
                IF var_needed <= 0 THEN EXIT; END IF;
                
                var_to_deduct := LEAST(var_needed, var_batch.remaining_quantity);
                var_batch_cogs := var_to_deduct * COALESCE(var_batch.cost_per_unit, 0);
                var_total_cogs := var_total_cogs + var_batch_cogs;
                
                UPDATE public.inventory_batches 
                SET remaining_quantity = remaining_quantity - var_to_deduct 
                WHERE id = var_batch.id;
                
                UPDATE public.inventory_items 
                SET stock = stock - var_to_deduct 
                WHERE id = var_recipe.inventory_item_id;
                
                var_needed := var_needed - var_to_deduct;
            END LOOP;
        END LOOP;

        -- Record sale WITH the calculated COGS and employee attribution
        -- Using SELECT for more robust variable substitution in Supabase
        INSERT INTO public.sales_logs (
            menu_id, 
            quantity, 
            total_price, 
            total_cost, 
            employee_id, 
            created_at
        )
        SELECT 
            var_item_id, 
            var_qty, 
            var_calc_total_price, 
            var_total_cogs, 
            p_employee_id, 
            NOW();
        
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
