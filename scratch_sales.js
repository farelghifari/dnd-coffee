require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('sales_logs').select('*').limit(1);
  console.log("ERROR:", JSON.stringify(error));
  if (data && data.length > 0) {
    console.log("COLUMNS:", Object.keys(data[0]));
  } else {
    // Insert a dummy row and rollback, or just get columns via rpc or something, or it might just give empty
    // But even if empty, the keys won't show.
    // Let's use standard REST API options to get columns
    const { data: d2, error: e2 } = await supabase.from('sales_logs').select('*');
    if (e2) console.error(e2);
    else console.log(d2);
  }
}
run();
