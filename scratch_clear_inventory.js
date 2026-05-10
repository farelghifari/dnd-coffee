
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearData() {
  console.log("Clearing inventory transactions...")
  const { error: err1 } = await supabase.from('inventory_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (err1) console.error("Error clearing transactions:", err1)

  console.log("Clearing inventory batches...")
  const { error: err2 } = await supabase.from('inventory_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (err2) console.error("Error clearing batches:", err2)

  console.log("Resetting item stocks to 0...")
  const { error: err3 } = await supabase.from('inventory_items').update({ stock: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
  if (err3) console.error("Error resetting stocks:", err3)

  console.log("Cleanup complete.")
}

clearData()
