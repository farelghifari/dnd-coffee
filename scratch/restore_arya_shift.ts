import { supabase } from './lib/supabase'

async function restore() {
  // 1. Find Arya
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')
    .ilike('name', '%Arya%')

  console.log("Employees found:", employees)

  if (!employees || employees.length === 0) {
    console.log("No Arya found")
    return
  }

  const arya = employees[0]
  const dateStr = '2026-04-20'

  // 2. Add the original shift (09:00 - 17:00)
  // We use insert now because I fixed addShiftAssignment to allow multiples, 
  // but let's do it directly via supabase for speed.
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert([
      {
        employee_id: arya.id,
        date: dateStr,
        start_time: '09:00:00',
        end_time: '17:00:00'
      }
    ])
    .select()

  if (error) {
    console.error("Error restoring shift:", error)
  } else {
    console.log("Shift restored:", shift)
  }
}

restore()
