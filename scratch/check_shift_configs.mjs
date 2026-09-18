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

async function checkShiftConfigs() {
  const { data: configs } = await supabase
    .from('shift_configs')
    .select('*');
    
  console.table(configs);
}

checkShiftConfigs();
