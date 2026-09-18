-- SQL Script: Inventory, Batch Tracking & Employee Management
-- This script adds new columns and functions for the new product specifications

-- 1. Employee Table Updates
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- 2. Inventory Items Updates
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS display_unit TEXT,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC DEFAULT 1;

-- Update existing items to use their base unit as display unit initially
UPDATE public.inventory_items 
SET display_unit = unit, conversion_rate = 1
WHERE display_unit IS NULL;

-- 3. Inventory Transactions Updates (for Waste tracking)
ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS waste_reason TEXT; -- e.g. basi, rusak, operasional, salah_produksi, shrinkage

/*
-- 4. Storage Buckets (No longer required - moved to local Next.js API)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Storage Policies for Avatars
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Admins can upload avatars."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

create policy "Admins can update avatars."
  on storage.objects for update
  using ( bucket_id = 'avatars' );

-- Storage Policies for Contracts (Private)
create policy "Admins can view contracts."
  on storage.objects for select
  using ( bucket_id = 'contracts' );

create policy "Admins can upload contracts."
  on storage.objects for insert
  with check ( bucket_id = 'contracts' );

create policy "Admins can update contracts."
  on storage.objects for update
  using ( bucket_id = 'contracts' );
*/

-- 5. FEFO + FIFO Queue Update
-- First, recreate the index to prioritize expired_date ASC NULLS LAST, then created_at ASC
DROP INDEX IF EXISTS public.idx_inventory_batches_fifo;

CREATE INDEX IF NOT EXISTS idx_inventory_batches_fefo
ON public.inventory_batches (item_id, expired_date ASC NULLS LAST, created_at ASC)
WHERE remaining_quantity > 0;

-- Update the process_menu_sales_fifo function to use FEFO logic
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
    -- 1. Create a dummy order ID or pass from parameter (simplified here)
    v_order_id := 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    -- 2. Log exactly 1 row per menu sale in sales_logs
    IF p_quantity > 0 THEN
        INSERT INTO public.sales_logs (menu_id, quantity, total_price, created_at)
        VALUES (p_menu_id, p_quantity, p_price, NOW());
    END IF;

    -- 3. Find recipe items for this menu
    FOR r_item IN (
        SELECT item_id, quantity, unit 
        FROM public.menu_recipes 
        WHERE menu_id = p_menu_id
    ) LOOP
        -- Total amount needed for this specific inventory item
        v_total_needed := r_item.quantity * p_quantity;

        -- 4. Find available batches for this item ordered by FEFO (First Expired First Out)
        -- Fallback to FIFO (created_at) if expired_date is null
        FOR v_current_batch IN (
            SELECT id, remaining_quantity 
            FROM public.inventory_batches 
            WHERE item_id = r_item.item_id 
              AND remaining_quantity > 0
            ORDER BY expired_date ASC NULLS LAST, created_at ASC
        ) LOOP
            IF v_total_needed <= 0 THEN
                EXIT; -- Loop break if fulfilled
            END IF;

            -- Determine how much to take from this batch
            IF v_current_batch.remaining_quantity >= v_total_needed THEN
                v_batch_deduct := v_total_needed;
            ELSE
                v_batch_deduct := v_current_batch.remaining_quantity;
            END IF;

            -- Update batch quantity
            UPDATE public.inventory_batches
            SET remaining_quantity = remaining_quantity - v_batch_deduct,
                updated_at = NOW()
            WHERE id = v_current_batch.id;

            -- Decrease needed amount
            v_total_needed := v_total_needed - v_batch_deduct;
        END LOOP;

        -- 5. Decrease master stock 
        UPDATE public.inventory_items
        SET stock = stock - (r_item.quantity * p_quantity),
            last_updated = NOW()
        WHERE id = r_item.item_id;

        -- 6. Log ONE consolidated transaction in inventory_transactions for this ingredient reduction
        IF (r_item.quantity * p_quantity) > 0 THEN
             INSERT INTO public.inventory_transactions (item_id, employee_id, type, quantity)
             VALUES (r_item.item_id, p_actor_id, 'out', r_item.quantity * p_quantity);
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Update manual stock out to map reason to waste_reason
CREATE OR REPLACE FUNCTION public.stock_out_manual(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT DEFAULT 'manual'
) RETURNS VOID AS $$
BEGIN
    UPDATE public.inventory_items
    SET stock = stock - p_quantity,
        last_updated = NOW()
    WHERE id = p_item_id;

    INSERT INTO public.inventory_transactions (item_id, type, quantity, waste_reason)
    VALUES (p_item_id, 'waste', p_quantity, p_reason);
END;
$$ LANGUAGE plpgsql;
