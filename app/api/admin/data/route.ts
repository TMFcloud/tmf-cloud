import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();

    // 1. Fetch real physical miners from Equalizer inventory
    const { data: miners, error: minersError } = await supabase
      .from("equalizer_miners")
      .select("*")
      .order("miner_id", { ascending: true });

    // 2. Fetch real customer pool configs
    const { data: poolQueue, error: poolError } = await supabase
      .from("customer_pool_configs")
      .select("*, profiles:customer_id(full_name, email)")
      .order("created_at", { ascending: false });

    // 3. Fetch real worker identity registry
    const { data: workerRegistry, error: workerError } = await supabase
      .from("worker_identity_registry")
      .select("*")
      .order("created_at", { ascending: false });

    // 4. Fetch real miner detection logs
    const { data: detectionLogs, error: detectError } = await supabase
      .from("miner_detection_logs")
      .select("*, customer_pool_configs(*), profiles:customer_id(full_name, email)")
      .order("detected_at", { ascending: false });

    // 5. Fetch real miner allocations
    const { data: allocations, error: allocError } = await supabase
      .from("miner_allocations")
      .select("*, profiles:customer_id(full_name, email), equalizer_miners(*)")
      .order("allocated_at", { ascending: false });

    // 6. Fetch real equalizer sync history
    const { data: syncHistory, error: syncError } = await supabase
      .from("equalizer_sync_history")
      .select("*")
      .order("sync_started_at", { ascending: false })
      .limit(30);

    // 7. Fetch real detection activity feed
    const { data: activityFeed, error: activityError } = await supabase
      .from("detection_activity_feed")
      .select("*")
      .order("event_time", { ascending: false })
      .limit(50);

    // 8. Fetch real contracts with orders and customer info
    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select(`
        *,
        orders (*, pool_destinations (*)),
        profiles:customer_id (id, full_name, email, phone),
        miner_allocations (*, equalizer_miners (*))
      `)
      .order("created_at", { ascending: false });

    // 9. Fetch real orders (payments)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*, profiles:customer_id(id, full_name, email), pool_destinations(*)")
      .order("created_at", { ascending: false });

    // 10. Fetch real support tickets
    const { data: supportTickets, error: ticketsError } = await supabase
      .from("support_tickets")
      .select("*, profiles:customer_id(id, full_name, email)")
      .order("created_at", { ascending: false });

    // 11. Fetch real customers from profiles and auth.users
    let customersList: any[] = [];
    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      const authUsers = authData?.users || [];

      const { data: profilesList } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Merge auth users with profiles, strictly filtering out enterprise staff/admin accounts
      const clientAuthUsers = authUsers.filter((u) => {
        const email = (u.email || "").toLowerCase();
        const prof = (profilesList || []).find((p: any) => p.id === u.id);
        const isStaffEmail = email.endsWith("@theminingfuture.com") || email.endsWith("@themingfuture.com");
        const isStaffRole = prof?.role === "admin" || prof?.role === "superadmin" || prof?.role === "operations" || u.user_metadata?.role === "admin" || u.user_metadata?.role === "operations";
        return !isStaffEmail && !isStaffRole;
      });

      customersList = clientAuthUsers.map((u) => {
        const prof = (profilesList || []).find((p: any) => p.id === u.id) || {};
        const custContracts = (contracts || []).filter((c: any) => c.customer_id === u.id);
        const custOrders = (orders || []).filter((o: any) => o.customer_id === u.id);
        const totalSpent = custOrders
          .filter((o: any) => o.status === "PAID")
          .reduce((sum: number, o: any) => sum + (Number(o.total_usd) || 0), 0);

        return {
          id: u.id,
          email: u.email,
          full_name: prof.full_name || u.user_metadata?.full_name || u.email?.split("@")[0] || "Client",
          phone: prof.phone || u.user_metadata?.phone || "—",
          country: prof.country || "United Arab Emirates",
          role: prof.role || "customer",
          wallet_balance_usdt: Number(prof.wallet_balance_usdt || 0),
          email_confirmed: !!u.email_confirmed_at,
          email_confirmed_at: u.email_confirmed_at,
          banned_until: u.banned_until,
          account_status: u.banned_until ? "DISABLED" : (prof.account_status || "ACTIVE"),
          disabled_reason: prof.disabled_reason || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          contracts_count: custContracts.length,
          contracts: custContracts,
          orders_count: custOrders.length,
          orders: custOrders,
          total_spent_usd: totalSpent,
        };
      });
    } catch (authErr) {
      console.warn("Failed to list auth users via admin API:", authErr);
      // Fallback to profiles table alone, filtering out enterprise staff
      const { data: profilesList } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const clientProfiles = (profilesList || []).filter((p: any) => {
        const email = (p.email || "").toLowerCase();
        return !email.endsWith("@theminingfuture.com") && !email.endsWith("@themingfuture.com") && p.role !== "admin" && p.role !== "superadmin" && p.role !== "operations";
      });

      customersList = clientProfiles.map((p: any) => {
        const custContracts = (contracts || []).filter((c: any) => c.customer_id === p.id);
        const custOrders = (orders || []).filter((o: any) => o.customer_id === p.id);
        const totalSpent = custOrders
          .filter((o: any) => o.status === "PAID")
          .reduce((sum: number, o: any) => sum + (Number(o.total_usd) || 0), 0);

        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name || p.email?.split("@")[0] || "Client",
          phone: p.phone || "—",
          country: p.country || "United Arab Emirates",
          role: p.role || "customer",
          wallet_balance_usdt: Number(p.wallet_balance_usdt || 0),
          email_confirmed: true,
          account_status: p.account_status || "ACTIVE",
          disabled_reason: p.disabled_reason || null,
          created_at: p.created_at,
          last_sign_in_at: p.last_login_at,
          contracts_count: custContracts.length,
          contracts: custContracts,
          orders_count: custOrders.length,
          orders: custOrders,
          total_spent_usd: totalSpent,
        };
      });
    }

    // 12. Aggregate authoritative Key Performance Indicators (NO FAKE / DUMMY NUMBERS)
    const eqApiKey = process.env.EQUALIZER_API_KEY || process.env.SEGMENTS_EQUALIZER_API_KEY;
    const eqApiUrl = process.env.EQUALIZER_API_URL || process.env.SEGMENTS_EQUALIZER_BASE_URL;
    const isEqualizerConnected = Boolean(eqApiKey && eqApiUrl);
    const equalizerStatus = isEqualizerConnected ? "Connected" : "Disconnected";

    const resolvedMiners = miners || [];
    const totalMiners = resolvedMiners.length;
    const onlineMiners = resolvedMiners.filter((m: any) => m.status === "ONLINE").length;
    const offlineMiners = resolvedMiners.filter((m: any) => m.status === "OFFLINE").length;
    const allocatedMiners = resolvedMiners.filter((m: any) => m.allocation_status === "ALLOCATED").length;
    const unallocatedMiners = totalMiners - allocatedMiners;
    const totalConnectedHashrate = resolvedMiners.reduce(
      (acc: number, m: any) => acc + (m.status === "ONLINE" ? Number(m.hashrate_th || 0) : 0),
      0
    );

    const realContracts = contracts || [];
    const activeContracts = realContracts.filter((c: any) => c.status === "ACTIVE").length;
    const waitingToAssignContracts = realContracts.filter((c: any) => c.status === "WAITING_TO_ASSIGN").length;
    const completedContracts = realContracts.filter((c: any) => c.status === "COMPLETED" || c.status === "EXPIRED").length;
    const totalPurchasedHashrate = realContracts.reduce((sum: number, c: any) => sum + (Number(c.hashrate_th) || 0), 0);
    const totalLiveHashrate = realContracts
      .filter((c: any) => c.status === "ACTIVE")
      .reduce((sum: number, c: any) => sum + (Number(c.live_hashrate_th) || 0), 0);

    const realOrders = orders || [];
    const paidOrders = realOrders.filter((o: any) => o.status === "PAID");
    const pendingOrders = realOrders.filter((o: any) => o.status === "PENDING");
    const totalRevenueUsd = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.total_usd) || 0), 0);

    const verifiedUsersCount = customersList.filter((c) => c.email_confirmed).length;
    const unverifiedUsersCount = customersList.length - verifiedUsersCount;
    const enabledAccountsCount = customersList.filter((c) => c.account_status !== "DISABLED").length;
    const disabledAccountsCount = customersList.length - enabledAccountsCount;

    return NextResponse.json({
      success: true,
      kpis: {
        totalCustomers: customersList.length,
        verifiedUsersCount,
        unverifiedUsersCount,
        enabledAccountsCount,
        disabledAccountsCount,
        activeContracts,
        waitingToAssignContracts,
        completedContracts,
        totalPurchasedHashrate,
        totalLiveHashrate,
        totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
        paidOrdersCount: paidOrders.length,
        pendingOrdersCount: pendingOrders.length,
        totalMiners,
        onlineMiners,
        offlineMiners,
        allocatedMiners,
        unallocatedMiners,
        totalConnectedHashrate: Math.round(totalConnectedHashrate * 10) / 10,
        equalizerConnected: isEqualizerConnected,
        equalizerStatus,
        equalizerApiUrl: eqApiUrl || null,
        customersInQueue: (poolQueue || []).filter(
          (p: any) => p.configuration_status === "Configuration Pending" || p.configuration_status === "Configured in Equalizer"
        ).length,
        pendingWorkerMatches: (detectionLogs || []).filter((d: any) => d.match_status === "MATCH_FOUND").length,
      },
      miners: resolvedMiners,
      poolQueue: poolQueue || [],
      workerRegistry: workerRegistry || [],
      detectionLogs: detectionLogs || [],
      allocations: allocations || [],
      syncHistory: syncHistory || [],
      activityFeed: activityFeed || [],
      contracts: realContracts,
      orders: realOrders,
      supportTickets: supportTickets || [],
      customers: customersList,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Admin data fetch error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load admin data" },
      { status: 500 }
    );
  }
}
