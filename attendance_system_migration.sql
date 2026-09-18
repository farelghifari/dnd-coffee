-- Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    radius_meters INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'nfc'; -- 'personal' or 'nfc'
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id);
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_ops_device BOOLEAN DEFAULT FALSE;

-- Create default Main Outlet
INSERT INTO outlets (name, latitude, longitude, radius_meters)
VALUES ('Main Outlet', -6.200000, 106.816666, 100)
ON CONFLICT DO NOTHING;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_outlet_id ON attendance_logs(outlet_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_method ON attendance_logs(method);
