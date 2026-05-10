
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupConfigs() {
  const { data: configs, error } = await supabase.from('shift_configs').select('*')
  if (error) {
    console.error(error)
    return
  }

  const seen = new Map()
  const toDelete = []

  // Group by name and keep the newest one
  for (const config of configs) {
    if (seen.has(config.name)) {
      const existing = seen.get(config.name)
      if (new Date(config.created_at || 0) > new Date(existing.created_at || 0)) {
        toDelete.push(existing.id)
        seen.set(config.name, config)
      } else {
        toDelete.push(config.id)
      }
    } else {
      seen.set(config.name, config)
    }
  }

  // Also delete anything beyond Shift 4 if the user says they only want 4
  for (const [name, config] of seen.entries()) {
    const num = parseInt(name.split(' ').pop())
    if (num > 4) {
      toDelete.push(config.id)
      seen.delete(name)
    }
  }

  console.log("Unique configs kept:", Array.from(seen.keys()))
  console.log("IDs to delete:", toDelete)

  if (toDelete.length > 0) {
    const { error: delError } = await supabase.from('shift_configs').delete().in('id', toDelete)
    if (delError) {
      console.error("Error deleting duplicates:", delError)
    } else {
      console.log("Successfully cleaned up duplicates.")
    }
  } else {
    console.log("No duplicates found.")
  }
}

cleanupConfigs()
