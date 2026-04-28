import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://yffmcftmaddcmhwwsipp.supabase.co"
const supabaseKey = "sb_publishable_ZYLHq7RpctIYFEoUhn1MCA_lzR0uXhV"
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugWaste() {
  const { data: wasteData, error } = await supabase
    .from('inventory_transactions')
    .select(`
      created_at,
      item_id,
      quantity,
      type,
      inventory_items(name, unit_cost)
    `)
    .eq('type', 'waste')

  if (error) {
    console.error(error)
    return
  }

  const logs = wasteData.map(log => ({
    name: log.inventory_items?.name,
    qty: log.quantity,
    cost: log.inventory_items?.unit_cost || 0,
    total: log.quantity * (log.inventory_items?.unit_cost || 0),
    at: log.created_at
  }))

  logs.sort((a, b) => b.total - a.total)

  console.log("=== TOP 10 LARGEST WASTE ENTRIES ===")
  logs.slice(0, 10).forEach(l => {
    console.log(`${l.at} | ${l.name} | Qty: ${l.qty} | Cost: ${l.cost} | TOTAL: Rp ${l.total.toLocaleString('id-ID')}`)
  })
}

debugWaste()
