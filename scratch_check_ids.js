const { supabase, isSupabaseConfigured } = require('./lib/supabase');

async function checkIds() {
  const { data: sales } = await supabase.from('sales_logs').select('menu_id, menu_name').limit(5);
  const { data: recipes } = await supabase.from('menu_recipes').select('menu_item_id').limit(5);
  
  console.log("Sample Sales Menu IDs:", sales);
  console.log("Sample Recipe Menu Item IDs:", recipes);
}

checkIds();
