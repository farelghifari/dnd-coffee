import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanShifts() {
  const { data, error } = await supabase.from('shifts').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  
  if (!data) return;
  
  console.log("ALL SHIFTS:", data);
  
  // Find duplicates
  const map = new Map();
  const toDelete = [];
  
  for (const shift of data) {
    const key = `${shift.employee_id}_${shift.date}`;
    if (map.has(key)) {
      console.log(`Found duplicate shift for ${key}:`, shift);
      // Delete the OLDER one, assuming we ordered by created_at DESC, so the first one we see is the newest.
      toDelete.push(shift.id);
    } else {
      map.set(key, shift);
    }
  }
  
  console.log("Will delete IDs:", toDelete);
  
  if (toDelete.length > 0) {
    for (const id of toDelete) {
      const { error: delErr } = await supabase.from('shifts').delete().eq('id', id);
      if (delErr) {
        console.error("Delete error:", delErr);
      } else {
        console.log(`Deleted shift ${id}`);
      }
    }
  }
}

cleanShifts();
