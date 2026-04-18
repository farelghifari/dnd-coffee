import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.*)/);

const supabase = createClient(
  urlMatch[1].replace(/"/g, '').trim(), 
  keyMatch[1].replace(/"/g, '').trim()
);

async function restoreLogs() {
  console.log("Fetching all inventory items with stock > 0...");
  const { data: items, error: itemErr } = await supabase.from('inventory_items').select('*').gt('stock', 0);
  
  if (itemErr) {
    console.log("Error fetching items:", itemErr);
    return;
  }
  
  console.log(`Found ${items.length} items with positive stock.`);
  let added = 0;

  for (const item of items) {
    // Check if it already has transactions
    const { data: txs } = await supabase.from('inventory_transactions').select('*').eq('item_id', item.id);
    if (!txs || txs.length === 0) {
      console.log(`Item ${item.name} has no logs. Creating 'in' log for ${item.stock} amount...`);
      
      const { error: insertErr } = await supabase.from('inventory_transactions').insert([{
        item_id: item.id,
        type: 'in',
        quantity: item.stock,
        employee_id: null // System/Admin restore
      }]);

      if (insertErr) {
        console.log(`Failed to restore log for ${item.name}:`, insertErr);
      } else {
        added++;
        
        // Also ensure a batch exists for this stock so opname can work!
        const { data: batches } = await supabase.from('inventory_batches').select('*').eq('item_id', item.id);
        if (!batches || batches.length === 0) {
           await supabase.from('inventory_batches').insert([{
             item_id: item.id,
             quantity: item.stock,
             remaining_quantity: item.stock,
             cost_per_unit: item.unit_cost || 0,
             batch_number: `RESTORE-${new Date().getTime().toString().slice(-6)}`,
             notes: 'Restored from previous state'
           }]);
        }
      }
    }
  }

  console.log(`Restore complete. Inserted ${added} missing logs.`);
}

restoreLogs();
