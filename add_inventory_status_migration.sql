-- Migration: Add status column to inventory_items
-- Purpose: Allow admin to disable/enable inventory items to suppress low-stock notifications

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_items' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.inventory_items 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        
        RAISE NOTICE 'Added status column to inventory_items';
    ELSE
        RAISE NOTICE 'status column already exists on inventory_items';
    END IF;
END $$;
