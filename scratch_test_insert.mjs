import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.*)/);

const supabase = createClient(
  urlMatch[1].replace(/"/g, '').trim(), 
  keyMatch[1].replace(/"/g, '').trim()
);

async function testInsert() {
  console.log("Fetching first item to use as a dummy reference...");
  const { data: items } = await supabase.from('inventory_items').select('id').limit(1);
  if (!items || items.length === 0) {
    console.log("No items found, can't test transaction.");
    return;
  }
  const item_id = items[0].id;
  
  console.log(`Testing insert to inventory_transactions for item ${item_id}...`);
  const res = await supabase
        .from('inventory_transactions')
        .insert([{
          item_id: item_id,
          type: 'in',
          quantity: 10,
          employee_id: null
        }])
        .select();

  console.log("Insert Result:", JSON.stringify(res, null, 2));

  // Clean up
  if (res.data && res.data.length > 0) {
     await supabase.from('inventory_transactions').delete().eq('id', res.data[0].id);
  }
}

testInsert();
