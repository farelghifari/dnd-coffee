
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function addColumn() {
  console.log("Attempting to add column 'exclude_from_costing' to 'monthly_opex'...")
  
  // Since we don't have a direct SQL tool, we try to insert a dummy row with the new column
  // If the column doesn't exist, it will error.
  // Actually, better to use an RPC if available.
  
  const { error } = await supabase.rpc('add_column_if_not_exists', {
    t_name: 'monthly_opex',
    c_name: 'exclude_from_costing',
    c_type: 'boolean'
  })
  
  if (error) {
    console.log("RPC failed, trying manual insert test...")
    const { error: insertErr } = await supabase.from('monthly_opex').insert({
       month: '2020-01-01',
       category: 'Other',
       amount: 0,
       exclude_from_costing: false
    }).select()
    
    if (insertErr && insertErr.message.includes('column "exclude_from_costing" of relation "monthly_opex" does not exist')) {
        console.error("Column does not exist and cannot be added automatically via JS.")
        console.log("Falling back to [EXCLUDE] prefix in notes.")
    } else {
        console.log("Column seems to exist or was added!")
    }
  } else {
    console.log("Column added via RPC!")
  }
}

addColumn()
