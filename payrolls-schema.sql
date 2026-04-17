-- 1. Create payrolls table
CREATE TABLE payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_hours NUMERIC DEFAULT 0,
  ot_hours NUMERIC DEFAULT 0,
  salary_hourly NUMERIC DEFAULT 0,
  adjustment NUMERIC DEFAULT 0,
  total_payroll NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'settled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, start_date, end_date)
);

-- 2. Optional: Allow public access or authenticated access if you've enabled Row Level Security
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- If RLS is enabled, you might need a public policy if you are testing without strict auth:
CREATE POLICY "Allow all access on payrolls" ON payrolls FOR ALL USING (true) WITH CHECK (true);
