import { supabase } from './lib/supabase.js'

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'shifts' })
  if (error) {
    console.error('Error fetching table info:', error)
    // fallback: try a direct query to get one row and see the columns
    const { data: row, error: rowError } = await supabase.from('shifts').select('*').limit(1)
    if (rowError) {
      console.error('Error fetching row:', rowError)
    } else {
      console.log('Columns in shifts table:', Object.keys(row[0] || {}))
    }
  } else {
    console.log('Table info:', data)
  }
}

checkSchema()
