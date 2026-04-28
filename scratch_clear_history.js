require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('MISSING ENV VARS in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearHistory() {
  console.log('Clearing inventory_transactions...');
  // We can't delete without a filter in Supabase client by default, 
  // so we use a filter that matches everything.
  const { data, error } = await supabase
    .from('inventory_transactions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (error) {
    console.error('Error clearing data:', error);
  } else {
    console.log('Successfully cleared all movement history!');
  }
}

clearHistory();
