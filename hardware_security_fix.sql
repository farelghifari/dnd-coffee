-- 1. Add missing columns to employees table for hardware security tracking
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS registered_device TEXT,
ADD COLUMN IF NOT EXISTS last_device_id TEXT;

-- 2. Create the trigger function to automatically sync device IDs
-- This function runs every time a new attendance log is created
-- It allows the Hardware Security dashboard to stay updated without extra frontend code
CREATE OR REPLACE FUNCTION public.sync_last_device_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the log has device_info
    IF NEW.device_info IS NOT NULL THEN
        UPDATE public.employees
        SET last_device_id = NEW.device_info
        WHERE id = NEW.employee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows this to bypass RLS

-- 3. Create the trigger on attendance_logs
DROP TRIGGER IF EXISTS on_attendance_log_inserted ON public.attendance_logs;
CREATE TRIGGER on_attendance_log_inserted
AFTER INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_last_device_id();

-- 4. Ensure an index exists on employee_id in attendance_logs for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_id ON public.attendance_logs(employee_id);
