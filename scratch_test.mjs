import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/);
const supabase = createClient(
  urlMatch[1].replace(/"/g, '').trim(), 
  keyMatch[1].replace(/"/g, '').trim()
);

async function test() {
  console.log("Fetching inventory_transactions...");
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(`
      id,
      item_id,
      type,
      quantity,
      employee_id,
      created_at,
      inventory_items(name),
      employees(name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Error:', JSON.stringify(error, null, 2));
  console.log('Data count:', data?.length || 0);

  if (error) {
    console.log("Checking schema...");
    // Let's also check if table exists
    const res = await supabase.from('inventory_transactions').select('*').limit(1);
    console.log('Bare table Error:', JSON.stringify(res.error, null, 2));
  }
}

test();
