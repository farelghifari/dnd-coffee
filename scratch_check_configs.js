
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConfigs() {
  const { data, error } = await supabase.from('shift_configs').select('*')
  if (error) {
    console.error(error)
    return
  }
  console.log(JSON.stringify(data, null, 2))
}

checkConfigs()
