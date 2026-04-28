require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const batchId = 'fd7581f7-75fc-4407-a3af-78de36c14a18'; // BEANS-20260427-040451
  
  // 1. Get batch
  const { data: batch } = await supabase.from('inventory_batches').select('*').eq('id', batchId).single();
  console.log("Current quantity:", batch.remaining_quantity);
  
  // 2. Try update
  const { error } = await supabase.from('inventory_batches')
    .update({ 
      remaining_quantity: batch.remaining_quantity - 1000,
      updated_at: new Date().toISOString() 
    })
    .eq('id', batchId);
    
  console.log("UPDATE ERROR:", JSON.stringify(error, null, 2));
}

run();
