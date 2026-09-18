-- SQL Migration: Advanced Inventory Extras
-- 1. Addition of OPEX Attachments
-- 2. Weekly Stock Opname Table

-- ============================================
-- SECTION 1: OPEX Attachment Column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_opex' AND column_name = 'attachment_url') THEN
        ALTER TABLE public.monthly_opex ADD COLUMN attachment_url TEXT;
    END IF;
END $$;

-- ============================================
-- SECTION 2: Stock Opname Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_opname (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    theoretical_stock NUMERIC NOT NULL,
    actual_stock NUMERIC NOT NULL,
    difference NUMERIC NOT NULL,
    reason TEXT,
    actor_name TEXT DEFAULT 'System',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_opname ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for now (matching existing structure)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_opname' AND policyname = 'Enable all for now') THEN
        CREATE POLICY "Enable all for now" ON public.inventory_opname FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================
-- SECTION 3: Storage Bucket for Receipts
-- ============================================
-- Note: This requires the storage extension. Most Supabase projects have it.
-- We'll try to insert the bucket. If it fails, the user might need to do it manually.
INSERT INTO storage.buckets (id, name, public)
VALUES ('opex-attachments', 'opex-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
-- Allow public read
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" 
        ON storage.objects FOR SELECT 
        USING ( bucket_id = 'opex-attachments' );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Enable upload for all' AND schemaname = 'storage') THEN
        CREATE POLICY "Enable upload for all" 
        ON storage.objects FOR INSERT 
        WITH CHECK ( bucket_id = 'opex-attachments' );
    END IF;
END $$;
