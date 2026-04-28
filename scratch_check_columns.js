
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .limit(1)

  if (error) {
    console.error(error)
  } else if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]))
  } else {
    console.log("No data in inventory_transactions")
  }
}

checkColumns()
