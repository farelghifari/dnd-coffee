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
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('employee_id', ARYA_ID)
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(20);

  console.log(JSON.stringify(logs, null, 2));
}

investigate();
