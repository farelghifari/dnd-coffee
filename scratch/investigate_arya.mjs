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
  console.log("Investigating Arya's logs...");
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('date', '2026-05-01') // check recent logs
    .order('date', { ascending: false })
    .order('time', { ascending: false });

  console.log("--- Attendance Logs ---");
  console.table(logs);
  
  const { data: ots } = await supabase
    .from('overtime_requests')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('request_date', '2026-05-01')
    .order('request_date', { ascending: false });

  console.log("--- Overtime Requests ---");
  console.table(ots);

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .gte('date', '2026-05-01')
    .order('date', { ascending: false });

  console.log("--- Shifts ---");
  console.table(shifts);
}

investigate();
