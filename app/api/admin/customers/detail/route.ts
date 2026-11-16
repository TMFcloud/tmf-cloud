import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchEqualizerMinerTelemetry } from "@/lib/services/equalizer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "customerId parameter is required." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Fetch Auth User Record (for authentic registration, email verification, and last sign in)
    let authUser: any = null;
    try {
      const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(customerId);
      if (!userErr && userRes?.user) {
        authUser = userRes.user;
      }
    } catch (e) {
      console.warn("Could not fetch auth user:", e);
    }

    // 2. Fetch Customer Profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .single();

    if (!profile && !authUser) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    // 3. Fetch Orders
    const { data: orders = [] } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    // 4. Fetch Contracts
    const { data: contracts = [] } = await supabase
      .from("contracts")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    // 5. Fetch Customer Pool Configurations
    const { data: poolConfigs = [] } = await supabase
      .from("customer_pool_configs")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    // 6. Fetch Miner Allocations
    const { data: allocations = [] } = await supabase
      .from("miner_allocations")
      .select("*")
      .eq("customer_id", customerId)
      .order("allocated_at", { ascending: false });

    // 7. Fetch Support Tickets & Messages
    const { data: tickets = [] } = await supabase
      .from("support_tickets")
      .select("*, support_messages(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    // 8. Fetch Admin Audit Logs (Notes, Adjustments, Status Changes)
    const { data: auditLogs = [] } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("target_id", customerId)
      .order("created_at", { ascending: false });

    // 9. Fetch Equalizer Telemetry Status (Strictly Real, Never Fabricated)
    const eqTelemetry = await fetchEqualizerMinerTelemetry();
    const isEqualizerConnected = eqTelemetry.isConfigured && eqTelemetry.success;

    // Build Authoritative Customer Info
    const email = authUser?.email || profile?.email || "—";
    const fullName = profile?.full_name || authUser?.user_metadata?.full_name || email.split("@")[0] || "Valued Client";
    const isEmailVerified = Boolean(authUser?.email_confirmed_at);
    const emailConfirmedAt = authUser?.email_confirmed_at || null;
    const isAccountDisabled = Boolean(authUser?.banned_until) || profile?.account_status === "DISABLED";
    const accountStatus = isAccountDisabled ? "DISABLED" : "ACTIVE";
    const registrationDate = authUser?.created_at || profile?.created_at || new Date().toISOString();
    const lastLoginAt = authUser?.last_sign_in_at || profile?.last_login_at || null;
    const walletBalance = Number(profile?.wallet_balance_usdt || 0);

    // Filter paid orders vs pending
    const paidOrders = (orders || []).filter((o: any) => o.status === "PAID" || o.payment_status === "finished" || o.payment_status === "confirmed");
    const totalSpentUsd = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.total_usd) || 0), 0);

    // Hashrate Calculations (Distinguishing Purchased, Allocated, and Pool-Reported)
    const totalPurchasedHashrateTh = (orders || [])
      .filter((o: any) => o.status === "PAID")
      .reduce((sum: number, o: any) => sum + (Number(o.hashrate_th) || 0), 0);

    const activeContracts = (contracts || []).filter((c: any) => c.status === "ACTIVE");
    const waitingContracts = (contracts || []).filter((c: any) => c.status === "WAITING_TO_ASSIGN");
    const completedContracts = (contracts || []).filter((c: any) => c.status === "COMPLETED" || c.status === "EXPIRED");

    const totalAllocatedHashrateTh = activeContracts.reduce((sum: number, c: any) => sum + (Number(c.hashrate_th) || 0), 0);

    // Pool-reported hashrate (from active contracts live_hashrate_th if reported by poller)
    let poolReportedHashrateTh = 0;
    let hashrate24hAvgTh = 0;
    let hashrateDataSource = isEqualizerConnected ? "Segments Equalizer Telemetry" : "Data unavailable (Equalizer Disconnected)";

    if (isEqualizerConnected && activeContracts.length > 0) {
      poolReportedHashrateTh = activeContracts.reduce((sum: number, c: any) => sum + (Number(c.live_hashrate_th) || 0), 0);
      hashrate24hAvgTh = activeContracts.reduce((sum: number, c: any) => sum + (Number(c.average_24h_hashrate_th) || 0), 0);
    }

    // 10. Synthesize 360° Chronological Timeline Events
    const rawEvents: any[] = [];

    // Event: Account Registered
    rawEvents.push({
      id: `evt-reg-${customerId}`,
      eventType: "ACCOUNT_REGISTERED",
      category: "Account",
      title: "Account Registered",
      description: `Customer account registered on TMF Cloud Portal (${email}).`,
      timestamp: registrationDate,
      status: "COMPLETED",
      source: "Supabase Auth",
      referenceId: customerId,
      metadata: {
        email,
        fullName,
        source: authUser?.app_metadata?.provider || "Email Registration",
      },
    });

    // Event: Email Verified (if confirmed)
    if (isEmailVerified && emailConfirmedAt) {
      rawEvents.push({
        id: `evt-verify-${customerId}`,
        eventType: "EMAIL_VERIFIED",
        category: "Account",
        title: "Email Address Verified",
        description: `Email identity confirmed via authentication verification.`,
        timestamp: emailConfirmedAt,
        status: "COMPLETED",
        source: "Supabase Auth",
        referenceId: customerId,
        metadata: {
          email,
          verifiedAt: emailConfirmedAt,
        },
      });
    }

    // Events from Pool Configurations
    (poolConfigs || []).forEach((cfg: any) => {
      rawEvents.push({
        id: `evt-pool-${cfg.id}`,
        eventType: "PACKAGE_SELECTED",
        category: "Purchase",
        title: `Mining Package & Worker Generated (${cfg.purchased_hashrate_th} TH/s)`,
        description: `Worker identifier "${cfg.generated_worker_name}" provisioned for destination pool ${cfg.pool_provider}.`,
        timestamp: cfg.created_at,
        status: "COMPLETED",
        source: "Pool Orchestrator",
        referenceId: cfg.id,
        metadata: {
          poolProvider: cfg.pool_provider,
          poolUrl: cfg.pool_url,
          workerName: cfg.generated_worker_name,
          hashrateTh: cfg.purchased_hashrate_th,
          orderId: cfg.order_id,
        },
      });

      if (cfg.configured_at) {
        rawEvents.push({
          id: `evt-pool-cfg-${cfg.id}`,
          eventType: "HASH_RATE_ASSIGNED",
          category: "Allocation",
          title: "Hashrate Assigned in Equalizer",
          description: `Worker ${cfg.generated_worker_name} synced to Equalizer facility stratum configuration.`,
          timestamp: cfg.configured_at,
          status: "COMPLETED",
          source: "Segments Equalizer",
          referenceId: cfg.id,
          metadata: {
            configuredBy: cfg.configured_by,
            workerName: cfg.generated_worker_name,
          },
        });
      }
    });

    // Events from Orders & Payments
    (orders || []).forEach((order: any) => {
      // Order Created
      rawEvents.push({
        id: `evt-order-created-${order.id}`,
        eventType: "PURCHASE_CREATED",
        category: "Purchase",
        title: `Cloud Mining Order Placed (#${order.id.slice(0, 8)})`,
        description: `Order created for ${order.hashrate_th} TH/s compute over ${order.duration_days} days. Total: $${Number(order.total_usd).toFixed(2)} USD.`,
        timestamp: order.created_at,
        status: "COMPLETED",
        source: "Checkout Engine",
        referenceId: order.id,
        orderId: order.id,
        metadata: {
          orderId: order.id,
          hashrateTh: order.hashrate_th,
          durationDays: order.duration_days,
          totalUsd: order.total_usd,
          currency: order.payment_currency,
        },
      });

      // Payment Initiated
      if (order.nowpayments_payment_id || order.pay_address) {
        rawEvents.push({
          id: `evt-pay-init-${order.id}`,
          eventType: "PAYMENT_INITIATED",
          category: "Payment",
          title: `Payment Invoice Generated (${order.payment_currency})`,
          description: `NOWPayments gateway checkout initialized for order #${order.id.slice(0, 8)}. Payment ID: ${order.nowpayments_payment_id || "sandbox"}.`,
          timestamp: order.created_at,
          status: order.status === "PAID" ? "COMPLETED" : "PENDING",
          source: "NOWPayments Gateway",
          referenceId: order.nowpayments_payment_id || order.id,
          orderId: order.id,
          metadata: {
            paymentId: order.nowpayments_payment_id,
            payAddress: order.pay_address,
            payAmount: order.pay_amount,
            currency: order.payment_currency,
            status: order.payment_status,
          },
        });
      }

      // Payment Confirmed
      if (order.status === "PAID" || order.payment_status === "finished" || order.payment_status === "confirmed") {
        rawEvents.push({
          id: `evt-pay-confirm-${order.id}`,
          eventType: "PAYMENT_CONFIRMED",
          category: "Payment",
          title: `Payment Confirmed & Verified ($${Number(order.total_usd).toFixed(2)})`,
          description: `NOWPayments IPN cryptographic webhook verified payment. Funds settled.`,
          timestamp: order.ipn_verified_at || order.updated_at || order.created_at,
          status: "COMPLETED",
          source: "NOWPayments Webhook",
          referenceId: order.nowpayments_payment_id || order.id,
          orderId: order.id,
          metadata: {
            paymentId: order.nowpayments_payment_id,
            amountUsd: order.total_usd,
            currency: order.payment_currency,
            ipnVerifiedAt: order.ipn_verified_at,
          },
        });
      } else if (order.status === "FAILED" || order.status === "CANCELLED") {
        rawEvents.push({
          id: `evt-pay-fail-${order.id}`,
          eventType: "PAYMENT_FAILED",
          category: "Payment",
          title: `Order ${order.status}`,
          description: `Payment was not completed within the validity window or was marked ${order.status}.`,
          timestamp: order.updated_at || order.created_at,
          status: "FAILED",
          source: "NOWPayments Gateway",
          referenceId: order.id,
          orderId: order.id,
          metadata: {
            orderId: order.id,
            status: order.status,
          },
        });
      }
    });

    // Events from Contracts
    (contracts || []).forEach((c: any) => {
      // Allocation Pending
      if (c.status === "WAITING_TO_ASSIGN") {
        rawEvents.push({
          id: `evt-alloc-wait-${c.id}`,
          eventType: "ALLOCATION_PENDING",
          category: "Allocation",
          title: "Hardware Allocation Pending",
          description: `Payment settled. Contract for ${c.hashrate_th} TH/s is queued waiting for operations admin to assign physical ASIC compute.`,
          timestamp: c.created_at,
          status: "PENDING",
          source: "Operations Dispatcher",
          referenceId: c.id,
          contractId: c.id,
          metadata: {
            contractId: c.id,
            hashrateTh: c.hashrate_th,
            durationDays: c.duration_days,
          },
        });
      }

      // Allocation Started
      if (c.assigned_at) {
        rawEvents.push({
          id: `evt-alloc-start-${c.id}`,
          eventType: "ALLOCATION_STARTED",
          category: "Allocation",
          title: `Physical ASIC Assigned (${c.equalizer_worker_id || "Hardware Node"})`,
          description: `Physical miner assigned by operations desk. Equalizer stratum dispatch configured.`,
          timestamp: c.assigned_at,
          status: "COMPLETED",
          source: "Operations Admin",
          referenceId: c.id,
          contractId: c.id,
          metadata: {
            assignedBy: c.assigned_by,
            workerId: c.equalizer_worker_id,
            contractId: c.id,
          },
        });
      }

      // Contract Activated
      if (c.status === "ACTIVE" && c.start_date) {
        rawEvents.push({
          id: `evt-contract-active-${c.id}`,
          eventType: "CONTRACT_ACTIVATED",
          category: "Contract",
          title: `Contract Activated (${c.hashrate_th} TH/s Mining Live)`,
          description: `Real-time countdown timer initialized. Contract expires on ${c.end_date ? new Date(c.end_date).toLocaleDateString() : "duration completion"}.`,
          timestamp: c.start_date,
          status: "COMPLETED",
          source: "Lifecycle Clock",
          referenceId: c.id,
          contractId: c.id,
          metadata: {
            contractId: c.id,
            hashrateTh: c.hashrate_th,
            startDate: c.start_date,
            endDate: c.end_date,
            durationDays: c.duration_days,
          },
        });
      }

      // Contract Expired / Completed
      if (c.status === "COMPLETED" || c.status === "EXPIRED") {
        rawEvents.push({
          id: `evt-contract-expired-${c.id}`,
          eventType: "CONTRACT_EXPIRED",
          category: "Contract",
          title: `Contract Completed (#${c.id.slice(0, 8)})`,
          description: `Contract successfully completed its ${c.duration_days}-day lease duration. Compute hashrate deallocated.`,
          timestamp: c.end_date || c.updated_at,
          status: "COMPLETED",
          source: "Lifecycle Clock",
          referenceId: c.id,
          contractId: c.id,
          metadata: {
            contractId: c.id,
            durationDays: c.duration_days,
          },
        });
      }
    });

    // Events from Support Tickets
    (tickets || []).forEach((t: any) => {
      rawEvents.push({
        id: `evt-ticket-${t.id}`,
        eventType: "SUPPORT_TICKET",
        category: "Support",
        title: `Support Ticket Opened (#${t.ticket_code || t.id.slice(0, 8)})`,
        description: `[${t.priority || "Normal"}] ${t.subject}`,
        timestamp: t.created_at,
        status: t.status === "Resolved" ? "COMPLETED" : "PENDING",
        source: "Help Desk",
        referenceId: t.id,
        metadata: {
          ticketCode: t.ticket_code,
          subject: t.subject,
          status: t.status,
          messagesCount: t.support_messages?.length || 0,
        },
      });
    });

    // Events from Admin Audit Logs (Notes, Adjustments, Bans)
    const adminNotesList: any[] = [];
    (auditLogs || []).forEach((log: any) => {
      if (log.action === "ADMIN_NOTE") {
        adminNotesList.push({
          id: log.id,
          content: log.details?.note || log.details?.message || "Internal note",
          adminId: log.admin_id,
          adminEmail: log.details?.author_email || "operations@theminingfuture.com",
          adminName: log.details?.author_name || "TMF Staff",
          priority: log.details?.priority || "NORMAL",
          createdAt: log.created_at,
        });

        rawEvents.push({
          id: `evt-note-${log.id}`,
          eventType: "ADMIN_NOTE_ADDED",
          category: "Admin",
          title: "Private Internal Staff Note",
          description: log.details?.note ? (log.details.note.length > 80 ? log.details.note.slice(0, 80) + "..." : log.details.note) : "Internal note recorded",
          timestamp: log.created_at,
          status: "COMPLETED",
          source: "Admin Operations Desk",
          referenceId: log.id,
          metadata: {
            author: log.details?.author_name || "Operations Admin",
            priority: log.details?.priority || "NORMAL",
          },
        });
      } else if (log.action === "WALLET_ADJUSTMENT" || log.action === "WALLET_DEPOSIT") {
        rawEvents.push({
          id: `evt-wallet-${log.id}`,
          eventType: "WALLET_TRANSACTION",
          category: "Admin",
          title: `Wallet Balance Adjusted (${log.details?.type === "DEBIT" ? "-" : "+"}$${Number(log.details?.amount || 0).toFixed(2)})`,
          description: `Reason: ${log.details?.reason || "Operations ledger adjustment"}. Balance: $${Number(log.details?.previous_balance || 0).toFixed(2)} → $${Number(log.details?.new_balance || 0).toFixed(2)}.`,
          timestamp: log.created_at,
          status: "COMPLETED",
          source: "Wallet Ledger",
          referenceId: log.id,
          metadata: log.details,
        });
      } else if (log.action === "CUSTOMER_ACCOUNT_DISABLED" || log.action === "CUSTOMER_ACCOUNT_REACTIVATED") {
        rawEvents.push({
          id: `evt-status-${log.id}`,
          eventType: "SECURITY_EVENT",
          category: "Security",
          title: log.action === "CUSTOMER_ACCOUNT_DISABLED" ? "Account Disabled by Admin" : "Account Reactivated",
          description: log.details?.reason ? `Reason: ${log.details.reason}` : "Administrative account status update.",
          timestamp: log.created_at,
          status: log.action === "CUSTOMER_ACCOUNT_DISABLED" ? "FAILED" : "COMPLETED",
          source: "Security Governance",
          referenceId: log.id,
          metadata: log.details,
        });
      }
    });

    // Add Last Login Authentication Event if exists
    if (lastLoginAt) {
      rawEvents.push({
        id: `evt-auth-login-${customerId}`,
        eventType: "AUTH_LOGIN",
        category: "Security",
        title: "Successful Authenticated Session",
        description: `Client successfully logged in to customer portal.`,
        timestamp: lastLoginAt,
        status: "COMPLETED",
        source: "Supabase Auth",
        referenceId: customerId,
        metadata: {
          lastLoginAt,
        },
      });
    }

    // Sort timeline events chronologically (newest first by default)
    const timelineEvents = rawEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 11. Calculate Lifecycle Progress Indicator
    // Stages: REGISTRATION -> EMAIL VERIFIED -> PURCHASE COMPLETED -> PAYMENT CONFIRMED -> HASHRATE ALLOCATED -> MINING ACTIVE -> CONTRACT EXPIRED
    const stages = [
      { id: "REGISTRATION", label: "Registration", completed: true, current: false },
      { id: "EMAIL_VERIFIED", label: "Email Verified", completed: isEmailVerified, current: false },
      { id: "PURCHASE_COMPLETED", label: "Purchase Placed", completed: (orders || []).length > 0, current: false },
      { id: "PAYMENT_CONFIRMED", label: "Payment Confirmed", completed: paidOrders.length > 0, current: false },
      { id: "HASHRATE_ALLOCATED", label: "Hashrate Allocated", completed: activeContracts.length > 0 || (allocations || []).length > 0, current: false },
      { id: "MINING_ACTIVE", label: "Mining Active", completed: activeContracts.length > 0, current: false },
      { id: "CONTRACT_EXPIRED", label: "Contract Expired", completed: completedContracts.length > 0, current: false },
    ];

    // Determine current active lifecycle state and alert
    let currentLifecycleStage = "REGISTRATION";
    let lifecycleAlert: string | null = null;

    if (waitingContracts.length > 0) {
      currentLifecycleStage = "PAYMENT CONFIRMED – ALLOCATION PENDING";
      lifecycleAlert = "PAYMENT CONFIRMED – ALLOCATION PENDING: Customer has paid contracts awaiting Equalizer ASIC assignment.";
    } else if (activeContracts.length > 0) {
      currentLifecycleStage = "MINING ACTIVE";
    } else if (paidOrders.length > 0) {
      currentLifecycleStage = "PAYMENT CONFIRMED";
    } else if ((orders || []).length > 0) {
      currentLifecycleStage = "PURCHASE CREATED – PAYMENT PENDING";
    } else if (isEmailVerified) {
      currentLifecycleStage = "EMAIL VERIFIED";
    }

    // Mark current stage in array
    for (let i = stages.length - 1; i >= 0; i--) {
      if (stages[i].completed) {
        stages[i].current = true;
        break;
      }
    }

    // 12. Synthesize Wallet Ledger Transactions
    const walletLedger: any[] = [];

    // From audit logs (deposits, manual adjustments)
    (auditLogs || []).forEach((log: any) => {
      if (log.action === "WALLET_ADJUSTMENT" || log.action === "WALLET_DEPOSIT" || log.action === "NOWPAYMENTS_WALLET_DEPOSIT") {
        walletLedger.push({
          id: log.id,
          date: log.created_at,
          type: log.details?.type || "Adjustment",
          description: log.details?.reason || (log.action === "NOWPAYMENTS_WALLET_DEPOSIT" ? "Crypto Deposit via NOWPayments" : "Operations Adjustment"),
          amount: Number(log.details?.amount || log.details?.credited_usd || 0),
          currency: log.details?.pay_currency || "USDT",
          status: "Confirmed",
          reference: log.details?.order_id || log.details?.payment_id || log.id.slice(0, 8),
          adminId: log.admin_id,
        });
      }
    });

    // From orders (purchases paid from wallet or crypto)
    (paidOrders || []).forEach((order: any) => {
      walletLedger.push({
        id: `tx-order-${order.id}`,
        date: order.ipn_verified_at || order.created_at,
        type: "Purchase",
        description: `Contract Lease (${order.hashrate_th} TH/s, ${order.duration_days} Days)`,
        amount: -Number(order.total_usd),
        currency: order.payment_currency || "USDT",
        status: "Confirmed",
        reference: `ORD-${order.id.slice(0, 8)}`,
      });
    });

    walletLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Final Payload
    return NextResponse.json({
      success: true,
      customer: {
        id: customerId,
        email,
        fullName,
        phone: profile?.phone || authUser?.user_metadata?.phone || "—",
        country: profile?.country || "United Arab Emirates",
        role: profile?.role || "customer",
        walletBalanceUsdt: walletBalance,
        isEmailVerified,
        emailConfirmedAt,
        accountStatus,
        disabledReason: profile?.disabled_reason || null,
        registrationDate,
        lastLoginAt,
        notes: profile?.notes || null,
      },
      summaryCards: {
        currentHashrateTh: poolReportedHashrateTh,
        hashrate24hAvgTh: hashrate24hAvgTh,
        hashrateStatus: isEqualizerConnected && poolReportedHashrateTh > 0 ? "Online" : isEqualizerConnected ? "Idle" : "Data unavailable",
        hashrateDataSource,
        lastHashrateUpdate: activeContracts[0]?.last_stats_update || null,
        walletBalance: {
          available: walletBalance,
          pending: 0.00,
          currency: "USDT",
          lastTransactionDate: walletLedger[0]?.date || null,
        },
        totalPurchases: {
          count: paidOrders.length,
          totalUsd: totalSpentUsd,
          currency: "USD",
        },
        activeContracts: {
          activeCount: activeContracts.length,
          waitingAllocationCount: waitingContracts.length,
          completedCount: completedContracts.length,
        },
        customerLtv: {
          totalSpentUsd,
          completedPurchasesCount: paidOrders.length,
        },
        hashrateBreakdown: {
          purchasedHashrateTh: totalPurchasedHashrateTh,
          allocatedHashrateTh: totalAllocatedHashrateTh,
          poolReportedHashrateTh,
          allocatedContractsCount: activeContracts.length,
        },
      },
      orders,
      contracts,
      poolConfigs,
      allocations,
      tickets,
      adminNotes: adminNotesList,
      walletLedger,
      timelineEvents,
      lifecycle: {
        currentStage: currentLifecycleStage,
        alert: lifecycleAlert,
        stages,
      },
      security: {
        isEmailVerified,
        accountStatus,
        lastLoginAt,
        registrationDate,
        bannedUntil: authUser?.banned_until || null,
        securityEventsCount: (auditLogs || []).filter((l: any) => l.action.includes("ACCOUNT") || l.action.includes("AUTH")).length,
      },
    });
  } catch (err: any) {
    console.error("Error fetching customer 360 profile:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load customer profile details." },
      { status: 500 }
    );
  }
}
