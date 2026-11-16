/**
 * TMF CLOUD MINING: MINER ALLOCATION & APPROVAL ENGINE
 * 
 * Handles Admin Approval of matched miners:
 * 1. Confirms admin authorization.
 * 2. Prevents duplicate allocation of already allocated miners.
 * 3. Creates immutable allocation record.
 * 4. Transitions customer contract to ACTIVE.
 * 5. Updates activity feed and audit logs.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface AllocationApprovalInput {
  minerId: string;
  contractId?: string;
  customerId: string;
  adminId: string;
  notes?: string;
}

export interface AllocationApprovalResult {
  success: boolean;
  allocationId?: string;
  contractId?: string;
  customerStatus: string;
  totalAllocatedHashrateTh: number;
  message: string;
}

export async function approveAndAllocateMiner(
  supabase: SupabaseClient,
  input: AllocationApprovalInput
): Promise<AllocationApprovalResult> {
  const { minerId, customerId, adminId, notes } = input;

  // 1. Fetch miner details and verify existence
  const { data: miner, error: minerError } = await supabase
    .from("equalizer_miners")
    .select("*")
    .eq("miner_id", minerId)
    .single();

  if (minerError || !miner) {
    throw new Error(`Miner ${minerId} not found in Equalizer inventory.`);
  }

  // 2. Prevent duplicate allocation: verify miner is not already ACTIVE
  const { data: existingActiveAlloc } = await supabase
    .from("miner_allocations")
    .select("id, contract_id, customer_id")
    .eq("miner_id", minerId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existingActiveAlloc) {
    throw new Error(
      `Miner ${minerId} is already actively allocated to contract ${existingActiveAlloc.contract_id}. Duplicate allocation prohibited.`
    );
  }

  // 3. Resolve customer's active contract
  let contractId = input.contractId;
  if (!contractId) {
    // Find contract waiting to assign or matching customer
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, hashrate_th, duration_days")
      .eq("customer_id", customerId)
      .in("status", ["WAITING_TO_ASSIGN", "ACTIVE"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    contractId = contract?.id;
  }

  if (!contractId) {
    // If no contract row exists yet, create one from customer_pool_configs
    const { data: poolCfg } = await supabase
      .from("customer_pool_configs")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (poolCfg) {
      const { data: newContract } = await supabase
        .from("contracts")
        .insert({
          customer_id: customerId,
          hashrate_th: poolCfg.purchased_hashrate_th || 200,
          duration_days: 30,
          status: "ACTIVE",
          live_hashrate_th: miner.hashrate_th,
          worker_status: "ONLINE",
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        })
        .select("id")
        .single();

      contractId = newContract?.id;
    }
  }

  if (!contractId) {
    throw new Error(`No eligible contract found for customer ${customerId} to assign miner ${minerId}.`);
  }

  const now = new Date().toISOString();

  // 4. Create Miner Allocation Record
  const { data: allocation, error: allocError } = await supabase
    .from("miner_allocations")
    .insert({
      contract_id: contractId,
      customer_id: customerId,
      miner_id: minerId,
      allocated_hashrate_th: miner.hashrate_th,
      allocated_by: adminId,
      allocated_at: now,
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (allocError) {
    throw new Error(`Failed to create miner allocation: ${allocError.message}`);
  }

  // 5. Update equalizer_miners record
  await supabase
    .from("equalizer_miners")
    .update({
      allocation_status: "ALLOCATED",
      allocated_contract_id: contractId,
      allocated_customer_id: customerId,
      allocated_at: now,
      updated_at: now,
    })
    .eq("miner_id", minerId);

  // 6. Update miner_detection_logs
  await supabase
    .from("miner_detection_logs")
    .update({
      match_status: "APPROVED",
      reviewed_by: adminId,
      approved_at: now,
      notes: notes || "Admin confirmed and allocated miner to customer contract.",
    })
    .eq("equalizer_miner_id", minerId)
    .eq("match_status", "MATCH_FOUND");

  // 7. Update customer_pool_configs
  await supabase
    .from("customer_pool_configs")
    .update({
      configuration_status: "Active",
      configured_at: now,
      configured_by: adminId,
      updated_at: now,
    })
    .eq("customer_id", customerId);

  // 8. Update contract status to ACTIVE & set live hashrate
  // Calculate total allocated hashrate for this contract
  const { data: allContractAllocs } = await supabase
    .from("miner_allocations")
    .select("allocated_hashrate_th")
    .eq("contract_id", contractId)
    .eq("status", "ACTIVE");

  const totalAllocatedHashrate = (allContractAllocs || []).reduce(
    (acc, curr) => acc + Number(curr.allocated_hashrate_th || 0),
    0
  );

  const durationDays = 30;
  await supabase
    .from("contracts")
    .update({
      status: "ACTIVE",
      assigned_by: adminId,
      assigned_at: now,
      start_date: now,
      end_date: new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString(),
      live_hashrate_th: totalAllocatedHashrate,
      worker_status: "ONLINE",
      last_stats_update: now,
      updated_at: now,
    })
    .eq("id", contractId);

  // 9. Append to detection_activity_feed
  await supabase.from("detection_activity_feed").insert([
    {
      event_type: "ALLOCATION_APPROVED",
      miner_id: minerId,
      customer_id: customerId,
      worker_name: miner.worker_name,
      message: `Allocation approved by admin for ${minerId} (${miner.hashrate_th} TH/s)`,
    },
    {
      event_type: "STATUS_UPDATED",
      miner_id: minerId,
      customer_id: customerId,
      worker_name: miner.worker_name,
      message: `Customer mining status updated: MINING ACTIVE (Total: ${totalAllocatedHashrate} TH/s)`,
    },
  ]);

  // 10. Audit Log
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action: "APPROVE_MINER_ALLOCATION",
    target_entity: "miner_allocations",
    target_id: allocation.id,
    details: {
      miner_id: minerId,
      contract_id: contractId,
      customer_id: customerId,
      allocated_hashrate_th: miner.hashrate_th,
      total_contract_hashrate_th: totalAllocatedHashrate,
      notes,
    },
  });

  return {
    success: true,
    allocationId: allocation.id,
    contractId,
    customerStatus: "MINING ACTIVE",
    totalAllocatedHashrateTh: totalAllocatedHashrate,
    message: `Miner ${minerId} successfully approved and allocated. Customer mining is now ACTIVE.`,
  };
}
