-- SQL Script: Create RPC functions for super_admin promotion
-- This script creates PostgreSQL functions that calculate expiration time
-- using the database's now() function to avoid timezone issues

-- Function 1: promote_to_super_admin
-- Promotes an employee to super_admin with a duration in minutes
-- Uses PostgreSQL now() + interval to calculate expiration
CREATE OR REPLACE FUNCTION promote_to_super_admin(
  employee_id UUID,
  duration_minutes INTEGER
)
RETURNS employees
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_employee employees;
BEGIN
  -- Update the employee with role and calculated expiration
  -- IMPORTANT: Uses database now() to avoid timezone issues
  UPDATE employees
  SET 
    role = 'super_admin',
    super_admin_expires_at = now() + (duration_minutes || ' minutes')::interval
  WHERE id = employee_id
  RETURNING * INTO updated_employee;
  
  RETURN updated_employee;
END;
$$;

-- Function 2: get_server_time
-- Returns the current database server time
-- Useful for debugging and fallback calculations
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT now();
$$;

-- Function 3: check_and_demote_expired_super_admins
-- Automatically demotes expired temporary super_admins back to admin
-- Can be called periodically or via a cron job
CREATE OR REPLACE FUNCTION check_and_demote_expired_super_admins()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  demoted_count INTEGER;
BEGIN
  -- Demote all expired temporary super_admins to admin
  -- Only affects those with a non-null super_admin_expires_at that has passed
  UPDATE employees
  SET 
    role = 'admin',
    super_admin_expires_at = NULL
  WHERE 
    role = 'super_admin' 
    AND super_admin_expires_at IS NOT NULL 
    AND super_admin_expires_at < now();
  
  GET DIAGNOSTICS demoted_count = ROW_COUNT;
  
  RETURN demoted_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION promote_to_super_admin(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_demote_expired_super_admins() TO authenticated;

-- Optional: Create an index for faster expiration checks
CREATE INDEX IF NOT EXISTS idx_employees_super_admin_expires 
ON employees(super_admin_expires_at) 
WHERE role = 'super_admin' AND super_admin_expires_at IS NOT NULL;
