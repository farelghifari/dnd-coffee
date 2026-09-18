const url = "https://yffmcftmaddcmhwwsipp.supabase.co/rest/v1/shifts";
const empUrl = "https://yffmcftmaddcmhwwsipp.supabase.co/rest/v1/employees";
const key = "sb_publishable_ZYLHq7RpctIYFEoUhn1MCA_lzR0uXhV";

async function fix() {
  // Get Arya's actual UUID from employees table
  const empReq = await fetch(`${empUrl}?name=eq.Arya%20Arkananta%20Permana`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const emps = await empReq.json();
  
  if (!emps || emps.length === 0) {
    console.error("Could not find employee Arya Arkananta Permana");
    return;
  }
  
  const aryaId = emps[0].id;
  console.log("Arya's true UUID:", aryaId);

  // Insert the correct shift for today (Apr 17) 14:00 - 22:00
  const insertReq = await fetch(`${url}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      employee_id: aryaId,
      employee_name: "Arya Arkananta Permana", // Must match exactly
      date: "2026-04-17",
      start_time: "14:00",
      end_time: "22:00"
    })
  });
  
  if (insertReq.ok) {
    const res = await insertReq.json();
    console.log("Inserted Correct Shift:", res);
  } else {
    console.error("Failed to insert:", await insertReq.text());
  }
}

fix();
