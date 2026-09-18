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

console.log("Using URL:", url);

const supabase = createClient(url, key);

async function listEmployees() {
  const { data: emps, error } = await supabase
    .from('employees')
    .select('id, name')
    .neq('status', 'deleted');
    
  if (error) {
    console.log("Error:", error);
  } else {
    console.table(emps);
  }
}

listEmployees();
