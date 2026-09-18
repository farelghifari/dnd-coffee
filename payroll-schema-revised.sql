-- SECURE PAYROLL SQL: Restrict access to specific Admin roles
-- Run this in your Supabase SQL Editor

-- 1. Reset all previous policies for a clean slate
DROP POLICY IF EXISTS "Admins have full access to payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Employees can view their own settled payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Allow All for testing" ON public.payrolls;

-- 2. Enable RLS
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Full Access for Super Admins
-- (Using auth.email() is more stable than jwt fields sometimes)
CREATE POLICY "Manage Payrolls Policy" 
ON public.payrolls FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE email = auth.jwt() ->> 'email' 
        AND role IN ('super_admin', 'main_super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE email = auth.jwt() ->> 'email' 
        AND role IN ('super_admin', 'main_super_admin')
    )
);

-- 4. Policy: View-only for Employees (only settled payrolls)
CREATE POLICY "View Settled Payrolls Policy" 
ON public.payrolls FOR SELECT 
TO authenticated 
USING (
    employee_id IN (
        SELECT id FROM public.employees 
        WHERE email = auth.jwt() ->> 'email'
    ) 
    AND status = 'settled'
);

-- DEBUG QUERY (Optional: Run this to check your current status)
-- SELECT email, role FROM employees WHERE email = auth.jwt() ->> 'email';
