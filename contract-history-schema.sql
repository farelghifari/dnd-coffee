-- CREATE CONTRACT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.employee_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contract_pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ADD INDEXES
CREATE INDEX IF NOT EXISTS idx_employee_contracts_employee_id ON public.employee_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_contracts_dates ON public.employee_contracts(employee_id, end_date DESC);

-- ENABLE RLS
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

-- POLICIES (Allow all for service role, select for authenticated admins)
-- Drop before create to avoid "already exists" errors during migration
DROP POLICY IF EXISTS "Allow admins to read contract history" ON public.employee_contracts;
CREATE POLICY "Allow admins to read contract history" 
ON public.employee_contracts FOR SELECT 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = auth.uid() 
    AND (employees.role = 'admin' OR employees.role = 'super_admin')
));

DROP POLICY IF EXISTS "Allow admins to insert contract history" ON public.employee_contracts;
CREATE POLICY "Allow admins to insert contract history" 
ON public.employee_contracts FOR INSERT 
TO authenticated 
WITH CHECK (EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = auth.uid() 
    AND (employees.role = 'admin' OR employees.role = 'super_admin')
));

-- FUNCTION: Atomic Contract Renewal
-- This function handles both archiving the old contract and updating the new one
-- SECURITY DEFINER allows it to bypass RLS for administrative consistency
CREATE OR REPLACE FUNCTION public.renew_employee_contract(
    p_employee_id UUID,
    p_new_start_date DATE,
    p_new_end_date DATE,
    p_new_pdf_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Archive the current contract info into the history table first
    -- Only if there is currently a valid contract to archive
    INSERT INTO public.employee_contracts (employee_id, start_date, end_date, contract_pdf_url)
    SELECT id, contract_start_date, contract_end_date, contract_pdf_url
    FROM public.employees
    WHERE id = p_employee_id
      AND contract_start_date IS NOT NULL 
      AND contract_end_date IS NOT NULL;

    -- 2. Update employees table with the new contract details
    UPDATE public.employees
    SET contract_start_date = p_new_start_date,
        contract_end_date = p_new_end_date,
        contract_pdf_url = p_new_pdf_url
    WHERE id = p_employee_id;

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION public.renew_employee_contract(UUID, DATE, DATE, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.renew_employee_contract(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_employee_contract(UUID, DATE, DATE, TEXT) TO service_role;

-- COMMENT
COMMENT ON TABLE public.employee_contracts IS 'Stores historical records of employee contracts when renewed.';
