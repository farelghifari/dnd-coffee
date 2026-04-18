import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.*)/);

const supabase = createClient(
  urlMatch[1].replace(/"/g, '').trim(), 
  keyMatch[1].replace(/"/g, '').trim()
);

async function testSchema() {
  const { data, error } = await supabase.from('inventory_batches').select('*').limit(1);
  if (error) {
    console.log("Error querying inventory_batches:", error);
  } else {
    // If table exists but has no records, we can't see the schema directly via select if it's empty, 
    // unless we get the columns from a meta query. But PostgREST doesn't support DESCRIBE.
    // Let's try to insert dummy data with `is_opened` column and rollback.
    console.log("Empty or has data. Let's send an invalid insert to get the error.");
  }
  
  // Try inserting a record with is_opened
  const { error: insertErr } = await supabase.from('inventory_batches').insert([{
    item_id: '00000000-0000-0000-0000-000000000000', // invalid uuid will fail FK constraint, but schema check comes first!
    quantity: 1, remaining_quantity: 1, cost_per_unit: 1, batch_number: 'TEST',
    is_opened: false
  }]);
  
  console.log("Insert Error:", insertErr);
}

testSchema();
