import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://yffmcftmaddcmhwwsipp.supabase.co"
const supabaseKey = "sb_publishable_ZYLHq7RpctIYFEoUhn1MCA_lzR0uXhV"
const supabase = createClient(supabaseUrl, supabaseKey)

async function executeCustomCleanup() {
  console.log("Starting custom cleanup to retain current low stocks but remove waste records...")

  // 1. Mayo
  console.log("Updating Mayo to 1000...")
  await supabase.from('inventory_items').update({ stock: 1000 }).eq('id', '1706edf1-fc9c-4efb-bc2a-bc65c835e3cd')
  await supabase.from('inventory_batches').update({ quantity: 1000, remaining_quantity: 1000 }).eq('id', 'df0dd0b9-e7fe-4ec6-8092-010d4812b3be')
  await supabase.from('inventory_transactions').update({ quantity: 1000 }).eq('id', '6315b078-a36d-484f-a343-324efb59961a')
  await supabase.from('inventory_opname').update({ actual_stock: 1000, difference: 1000 }).eq('id', '3302c29a-d7c8-4561-b023-c4875c781a53')

  // 2. Saus Sambal
  console.log("Updating Saus Sambal to 500...")
  await supabase.from('inventory_items').update({ stock: 500 }).eq('id', 'dc9271ba-3118-46b1-8c06-5b51fdd67a30')
  await supabase.from('inventory_batches').update({ quantity: 500, remaining_quantity: 500 }).eq('id', '5824590b-aa26-4c97-9501-d2220646b6ef')
  await supabase.from('inventory_transactions').update({ quantity: 500 }).eq('id', '2892edfe-b91e-4ae0-8eb5-1558476d89b1')
  await supabase.from('inventory_opname').update({ actual_stock: 500, difference: 500 }).eq('id', 'a7086bd1-641f-4c69-b8ba-26158a231529')

  // 3. Oat Milk
  console.log("Updating Oat Milk to 5...")
  await supabase.from('inventory_items').update({ stock: 5 }).eq('id', '31e53eda-8d58-471c-83b9-978fc7f25645')
  await supabase.from('inventory_batches').update({ quantity: 5, remaining_quantity: 5 }).eq('id', '9f07a54b-1c4b-4b28-b421-048b36a80b00')
  await supabase.from('inventory_transactions').delete().eq('id', '89a49d29-be74-4264-bc6e-5ac8f7b4a5b3')
  await supabase.from('inventory_opname').delete().eq('id', '8e8f37a0-269d-463e-b5be-3ea3f4e7c454')

  // 4. Cup Sementara
  console.log("Updating Cup Sementara to 16...")
  await supabase.from('inventory_items').update({ stock: 16 }).eq('id', 'ed6ba8d3-bbcc-48cc-8b98-00132967da2e')
  await supabase.from('inventory_batches').update({ quantity: 16, remaining_quantity: 16 }).eq('id', 'e96688ea-25b9-4594-a6ee-5a70d0ee67d5')
  await supabase.from('inventory_transactions').delete().eq('id', '76f7bed1-b06f-4e26-b693-3baf87e568d7')
  await supabase.from('inventory_opname').delete().eq('id', 'f8256aea-8c63-4704-bc50-3f11f1d99d84')

  console.log("Custom cleanup completed successfully.")
}

executeCustomCleanup()
