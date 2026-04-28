
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function dumpTransactions() {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*, inventory_items(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error(error)
  } else {
    data.forEach(t => {
      console.log(`[${t.created_at}] TYPE: ${t.type} | ITEM: ${t.inventory_items?.name} | QTY: ${t.quantity} | REASON: ${t.waste_reason} | NOTES: ${t.notes}`)
    })
  }
}

dumpTransactions()
