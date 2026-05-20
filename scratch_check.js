require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('id, batch_number, quantity, remaining_quantity, cost_per_unit, item_id')
    .order('created_at', { ascending: false })
    .limit(30);
  console.log("ERROR:", error);
  console.table(data);
}
run();
