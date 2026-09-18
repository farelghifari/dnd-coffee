require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  // Querying the pg_proc catalog to get function source
  // Note: we can't do this easily with REST api because pg_proc is not exposed.
  // We can just try to fetch sales_logs schema to see if status is missing there, or inventory_batches.
  console.log("Checking sales_logs columns...");
  const { data: sData } = await supabase.from('sales_logs').select('*').limit(1);
  console.log("sales_logs cols:", sData ? Object.keys(sData[0] || {}) : "empty/error");

  console.log("Checking inventory_batches columns...");
  const { data: bData } = await supabase.from('inventory_batches').select('*').limit(1);
  console.log("inventory_batches cols:", bData ? Object.keys(bData[0] || {}) : "empty/error");
}
run();
