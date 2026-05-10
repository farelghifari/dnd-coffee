
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
  const mapping = new Map() // old_id -> new_id
  const toDelete = []

  // Identify canonical IDs and duplicates
  for (const config of configs) {
    if (seen.has(config.name)) {
      const existing = seen.get(config.name)
      // Keep the one with an ID that might be in the current Settings view or just the newest one
      if (new Date(config.created_at || 0) > new Date(existing.created_at || 0)) {
        mapping.set(existing.id, config.id)
        toDelete.push(existing.id)
        seen.set(config.name, config)
      } else {
        mapping.set(config.id, existing.id)
        toDelete.push(config.id)
      }
    } else {
      seen.set(config.name, config)
    }
  }

  console.log("Groups identified. Updating shifts referencing duplicate IDs...")

  for (const [oldId, newId] of mapping.entries()) {
    const { data, error: updError } = await supabase
      .from('shifts')
      .update({ shift_config_id: newId })
      .eq('shift_config_id', oldId)
    
    if (updError) {
      console.error(`Error updating shifts from ${oldId} to ${newId}:`, updError)
    } else {
      console.log(`Updated shifts: ${oldId} -> ${newId}`)
    }
  }

  console.log("Deleting duplicate configs...")
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
