require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('menu_ingredients').select('*').limit(1);
  console.log("ERROR:", JSON.stringify(error));
  if (data && data.length > 0) {
    console.log("COLUMNS:", Object.keys(data[0]));
    console.log("SAMPLE DATA:", data[0]);
  } else {
    console.log("menu_ingredients is empty or error");
  }
}
run();
