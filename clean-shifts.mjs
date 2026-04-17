const url = "https://yffmcftmaddcmhwwsipp.supabase.co/rest/v1/shifts";
const key = "sb_publishable_ZYLHq7RpctIYFEoUhn1MCA_lzR0uXhV";

async function clean() {
  const req = await fetch(`${url}?select=*&order=created_at.desc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  const data = await req.json();
  console.log("All Shifts:", data.map(s => ({id: s.id, emp: s.employee_name, date: s.date, time: s.start_time})));

  const map = new Map();
  const toDelete = [];

  for (const shift of data) {
    const k = `${shift.employee_id}_${shift.date}`;
    if (map.has(k)) {
      console.log(`Duplicate found for ${k}: ID ${shift.id} (${shift.start_time})`);
      toDelete.push(shift.id);
    } else {
      map.set(k, shift);
    }
  }

  console.log("To delete:", toDelete);

  for (const id of toDelete) {
    const delReq = await fetch(`${url}?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    console.log(`Deleted ${id}: ${delReq.status}`);
  }
}

clean();
