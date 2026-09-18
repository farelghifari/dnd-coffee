import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const lines = envStr.split('\n');

function getEnvValue(key) {
  const line = lines.find(l => l.trim().startsWith(key + '='));
  if (line) {
    return line.split('=')[1].trim().replace(/"/g, '');
  }
  return null;
}

const url = getEnvValue('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnvValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

const ARYA_ID = '277723af-825e-4dc7-b2ab-3e53fe419648';

async function investigate() {
  console.log("Investigating Arya's logs for May 6th/7th...");
  
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('date', '2026-05-06')
    .order('time', { ascending: true });

  console.log("--- Attendance Logs (May 6-7) ---");
  console.table(logs);
  
  const { data: ots } = await supabase
    .from('overtime_requests')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('request_date', '2026-05-06');

  console.log("--- Overtime Requests (May 6-7) ---");
  console.table(ots);

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('date', '2026-05-06');

  console.log("--- Shifts (May 6-7) ---");
  console.table(shifts);
}

investigate();
