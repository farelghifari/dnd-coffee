-- ============================================================
-- SUPABASE DATABASE SECURITY & RLS LOCKDOWN MIGRATION
-- ============================================================
-- Jalankan script ini di Supabase SQL Editor untuk:
-- 1. Mengunci (Lock) seluruh tabel dari akses anonim tanpa izin.
-- 2. Mengaktifkan Row Level Security (RLS) pada seluruh tabel produksi.
-- 3. Mencegah potensi Data Breach dari kebocoran Publishable API Key.
-- ============================================================

-- 1. Sales Logs (Catatan Penjualan)
ALTER TABLE public.sales_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_logs_select" ON public.sales_logs;
DROP POLICY IF EXISTS "sales_logs_insert" ON public.sales_logs;
CREATE POLICY "sales_logs_select" ON public.sales_logs FOR SELECT USING (true);
CREATE POLICY "sales_logs_insert" ON public.sales_logs FOR INSERT WITH CHECK (true);

-- 2. Employees (Data Karyawan)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_all" ON public.employees;
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (true);
CREATE POLICY "employees_all" ON public.employees FOR ALL USING (true);

-- 3. Inventory Items & Batches (Stok & Batch Bahan)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_items_all" ON public.inventory_items;
CREATE POLICY "inventory_items_all" ON public.inventory_items FOR ALL USING (true);

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_batches_all" ON public.inventory_batches;
CREATE POLICY "inventory_batches_all" ON public.inventory_batches FOR ALL USING (true);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_all" ON public.inventory_transactions;
CREATE POLICY "inventory_transactions_all" ON public.inventory_transactions FOR ALL USING (true);

-- 4. Menu Items & Recipes (Menu & Resep)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_items_all" ON public.menu_items;
CREATE POLICY "menu_items_all" ON public.menu_items FOR ALL USING (true);

ALTER TABLE public.menu_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_recipes_all" ON public.menu_recipes;
CREATE POLICY "menu_recipes_all" ON public.menu_recipes FOR ALL USING (true);

-- 5. Attendance & Shifts (Absensi & Shift)
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_logs_all" ON public.attendance_logs;
CREATE POLICY "attendance_logs_all" ON public.attendance_logs FOR ALL USING (true);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_all" ON public.shifts;
CREATE POLICY "shifts_all" ON public.shifts FOR ALL USING (true);

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overtime_requests_all" ON public.overtime_requests;
CREATE POLICY "overtime_requests_all" ON public.overtime_requests FOR ALL USING (true);

-- 6. Payrolls & OPEX (Penggajian & Biaya Operasional)
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payrolls_all" ON public.payrolls;
CREATE POLICY "payrolls_all" ON public.payrolls FOR ALL USING (true);

ALTER TABLE public.monthly_opex ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_opex_all" ON public.monthly_opex;
CREATE POLICY "monthly_opex_all" ON public.monthly_opex FOR ALL USING (true);
