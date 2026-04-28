
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase credentials missing!")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSeasonalItem() {
  console.log("=== SEASONSAL ITEM CHECK ===")
  
  // 1. Find the seasonal item
  const { data: items, error: itemError } = await supabase
    .from('inventory_items')
    .select('id, name, stock')
    .ilike('name', '%seasonal%')

  if (itemError) {
    console.error("Error fetching items:", itemError)
    return
  }

  if (items.length === 0) {
    console.log("No item found with 'seasonal' in name.")
    return
  }

  for (const item of items) {
    console.log(`\nItem: ${item.name} (ID: ${item.id})`)
    console.log(`Master Stock Column: ${item.stock}`)

    // 2. Find batches for this item
    const { data: batches, error: batchError } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', item.id)

    if (batchError) {
      console.error("Error fetching batches:", batchError)
      continue
    }

    console.log(`Total Batches Found: ${batches.length}`)
    
    const warehouseBatches = batches.filter(b => b.location === 'warehouse')
    console.log(`Warehouse Batches: ${warehouseBatches.length}`)
    
    const totalQty = warehouseBatches.reduce((sum, b) => sum + (b.remaining_quantity || 0), 0)
    console.log(`Total Remaining Qty in Warehouse: ${totalQty}`)

    console.log("\nDetails of Warehouse Batches:")
    warehouseBatches.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(b => {
      console.log(`- Batch: ${b.batch_number}, Qty: ${b.remaining_quantity}, Location: ${b.location}, Created: ${b.created_at}`)
    })
  }
}

checkSeasonalItem()
