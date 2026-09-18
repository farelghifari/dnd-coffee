import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = readFileSync('.env.local', 'utf-8');
const urlMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envStr.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log("Checking inventory_transactions columns...");
  const { data: transData, error: transError } = await supabase
    .from('inventory_transactions')
    .select('*')
    .limit(1);
  
  if (transError) {
    console.error("Error fetching inventory_transactions:", transError);
  } else {
    console.log("Columns in inventory_transactions:", Object.keys(transData[0] || {}));
  }

  console.log("\nChecking inventory_items columns...");
  const { data: itemData, error: itemError } = await supabase
    .from('inventory_items')
    .select('*')
    .limit(1);
  
  if (itemError) {
    console.error("Error fetching inventory_items:", itemError);
  } else {
    console.log("Columns in inventory_items:", Object.keys(itemData[0] || {}));
  }
}

checkSchema();
