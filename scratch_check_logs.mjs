import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.*)/);

const supabase = createClient(
  urlMatch[1].replace(/"/g, '').trim(), 
  keyMatch[1].replace(/"/g, '').trim()
);

async function test() {
  console.log("Fetching inventory_transactions...");
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Data records:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

test();
