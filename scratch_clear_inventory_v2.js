
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearData() {
  console.log("Clearing inventory transactions...")
  await supabase.from('inventory_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log("Clearing inventory batches...")
  await supabase.from('inventory_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log("Resetting item stocks and daily usage to 0...")
  await supabase.from('inventory_items').update({ 
    stock: 0, 
    daily_usage: 0 
  }).neq('id', '00000000-0000-0000-0000-000000000000')

  console.log("Cleanup complete.")
}

clearData()
