
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env.local', 'utf8')
const lines = envContent.split('\n')
const env = {}
lines.forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  console.log('Checking inventory_transactions_view columns...')
  const { data, error } = await supabase.from('inventory_transactions_view').select('*').limit(1)
  if (error) console.log(`❌ View Error: ${error.message}`)
  else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]))
    console.log('Row:', data[0])
  } else {
    console.log('View exists but is EMPTY.')
  }
}

check()
