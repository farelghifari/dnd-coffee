// Transfer from Warehouse to Floor (Stock Out to Bar)
export async function transferToFloor(batchId: string, quantity: number, actorName: string, reason?: string, splitSize?: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    console.log("Executing manual JS transfer to floor with FIFO overflow...");
    
    // 1. Get initial context to find item_id
    const { data: initialBatch } = await supabase.from('inventory_batches').select('*').eq('id', batchId).single();
    if (!initialBatch) return false;
    const itemId = initialBatch.item_id;

    // 2. Get warehouse batches (ordered by FIFO)
    const { data: warehouseBatches, error: batchErr } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .eq('location', 'warehouse')
      .gt('remaining_quantity', 0)
      .order('received_date', { ascending: true })
      .order('batch_number', { ascending: true });

    if (batchErr || !warehouseBatches || warehouseBatches.length === 0) {
      console.error("No batches found for transfer", batchErr);
      return false;
    }

    // Find the starting index (the selected batch)
    let startIndex = warehouseBatches.findIndex(b => b.id === batchId);
    if (startIndex === -1) startIndex = 0; // Fallback to oldest if not found

    let remainingToTransfer = quantity;
    let totalDeducted = 0;
    const sourceBatches = []; // Store batches we took from

    for (let i = startIndex; i < warehouseBatches.length; i++) {
      if (remainingToTransfer <= 0) break;
      const b = warehouseBatches[i];
      const deduct = Math.min(b.remaining_quantity, remainingToTransfer);
      
      const { error: updErr } = await supabase
        .from('inventory_batches')
        .update({ remaining_quantity: b.remaining_quantity - deduct })
        .eq('id', b.id);
      
      if (updErr) {
        console.error("Failed to deduct from batch", b.id, updErr);
        return false;
      }

      remainingToTransfer -= deduct;
      totalDeducted += deduct;
      sourceBatches.push({ ...b, deducted: deduct });
    }

    // 3. Waste old floor batches (Auto-waste)
    const { data: floorBatches } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .eq('location', 'floor')
      .gt('remaining_quantity', 0);
      
    if (floorBatches && floorBatches.length > 0) {
      for (const old of floorBatches) {
        await supabase.from('inventory_transactions').insert({
          item_id: itemId,
          type: 'waste',
          quantity: old.remaining_quantity,
          waste_reason: `Auto-waste: ${reason || 'Diganti stok baru'}`,
          actor_name: actorName
        });
        await supabase.from('inventory_batches').update({ remaining_quantity: 0 }).eq('id', old.id);
      }
    }

    // 4. Update master stock
    const { error: stockErr } = await supabase.rpc('decrement_inventory_stock', { p_item_id: itemId, p_quantity: totalDeducted });
    if (stockErr) {
      const { data: item } = await supabase.from('inventory_items').select('stock').eq('id', itemId).single();
      if (item) {
        await supabase.from('inventory_items').update({ stock: Math.max(0, (item.stock || 0) - totalDeducted), last_updated: new Date().toISOString() }).eq('id', itemId);
      }
    }

    // 5. Create new floor batch(es)
    // We use the attributes of the FIRST batch we took from for the new floor batch
    const mainBatch = sourceBatches[0];
    let chunks = [];
    if (splitSize && splitSize > 0 && totalDeducted > splitSize) {
      const numFullChunks = Math.floor(totalDeducted / splitSize);
      const remainder = totalDeducted % splitSize;
      for (let i = 0; i < numFullChunks; i++) chunks.push(splitSize);
      if (remainder > 0) chunks.push(remainder);
    } else {
      chunks.push(totalDeducted);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkQty = chunks[i];
      await supabase.from('inventory_batches').insert({
        item_id: itemId,
        quantity: chunkQty,
        remaining_quantity: chunkQty,
        cost_per_unit: mainBatch.cost_per_unit,
        supplier_name: (mainBatch.supplier_name && !mainBatch.supplier_name.includes('General Supplier')) ? mainBatch.supplier_name : 'Unknown',
        received_date: mainBatch.received_date,
        expired_date: mainBatch.expired_date,
        batch_number: (mainBatch.batch_number || '').substring(0, 16) + (chunks.length > 1 ? `-${i+1}` : 'F'),
        is_opened: true,
        location: 'floor'
      });
    }

    // 6. Log transaction
    await supabase.from('inventory_transactions').insert({
      item_id: itemId,
      type: 'out',
      quantity: totalDeducted,
      actor_name: actorName,
      notes: `Transfer to Bar: ${mainBatch.batch_number} (FIFO Overflow used ${sourceBatches.length} batches)`
    });

    return true;
  } catch (err) {
    console.error("CRITICAL ERROR (transferToFloor):", err);
    return false;
  }
}

// Manual Stock Out (Waste, Damage, etc.) with FIFO Overflow
export async function stockOutManual(
  batchId: string, 
  quantity: number, 
  reason: string,
  actorName: string = 'System'
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { data: initialBatch } = await supabase.from('inventory_batches').select('*').eq('id', batchId).single();
    if (!initialBatch) return false;
    const itemId = initialBatch.item_id;

    const { data: batches, error: batchErr } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .eq('location', 'warehouse')
      .gt('remaining_quantity', 0)
      .order('received_date', { ascending: true })
      .order('batch_number', { ascending: true });

    if (batchErr || !batches) return false;

    let startIndex = batches.findIndex(b => b.id === batchId);
    if (startIndex === -1) startIndex = 0;

    let remainingToDeduct = quantity;
    let totalDeducted = 0;

    for (let i = startIndex; i < batches.length; i++) {
      if (remainingToDeduct <= 0) break;
      const b = batches[i];
      const deduct = Math.min(b.remaining_quantity, remainingToDeduct);
      
      await supabase.from('inventory_batches').update({ remaining_quantity: b.remaining_quantity - deduct }).eq('id', b.id);
      
      await supabase.from('inventory_transactions').insert({
        item_id: itemId,
        type: 'waste',
        quantity: deduct,
        waste_reason: reason,
        actor_name: actorName,
        notes: `Deducted from batch ${b.batch_number}`
      });

      remainingToDeduct -= deduct;
      totalDeducted += deduct;
    }

    // Update master stock
    const { error: stockErr } = await supabase.rpc('decrement_inventory_stock', { p_item_id: itemId, p_quantity: totalDeducted });
    if (stockErr) {
       const { data: item } = await supabase.from('inventory_items').select('stock').eq('id', itemId).single();
       if (item) {
         await supabase.from('inventory_items').update({ stock: Math.max(0, (item.stock || 0) - totalDeducted), last_updated: new Date().toISOString() }).eq('id', itemId);
       }
    }

    return true;
  } catch (err) {
    console.error("CRITICAL ERROR (stockOutManual):", err);
    return false;
  }
}
