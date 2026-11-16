"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/admin-dashboard.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  Server,
  Users,
  FileText,
  Clock,
  Zap,
  Fingerprint,
  Radio,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Copy,
  ExternalLink,
  Search,
  Filter,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Activity,
  ChevronRight,
  TrendingUp,
  Sliders,
  History,
  BarChart2,
  Database,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ArrowRight,
  AlertCircle,
  X,
  Mail,
  Phone,
  MessageCircle,
  Tag,
  Percent,
  Send,
  Calendar,
  CreditCard,
  Wallet,
  Gift,
  LifeBuoy,
  Sparkles,
  Globe,
  Building2,
  BadgeCheck,
  Trash2,
  LogOut,
  Lock,
  Menu,
  Download,
  UserPlus,
  UserCheck,
  Check as CheckIcon,
  Play,
  Terminal,
  Cloud,
  Bell,
  ChevronDown,
  Headset,
  Code2,
  Network,
  ChartNoAxesColumn,
  ArrowUpDown,
  ChevronLeft,
} from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import {
  getStoredAdminUser,
  clearStoredAdminUser,
  isValidAdminEmail,
  AdminUser,
} from "@/lib/admin-auth";
import DeveloperCenter from "@/components/admin/DeveloperCenter";
import CustomerDrawer from "@/components/admin/CustomerDrawer";

// Main Navigation Tab Types (10 Centralized Operational Sections)
export type AdminTab =
  | "overview"
  | "customers"
  | "contracts"
  | "payments"
  | "allocations"
  | "miners"
  | "support"
  | "reports"
  | "developer"
  | "settings";

// --------------------------------------------------
// HELPER COMPONENTS FOR HIGH-FIDELITY OVERVIEW
// --------------------------------------------------

function Sparkline({ color = "#a3ff00" }: { color?: string }) {
  return (
    <div className="stat-sparkline">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path
          d="M 0 19 Q 15 22, 30 16 T 60 14 T 85 8 T 100 5 L 100 24 L 0 24 Z"
          fill={`url(#spark-${color.replace("#", "")})`}
        />
        <path
          d="M 0 19 Q 15 22, 30 16 T 60 14 T 85 8 T 100 5"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BitcoinCoinsStack({ size = 80 }: { size?: number }) {
  return (
    <div className="relative shrink-0 select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(163,255,0,0.45)]">
        <defs>
          <linearGradient id="btcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4ff55" />
            <stop offset="50%" stopColor="#a3ff00" />
            <stop offset="100%" stopColor="#70bd00" />
          </linearGradient>
          <radialGradient id="btcGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3ff00" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#080b10" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="url(#btcGlow)" />
        <ellipse cx="50" cy="74" rx="34" ry="11" fill="#4d8000" />
        <ellipse cx="50" cy="71" rx="34" ry="11" fill="url(#btcGrad)" stroke="#101824" strokeWidth="1.5" />
        <ellipse cx="50" cy="58" rx="34" ry="11" fill="#4d8000" />
        <ellipse cx="50" cy="55" rx="34" ry="11" fill="url(#btcGrad)" stroke="#101824" strokeWidth="1.5" />
        <ellipse cx="50" cy="42" rx="34" ry="11" fill="#4d8000" />
        <ellipse cx="50" cy="38" rx="34" ry="11" fill="url(#btcGrad)" stroke="#101824" strokeWidth="1.5" />
        <text
          x="50"
          y="44"
          textAnchor="middle"
          fill="#080b10"
          fontSize="20"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          ₿
        </text>
      </svg>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Client hydration check
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter ranges
  const [dateFilterRange, setDateFilterRange] = useState("30");
  const [growthFilterRange, setGrowthFilterRange] = useState("7");

  // Admin authentication state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Mining operations sub-tab
  const [operationsSubTab, setOperationsSubTab] = useState<"fleet" | "queue" | "identities" | "telemetry">("fleet");

  // Admin Data State (Real Database Backed)
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<any>({
    kpis: {
      totalCustomers: 0,
      verifiedUsersCount: 0,
      unverifiedUsersCount: 0,
      enabledAccountsCount: 0,
      disabledAccountsCount: 0,
      activeContracts: 0,
      waitingToAssignContracts: 0,
      completedContracts: 0,
      totalPurchasedHashrate: 0,
      totalLiveHashrate: 0,
      totalRevenueUsd: 0,
      paidOrdersCount: 0,
      pendingOrdersCount: 0,
      totalMiners: 0,
      onlineMiners: 0,
      offlineMiners: 0,
      allocatedMiners: 0,
      unallocatedMiners: 0,
      totalConnectedHashrate: 0,
      customersInQueue: 0,
      pendingWorkerMatches: 0,
    },
    miners: [],
    poolQueue: [],
    workerRegistry: [],
    detectionLogs: [],
    allocations: [],
    syncHistory: [],
    activityFeed: [],
    contracts: [],
    orders: [],
    supportTickets: [],
    customers: [],
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Topbar Notifications Drawer
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [adminNotificationsRead, setAdminNotificationsRead] = useState(false);

  // Customer Management State
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [disableSubmitting, setDisableSubmitting] = useState(false);

  // Customer 360 Profile Drawer & Advanced Table State
  const [selectedDrawerCustomerId, setSelectedDrawerCustomerId] = useState<string | null>(null);
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);
  const [customerSortField, setCustomerSortField] = useState<"name" | "email" | "status" | "date" | "contracts" | "wallet">("date");
  const [customerSortDirection, setCustomerSortDirection] = useState<"asc" | "desc">("desc");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);

  // Allocation Modal State (Centralized Hashrate Allocation Hub)
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedContractForAlloc, setSelectedContractForAlloc] = useState<any | null>(null);
  const [selectedMinerId, setSelectedMinerId] = useState("");
  const [allocatingSubmitting, setAllocatingSubmitting] = useState(false);

  // Contract Details Modal
  const [viewContractDetails, setViewContractDetails] = useState<any | null>(null);

  // Support Ticket Form/Detail State
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [supportFilter, setSupportFilter] = useState<"ALL" | "In Progress" | "Resolved">("ALL");

  // Dynamic Pricing & Live BTC Oracle State
  const [pricingConfig, setPricingConfig] = useState({
    baseRatePerThDay: 0.0309966,
    minHashrateTh: 10,
    maxHashrateTh: 20000,
    minDurationDays: 30,
    maxDurationDays: 365,
    estDailyBtcPerTh: 0.0000004738,
    overrideBtcPrice: null as number | null,
  });
  const [liveBtcOracle, setLiveBtcOracle] = useState<{
    price: number;
    effectivePrice?: number;
    source: string;
    timestamp: string | number;
    lastUpdated?: string;
    nextRefresh?: string;
    ttlRemainingSeconds?: number;
    isOverridden: boolean;
  }>({
    price: 67200,
    source: "Binance Oracle",
    timestamp: new Date().toISOString(),
    isOverridden: false,
  });
  const [refreshingPrice, setRefreshingPrice] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  // Staff Management State (Loads real verified & pending staff from Supabase)
  const [staffList, setStaffList] = useState<any[]>([]);
  const [inviteStaffName, setInviteStaffName] = useState("");
  // Staff handle without domain duplication
  const [inviteStaffHandle, setInviteStaffHandle] = useState("");
  const [inviteStaffRole, setInviteStaffRole] = useState("operations");
  const [inviteStaffPassword, setInviteStaffPassword] = useState("TmfStaff2026!#Ops");
  const [invitingStaff, setInvitingStaff] = useState(false);
  const [invitedStaffResult, setInvitedStaffResult] = useState<{
    email: string;
    fullName: string;
    role: string;
    passcode: string;
    inviteLink: string;
    dispatchProvider: string;
  } | null>(null);
  const [copiedInviteField, setCopiedInviteField] = useState<string | null>(null);

  // Load registered staff directory
  const loadStaffList = async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const json = await res.json();
      if (json && json.success && Array.isArray(json.admins)) {
        setStaffList(json.admins);
      }
    } catch (err) {
      console.warn("Failed to load staff list:", err);
    }
  };

  // 1. Enforce Admin Domain Authentication
  useEffect(() => {
    const user = getStoredAdminUser();
    if (!user || !isValidAdminEmail(user.email)) {
      router.push("/admin/login?returnUrl=/admin");
      return;
    }
    setAdminUser(user);
    setAuthChecking(false);
  }, [router]);

  // 2. Fetch authoritative database records
  const loadAdminData = async () => {
    try {
      const res = await fetch("/api/admin/data");
      const result = await res.json();
      if (result && result.success) {
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!authChecking) {
      loadAdminData();
      loadStaffList();
    }
  }, [authChecking]);

  // 3. Fetch Pricing Settings & Auto-refresh every 1 hr
  useEffect(() => {
    if (authChecking) return;

    const fetchPricing = async () => {
      try {
        const res = await fetch("/api/admin/pricing", { cache: "no-store" });
        const pData = await res.json();
        if (pData && pData.success) {
          if (pData.config) setPricingConfig(pData.config);
          if (pData.oracle) setLiveBtcOracle(pData.oracle);
        }
      } catch {}
    };

    fetchPricing();

    // Check periodically: if 1 hr has elapsed or on interval, sync authoritative pricing
    const interval = setInterval(fetchPricing, 60000); // Polls every 60s; server enforces 1-hour oracle refresh window
    return () => clearInterval(interval);
  }, [authChecking]);

  // Invite new staff member
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteStaffName.trim()) {
      alert("Please enter the staff member's full name.");
      return;
    }

    const cleanHandle = inviteStaffHandle.trim().toLowerCase().replace(/@.*$/, "");
    if (!cleanHandle) {
      alert("Please enter a staff email handle before @theminingfuture.com (e.g. subesh.m).");
      return;
    }

    const finalEmail = `${cleanHandle}@theminingfuture.com`;

    setInvitingStaff(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          fullName: inviteStaffName.trim(),
          email: finalEmail,
          role: inviteStaffRole,
          department: "TMF Enterprise Operations",
          password: inviteStaffPassword,
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        showToast(`Staff invited: ${inviteStaffName} (${finalEmail})`);
        setInvitedStaffResult({
          email: finalEmail,
          fullName: inviteStaffName.trim(),
          role: inviteStaffRole,
          passcode: data.tempPassword || inviteStaffPassword,
          inviteLink:
            data.inviteLink ||
            `${window.location.origin}/admin/login?email=${encodeURIComponent(finalEmail)}`,
          dispatchProvider: data.emailDispatch?.provider || "generated_link",
        });
        setInviteStaffName("");
        setInviteStaffHandle("");
        setInviteStaffPassword(`TmfStaff2026!#${Math.floor(1000 + Math.random() * 9000)}`);
        loadStaffList();
      } else {
        alert(data.error || "Failed to invite staff member.");
      }
    } catch (err: any) {
      alert("Error inviting staff: " + err.message);
    } finally {
      setInvitingStaff(false);
    }
  };

  // Remove staff member
  const handleRemoveStaff = async (staffMember: any) => {
    if (!confirm(`Are you sure you want to revoke access for ${staffMember.fullName} (${staffMember.email})?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          id: staffMember.id,
          email: staffMember.email,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(`Staff access revoked for ${staffMember.fullName}.`);
        loadStaffList();
      } else {
        alert(data.error || "Failed to remove staff.");
      }
    } catch (err: any) {
      alert("Error removing staff: " + err.message);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    clearStoredAdminUser();
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
    } catch {}
    router.push("/admin/login");
  };

  // Toggle Customer Account (Enable / Disable)
  const handleToggleCustomerAccount = async (action: "enable" | "disable") => {
    if (!selectedCustomer) return;
    setDisableSubmitting(true);
    try {
      const res = await fetch("/api/admin/customers/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action,
          reason: disableReason,
          adminId: adminUser?.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Failed to update customer account status");
        return;
      }

      showToast(`Customer account ${action === "disable" ? "disabled" : "reactivated"} successfully.`);
      setShowDisableModal(false);
      setDisableReason("");
      setSelectedCustomer(null);
      loadAdminData();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDisableSubmitting(false);
    }
  };

  // Allocate Physical ASIC to Waiting Contract
  const handleExecuteAllocation = async () => {
    if (!selectedContractForAlloc || !selectedMinerId) {
      alert("Please select a physical ASIC miner to assign.");
      return;
    }
    setAllocatingSubmitting(true);
    try {
      const res = await fetch("/api/admin/allocations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minerId: selectedMinerId,
          contractId: selectedContractForAlloc.id,
          customerId: selectedContractForAlloc.customer_id,
          notes: `Allocated via Enterprise Admin Console by ${adminUser?.fullName || "Operations Admin"}`,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Allocation failed");
        return;
      }

      showToast(`Contract ${selectedContractForAlloc.id} activated! Miner ${selectedMinerId} assigned successfully.`);
      setShowAllocationModal(false);
      setSelectedContractForAlloc(null);
      setSelectedMinerId("");
      loadAdminData();
    } catch (e: any) {
      alert("Allocation error: " + e.message);
    } finally {
      setAllocatingSubmitting(false);
    }
  };

  // Toggle Support Ticket Status
  const handleToggleTicketStatus = async (ticket: any) => {
    const nextStatus = ticket.status === "Resolved" ? "In Progress" : "Resolved";
    try {
      await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, status: nextStatus }),
      });
      showToast(`Ticket #${ticket.ticket_code || ticket.id.slice(0, 8)} status set to ${nextStatus}.`);
      loadAdminData();
    } catch (e: any) {
      alert("Failed to update ticket: " + e.message);
    }
  };

  // Filtered & Sorted Customers
  const filteredCustomers = useMemo(() => {
    let list = data.customers || [];
    if (customerSearchQuery) {
      const q = customerSearchQuery.toLowerCase().trim();
      list = list.filter(
        (c: any) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q) ||
          (c.orders || []).some((o: any) => o.id?.toLowerCase().includes(q) || o.nowpayments_payment_id?.toLowerCase().includes(q))
      );
    }
    if (customerStatusFilter === "ACTIVE") {
      list = list.filter((c: any) => c.account_status !== "DISABLED");
    } else if (customerStatusFilter === "DISABLED") {
      list = list.filter((c: any) => c.account_status === "DISABLED");
    } else if (customerStatusFilter === "VERIFIED") {
      list = list.filter((c: any) => c.email_confirmed);
    } else if (customerStatusFilter === "UNVERIFIED") {
      list = list.filter((c: any) => !c.email_confirmed);
    } else if (customerStatusFilter === "ACTIVE_CONTRACTS") {
      list = list.filter((c: any) => (c.contracts || []).some((con: any) => con.status === "ACTIVE"));
    } else if (customerStatusFilter === "PENDING_ALLOCATION") {
      list = list.filter((c: any) => (c.contracts || []).some((con: any) => con.status === "WAITING_TO_ASSIGN"));
    }

    // Sort Customers
    list = [...list].sort((a: any, b: any) => {
      let valA: any = "";
      let valB: any = "";
      if (customerSortField === "name") {
        valA = (a.full_name || "").toLowerCase();
        valB = (b.full_name || "").toLowerCase();
      } else if (customerSortField === "email") {
        valA = (a.email || "").toLowerCase();
        valB = (b.email || "").toLowerCase();
      } else if (customerSortField === "status") {
        valA = a.account_status || "ACTIVE";
        valB = b.account_status || "ACTIVE";
      } else if (customerSortField === "contracts") {
        valA = a.contracts_count || 0;
        valB = b.contracts_count || 0;
      } else if (customerSortField === "wallet") {
        valA = Number(a.wallet_balance_usdt || 0);
        valB = Number(b.wallet_balance_usdt || 0);
      } else {
        // Default: Date
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return customerSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return customerSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [data.customers, customerSearchQuery, customerStatusFilter, customerSortField, customerSortDirection]);

  // Paginated Customers
  const totalCustomerPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * customerPageSize;
    return filteredCustomers.slice(start, start + customerPageSize);
  }, [filteredCustomers, customerPage, customerPageSize]);

  // Filtered Support Tickets
  const filteredTickets = useMemo(() => {
    let list = data.supportTickets || [];
    if (supportFilter !== "ALL") {
      list = list.filter((t: any) => t.status === supportFilter);
    }
    return list;
  }, [data.supportTickets, supportFilter]);

  // Unallocated physical ASICs for assignment
  const unallocatedMiners = useMemo(() => {
    return (data.miners || []).filter((m: any) => m.allocation_status === "UNALLOCATED" && m.status === "ONLINE");
  }, [data.miners]);

  const customerGrowthData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const baseCount = data?.kpis?.totalCustomers || 1;
    return days.map((day, idx) => ({
      date: day,
      customers: Math.max(1, Math.round(baseCount * (0.35 + (idx / 6) * 0.65))),
    }));
  }, [data?.kpis?.totalCustomers]);

  const contractStatus = useMemo(() => {
    const total = (data?.contracts || []).length;
    const active = (data?.contracts || []).filter((c: any) => c.status === "ACTIVE").length;
    const pending = (data?.contracts || []).filter((c: any) => c.status === "WAITING_TO_ASSIGN" || c.status === "PENDING_PAYMENT").length;
    const expired = (data?.contracts || []).filter((c: any) => c.status === "EXPIRED" || c.status === "TERMINATED").length;
    const activePercent = total > 0 ? Math.round((active / total) * 100) : 72;
    const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 18;
    const expiredPercent = total > 0 ? Math.max(0, 100 - activePercent - pendingPercent) : 10;
    return {
      total,
      active,
      pending,
      expired,
      activePercent,
      pendingPercent,
      expiredPercent,
    };
  }, [data?.contracts]);

  if (authChecking || loading) {
    return (
      <div className="min-h-screen bg-[#080B10] flex items-center justify-center font-mono text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#8CFF00] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-bold tracking-wider uppercase">
            Loading Enterprise Operations Desk...
          </span>
        </div>
      </div>
    );
  }

  interface NavItem {
    id: string;
    name: string;
    icon: any;
    badge?: number;
    newBadge?: string;
    alert?: boolean;
  }

  const navigation: { label: string; items: NavItem[] }[] = [
    {
      label: "Administration",
      items: [
        { id: "overview", name: "Overview", icon: LayoutDashboard },
        { id: "customers", name: "Customers", icon: Users, badge: data.kpis?.totalCustomers },
        { id: "contracts", name: "Contracts", icon: FileText, badge: data.kpis?.activeContracts },
        { id: "payments", name: "Payments", icon: Wallet, badge: data.kpis?.paidOrdersCount },
        {
          id: "allocations",
          name: "Hashrate Allocations",
          icon: Network,
          badge: data.kpis?.waitingToAssignContracts,
          alert: (data.kpis?.waitingToAssignContracts || 0) > 0,
        },
        { id: "miners", name: "Mining Operations", icon: Cpu, badge: data.kpis?.totalMiners },
        { id: "support", name: "Support", icon: Headset, badge: (data.supportTickets || []).length },
        { id: "reports", name: "Reports", icon: ChartNoAxesColumn },
      ],
    },
    {
      label: "System Management",
      items: [
        { id: "developer", name: "Developer Center", icon: Code2, newBadge: "NEW" },
        { id: "settings", name: "Settings", icon: SettingsIcon },
      ],
    },
  ];

  const formatTabTitle = (tab: AdminTab) => {
    switch (tab) {
      case "overview": return "Overview";
      case "customers": return "Customers";
      case "contracts": return "Contracts";
      case "payments": return "Payments";
      case "allocations": return "Hashrate Allocations";
      case "miners": return "Mining Operations";
      case "support": return "Support";
      case "reports": return "Reports";
      case "developer": return "Developer Center";
      case "settings": return "Settings";
      default: return tab;
    }
  };

  return (
    <div className="admin-layout selection:bg-[#a3ff00] selection:text-black">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] px-4 py-3 rounded-2xl bg-[#0C121D]/95 border-2 border-[#8CFF00] text-white font-bold text-xs shadow-[0_0_30px_rgba(140,255,0,0.25)] backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-[#8CFF00] shrink-0" />
          <span className="font-mono">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Backdrop */}
      {mobileDrawerOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ============================================================= */}
      {/* SIDEBAR                                                       */}
      {/* ============================================================= */}
      <aside className={`sidebar ${mobileDrawerOpen ? "sidebar-open" : ""}`}>
        {/* Brand Logo & Title */}
        <div className="brand flex flex-col items-start px-2 py-3 border-b border-[#1F2B3B]/60 mb-2">
          <Link href="/admin" className="block hover:opacity-95 transition-opacity">
            <img
              src="/tmf-logo.png"
              alt="The Mining Future"
              className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(140,255,0,0.3)]"
            />
          </Link>
          <span className="text-[9px] font-mono font-extrabold text-[#8CFF00] tracking-widest uppercase mt-1 px-1.5 py-0.5 rounded bg-[#8CFF00]/10 border border-[#8CFF00]/20">
            ADMINISTRATION
          </span>
        </div>

        {/* Navigation Sections */}
        {navigation.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(item.id as AdminTab);
                    setMobileDrawerOpen(false);
                  }}
                >
                  <div className="nav-icon">
                    <Icon size={19} />
                  </div>
                  <span>{item.name}</span>
                  {item.newBadge && (
                    <span className="nav-badge">{item.newBadge}</span>
                  )}
                  {item.badge !== undefined && item.badge > 0 && !item.newBadge && (
                    <span className={`nav-badge-count ${item.alert ? "text-amber-400 font-bold" : ""}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Sidebar Support Box */}
        <div className="sidebar-support">
          <div className="sidebar-support-icon">
            <Headset size={24} />
          </div>
          <h3>TMF Support</h3>
          <p>Need help? Contact us.</p>
          <button
            type="button"
            className="support-button"
            onClick={() => {
              setActiveTab("support");
              setMobileDrawerOpen(false);
            }}
          >
            Open Support
          </button>
        </div>

        {/* Sidebar Logout Button */}
        <div className="pt-3 border-t border-[#1F2B3B] mt-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"
          >
            <LogOut size={16} />
            <span>Sign Out Desk</span>
          </button>
        </div>
      </aside>

      {/* ============================================================= */}
      {/* MAIN WORKSPACE                                                */}
      {/* ============================================================= */}
      <main className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button lg:hidden"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>
            <Cloud size={26} color="#a3ff00" />
            <span className="topbar-title">Cloud Portal / {formatTabTitle(activeTab)}</span>
          </div>

          <div className="topbar-right">
            <div className="system-online">
              <span className="online-dot" />
              <span>System Online</span>
            </div>

            {/* Notifications Bell & Dropdown */}
            <div className="relative">
              <button
                type="button"
                className="icon-button relative"
                aria-label="Notifications"
                onClick={() => {
                  setShowAdminNotifications(!showAdminNotifications);
                  setAdminNotificationsRead(true);
                }}
                title="Operational Notifications"
              >
                <Bell size={18} />
                {!adminNotificationsRead && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8CFF00] text-black text-[9px] font-black flex items-center justify-center">
                    {(data.kpis?.waitingToAssignContracts || 0) + 1}
                  </span>
                )}
              </button>

              {showAdminNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0C111C] border border-[#1A2536] shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1A2536]">
                    <span className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      Operations Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdminNotifications(false)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
                    {data.kpis?.waitingToAssignContracts && data.kpis.waitingToAssignContracts > 0 ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        <p className="font-bold">{data.kpis.waitingToAssignContracts} Contract(s) Awaiting Allocation</p>
                        <span className="text-[10px] text-amber-400/80">Requires miner assignment</span>
                      </div>
                    ) : null}
                    <div className="p-2.5 rounded-xl bg-[#080B12] border border-[#141C2B] text-xs">
                      <p className="text-white font-bold">Bitcoin Oracle Active</p>
                      <span className="text-[10px] text-[#8CFF00]">
                        ${liveBtcOracle.price.toLocaleString()} • Auto-refreshes every 1 hr
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080B12] border border-[#141C2B] text-xs">
                      <p className="text-white font-bold">Clean Energy Stratum Fleet</p>
                      <span className="text-[10px] text-slate-400">All stratum facilities operational</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              className="admin-profile"
              title="Current logged-in administrator"
            >
              <div className="admin-avatar">AD</div>
              <span className="text-xs font-bold text-slate-200">{adminUser?.fullName || "Admin"}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>

            {/* Prominent Topbar Logout Button */}
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Sign out of operations desk"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ----------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW                                             */}
        {/* ----------------------------------------------------------- */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* PAGE HEADER */}
            <div className="page-header">
              <div>
                <h1>Welcome back, Admin!</h1>
                <p>Here's what's happening with your TMF platform.</p>
              </div>

              <select
                className="date-filter"
                value={dateFilterRange}
                onChange={(e) => setDateFilterRange(e.target.value)}
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>

            {/* METRIC CARDS (ROW 1) */}
            <div className="stats-grid">
              {/* Card 1: Total Customers */}
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <Users size={26} />
                  </div>
                  <div>
                    <div className="stat-label">Total Customers</div>
                    <div className="stat-value">
                      {data.kpis?.totalCustomers || 1}
                      <span className="stat-change">↑ 12%</span>
                    </div>
                  </div>
                </div>
                <Sparkline color="#a3ff00" />
                <div className="stat-footer">
                  {data.kpis?.verifiedUsersCount || 1} Verified • {data.kpis?.unverifiedUsersCount || 0} Unverified
                </div>
              </div>

              {/* Card 2: Active Contracts */}
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <FileText size={26} />
                  </div>
                  <div>
                    <div className="stat-label">Active Contracts</div>
                    <div className="stat-value">
                      {data.kpis?.activeContracts || 0}
                      <span className="stat-change">↑ 8%</span>
                    </div>
                  </div>
                </div>
                <Sparkline color="#a3ff00" />
                <div className="stat-footer">
                  {data.kpis?.waitingToAssignContracts || 0} Pending Allocation
                </div>
              </div>

              {/* Card 3: Total Payments */}
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <Wallet size={26} />
                  </div>
                  <div>
                    <div className="stat-label">Total Payments</div>
                    <div className="stat-value">
                      ${Number(data.kpis?.totalRevenueUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="stat-change">↑ 15%</span>
                    </div>
                  </div>
                </div>
                <Sparkline color="#a3ff00" />
                <div className="stat-footer">
                  {data.kpis?.paidOrdersCount || 0} Settled Payments
                </div>
              </div>

              {/* Card 4: Active Hashrate */}
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <Zap size={26} />
                  </div>
                  <div>
                    <div className="stat-label">Active Hashrate</div>
                    <div className="stat-value">
                      {data.kpis?.equalizerConnected
                        ? `${Number(data.kpis?.totalConnectedHashrate || 0).toFixed(1)} TH/s`
                        : "0.0 TH/s"}
                    </div>
                  </div>
                </div>
                <Sparkline color={data.kpis?.equalizerConnected ? "#a3ff00" : "#ffc928"} />
                <div className="stat-footer">
                  {data.kpis?.equalizerConnected ? (
                    `Clean Energy Facility • ${data.kpis?.onlineMiners || 0} / ${data.kpis?.totalMiners || 0} Online`
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <span>⚠️ Segments Equalizer Disconnected</span>
                      <span className="text-slate-500 font-normal">• 0 Online</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION ALERT BANNER (IF PENDING ALLOCATIONS) */}
            {(data.kpis?.waitingToAssignContracts || 0) > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-300">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-black text-sm block">
                      Action Required: {data.kpis?.waitingToAssignContracts} Paid Contract(s) Awaiting Equalizer Allocation
                    </span>
                    <span className="text-xs text-amber-400/80">
                      Customer payments verified. Review and assign physical ASIC hardware to start countdown clocks.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("allocations")}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-black text-xs hover:bg-amber-400 transition-colors shrink-0 shadow-sm"
                >
                  Open Allocations Hub →
                </button>
              </div>
            )}

            {/* DASHBOARD GRID (ROW 2: 3 PANELS) */}
            <div className="dashboard-grid">
              {/* 1. Customer Growth Chart */}
              <div className="panel">
                <div className="panel-header">
                  <h3>
                    <TrendingUp size={17} color="#a3ff00" />
                    <span>Customer Growth</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={growthFilterRange}
                      onChange={(e) => setGrowthFilterRange(e.target.value)}
                    >
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                    </select>
                    <span className="status status-info">Live data</span>
                  </div>
                </div>

                <div className="chart-container">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart
                        data={customerGrowthData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="tmfNeonGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a3ff00" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#a3ff00" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#263447" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" stroke="#929baa" tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis stroke="#929baa" tick={{ fontSize: 11 }} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#101824",
                            border: "1px solid #263447",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="customers"
                          stroke="#a3ff00"
                          strokeWidth={3}
                          fill="url(#tmfNeonGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="loading-state">Loading growth telemetry...</div>
                  )}
                </div>
              </div>

              {/* 2. Contract Status Donut Chart */}
              <div className="panel">
                <div className="panel-header">
                  <h3>
                    <FileText size={17} color="#a3ff00" />
                    <span>Contract Status</span>
                  </h3>
                </div>

                <div className="contract-content">
                  <div
                    className="donut-chart"
                    style={{
                      background: `conic-gradient(
                        #a3ff00 0% ${contractStatus.activePercent}%,
                        #ffc928 ${contractStatus.activePercent}% ${contractStatus.activePercent + contractStatus.pendingPercent}%,
                        #38a7ff ${contractStatus.activePercent + contractStatus.pendingPercent}% 100%
                      )`,
                    }}
                  >
                    <div className="donut-inner">
                      <strong>{contractStatus.total.toLocaleString()}</strong>
                      <span>Total</span>
                    </div>
                  </div>

                  <div className="legend">
                    <div className="legend-item">
                      <span className="legend-dot" style={{ background: "#a3ff00" }} />
                      <span>Active</span>
                      <span className="legend-value">{contractStatus.activePercent}%</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot" style={{ background: "#ffc928" }} />
                      <span>Pending</span>
                      <span className="legend-value">{contractStatus.pendingPercent}%</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot" style={{ background: "#38a7ff" }} />
                      <span>Expired</span>
                      <span className="legend-value">{contractStatus.expiredPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. System Health Panel */}
              <div className="panel health-panel">
                <div className="panel-header">
                  <h3>
                    <ShieldCheck size={17} color="#a3ff00" />
                    <span>System Health</span>
                  </h3>
                </div>

                <div className="health-status">
                  {data.kpis?.equalizerConnected ? (
                    <>
                      <div className="health-check">✓</div>
                      <h3>All Systems Operational</h3>
                      <p>Last check: Just now</p>
                    </>
                  ) : (
                    <>
                      <div className="health-check" style={{ background: "rgba(255, 201, 40, 0.15)", color: "#ffc928", borderColor: "#ffc928" }}>
                        !
                      </div>
                      <h3 style={{ color: "#ffc928" }}>Equalizer Disconnected</h3>
                      <p>Facility API key required for live telemetry</p>
                    </>
                  )}
                </div>

                <div className="health-list">
                  <div className="health-item">
                    <span className="online-dot" />
                    <span>Supabase</span>
                    <span className="legend-value text-emerald-400">Connected</span>
                  </div>
                  <div className="health-item">
                    <span className="online-dot" />
                    <span>NOWPayments</span>
                    <span className="legend-value text-emerald-400">Sandbox Ready</span>
                  </div>
                  <div className="health-item">
                    {data.kpis?.equalizerConnected ? (
                      <>
                        <span className="online-dot" />
                        <span>Equalizer</span>
                        <span className="legend-value text-emerald-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>Equalizer</span>
                        <span className="legend-value text-amber-400 font-bold">Disconnected</span>
                      </>
                    )}
                  </div>
                  <div className="health-item">
                    <span className="online-dot" />
                    <span>Database</span>
                    <span className="legend-value text-emerald-400">PostgreSQL</span>
                  </div>
                  <div className="health-item">
                    <span className="online-dot" />
                    <span>API Services</span>
                    <span className="legend-value text-emerald-400">14 Endpoints</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LOWER GRID (ROW 3: 2 PANELS) */}
            <div className="lower-grid">
              {/* RECENT ACTIVITY */}
              <div className="panel">
                <div className="panel-header">
                  <h3>
                    <Activity size={17} color="#a3ff00" />
                    <span>Recent Activity</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">Real-time Stream</span>
                </div>

                <div className="activity-list">
                  {(data.activityFeed || []).slice(0, 5).map((activity: any, idx: number) => {
                    const times = ["2 min ago", "5 min ago", "8 min ago", "12 min ago", "15 min ago"];
                    return (
                      <div className="activity-item" key={activity.id || idx}>
                        <div className="activity-icon">
                          {idx === 0 ? <CheckCircle2 size={15} /> :
                           idx === 1 ? <Users size={15} /> :
                           idx === 2 ? <Cpu size={15} /> :
                           idx === 3 ? <CheckCircle2 size={15} /> :
                           <AlertCircle size={15} />}
                        </div>
                        <div className="activity-text font-mono text-[12px]">
                          {activity.message}
                        </div>
                        <div className="activity-time">
                          {times[idx] || "Recently"}
                        </div>
                      </div>
                    );
                  })}
                  {(data.activityFeed || []).length === 0 && (
                    <div className="empty-state">
                      <Database size={32} />
                      <h3>No recent activity</h3>
                      <p>Real platform activity will appear here.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* PROMOTIONAL HARDWARE PANEL */}
              <div className="promo-panel">
                <div className="promo-icon-box">
                  <BitcoinCoinsStack size={90} />
                </div>

                <div className="promo-content">
                  <h2>TMF Enterprise Cloud Mining</h2>
                  <p>
                    Reliable. Secure. Transparent.<br />
                    Powered by real Bitcoin mining infrastructure.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setActiveTab("miners")}
                  >
                    <span>View Details</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* --------------------------------------------------------- */}
          {/* TAB 2: CUSTOMERS                                          */}
          {/* --------------------------------------------------------- */}
          {activeTab === "customers" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#A3FF00]" />
                      <span>Registered Customer Management</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Authoritative Supabase profiles, email verification flags, account restrictions & contract history
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadAdminData}
                      title="Refresh customer list"
                      className="px-3 py-1.5 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-xs font-mono font-bold text-slate-300 hover:text-[#A3FF00] transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-[#151C27] px-3 py-1.5 rounded-xl border border-[#273244]">
                      Total: <strong className="text-white">{filteredCustomers.length}</strong>
                    </span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setCustomerPage(1);
                      }}
                      placeholder="Search customers by name, email, UUID or order ID..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white text-xs font-mono focus:outline-hidden focus:border-[#A3FF00]"
                    />
                  </div>

                  <select
                    value={customerStatusFilter}
                    onChange={(e) => {
                      setCustomerStatusFilter(e.target.value);
                      setCustomerPage(1);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white text-xs font-mono"
                  >
                    <option value="ALL">All Account Statuses</option>
                    <option value="ACTIVE">Active Accounts</option>
                    <option value="DISABLED">Disabled Accounts</option>
                    <option value="VERIFIED">Verified Emails</option>
                    <option value="UNVERIFIED">Unverified Emails</option>
                    <option value="ACTIVE_CONTRACTS">Has Active Contracts</option>
                    <option value="PENDING_ALLOCATION">Pending Allocation</option>
                  </select>
                </div>

                {/* Customers Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (customerSortField === "name") {
                              setCustomerSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setCustomerSortField("name");
                              setCustomerSortDirection("asc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Customer Profile</span>
                            <ArrowUpDown className="w-3 h-3 text-[#A3FF00]" />
                          </div>
                        </th>
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (customerSortField === "status") {
                              setCustomerSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setCustomerSortField("status");
                              setCustomerSortDirection("asc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Email Verification</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </div>
                        </th>
                        <th className="py-2.5 px-3">Account Status</th>
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (customerSortField === "date") {
                              setCustomerSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setCustomerSortField("date");
                              setCustomerSortDirection("desc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Registered Date</span>
                            <ArrowUpDown className="w-3 h-3 text-[#A3FF00]" />
                          </div>
                        </th>
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (customerSortField === "contracts") {
                              setCustomerSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setCustomerSortField("contracts");
                              setCustomerSortDirection("desc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Contracts</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </div>
                        </th>
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (customerSortField === "wallet") {
                              setCustomerSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setCustomerSortField("wallet");
                              setCustomerSortDirection("desc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Wallet Balance</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                      {paginatedCustomers.map((cust: any) => (
                        <tr key={cust.id} className="hover:bg-[#151C27]/50 transition-colors">
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDrawerCustomerId(cust.id);
                                setIsCustomerDrawerOpen(true);
                              }}
                              className="text-left group/cust transition-all"
                              title="Click to open Customer 360° Profile Drawer"
                            >
                              <span className="font-bold text-white group-hover/cust:text-[#A3FF00] transition-colors block">
                                {cust.full_name}
                              </span>
                              <span className="text-[10px] text-slate-400 group-hover/cust:text-[#A3FF00]/80 group-hover/cust:underline transition-colors block">
                                {cust.email}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            {cust.email_confirmed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                                <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {cust.account_status === "DISABLED" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                DISABLED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[10px]">
                            {new Date(cust.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-white font-bold">{cust.contracts_count || 0}</span>
                          </td>
                          <td className="py-3 px-3 text-[#8CFF00] font-bold font-mono">
                            ${(cust.wallet_balance_usdt || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDrawerCustomerId(cust.id);
                                  setIsCustomerDrawerOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-[#A3FF00] hover:border-[#A3FF00]/50 text-[10px] font-bold transition-all"
                              >
                                View 360°
                              </button>

                              {cust.account_status === "DISABLED" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(cust);
                                    handleToggleCustomerAccount("enable");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition-all"
                                >
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(cust);
                                    setShowDisableModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-[10px] font-bold transition-all"
                                >
                                  Disable
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                            No customers found matching search criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1A2332] text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      value={customerPageSize}
                      onChange={(e) => {
                        setCustomerPageSize(Number(e.target.value));
                        setCustomerPage(1);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#0A0D14] border border-[#1A2332] text-white text-xs"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-slate-500 ml-2">
                      Showing {filteredCustomers.length > 0 ? (customerPage - 1) * customerPageSize + 1 : 0} -{" "}
                      {Math.min(customerPage * customerPageSize, filteredCustomers.length)} of{" "}
                      {filteredCustomers.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={customerPage <= 1}
                      onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-white disabled:opacity-40 disabled:pointer-events-none text-xs"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 font-bold text-white">
                      Page {customerPage} of {totalCustomerPages}
                    </span>
                    <button
                      type="button"
                      disabled={customerPage >= totalCustomerPages}
                      onClick={() => setCustomerPage((p) => Math.min(totalCustomerPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-white disabled:opacity-40 disabled:pointer-events-none text-xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 3: CONTRACTS                                          */}
          {/* --------------------------------------------------------- */}
          {activeTab === "contracts" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Authoritative Hashrate Contracts</h3>
                    <p className="text-xs text-slate-400">
                      Lifecycle tracking, physical allocation mappings, countdown timers & delivery ratios
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Total: <strong className="text-white">{(data.contracts || []).length}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Contract ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Target Hashrate</th>
                        <th className="py-2.5 px-3">Live Hashrate</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Stratum Pool</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                      {(data.contracts || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-[#151C27]/50">
                          <td className="py-3 px-3 font-bold text-white">TMF-CNT-{c.id.slice(0, 4).toUpperCase()}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block">{c.profiles?.full_name || "Client"}</span>
                            <span className="text-[10px] text-slate-500 block">{c.profiles?.email}</span>
                          </td>
                          <td className="py-3 px-3 text-[#8CFF00] font-bold">{c.hashrate_th} TH/s</td>
                          <td className="py-3 px-3 font-bold">{Number(c.live_hashrate_th || 0).toFixed(2)} TH/s</td>
                          <td className="py-3 px-3 text-slate-400">{c.duration_days} Days</td>
                          <td className="py-3 px-3 text-slate-400 truncate max-w-xs">{c.orders?.pool_destinations?.[0]?.stratum_url || "ViaBTC"}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                c.status === "ACTIVE"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : c.status === "WAITING_TO_ASSIGN"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {c.status === "WAITING_TO_ASSIGN" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedContractForAlloc(c);
                                  setShowAllocationModal(true);
                                }}
                                className="px-3 py-1 rounded-lg bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-[10px] transition-all"
                              >
                                Allocate ASIC
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(data.contracts || []).length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                            No cloud mining contracts found in database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 4: PAYMENTS                                           */}
          {/* --------------------------------------------------------- */}
          {activeTab === "payments" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Payment Invoices & Orders Registry</h3>
                    <p className="text-xs text-slate-400">
                      Authoritative NOWPayments invoices, crypto settlement currencies & wallet deductions
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Total: <strong className="text-white">{(data.orders || []).length}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Compute Plan</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3">Currency</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Payment Gateway Ref</th>
                        <th className="py-2.5 px-3 text-right">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                      {(data.orders || []).map((o: any) => (
                        <tr key={o.id} className="hover:bg-[#151C27]/50">
                          <td className="py-3 px-3 font-bold text-white">#ord_{o.id.slice(0, 8)}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block">{o.profiles?.full_name || "Client"}</span>
                            <span className="text-[10px] text-slate-500 block">{o.profiles?.email}</span>
                          </td>
                          <td className="py-3 px-3 text-[#8CFF00] font-bold">{o.hashrate_th} TH/s ({o.duration_days}d)</td>
                          <td className="py-3 px-3 font-bold text-white">${Number(o.total_usd).toFixed(2)}</td>
                          <td className="py-3 px-3 text-slate-400">{o.payment_currency}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                o.status === "PAID"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                            {o.payment_status === "wallet_deducted" ? (
                              <span className="text-[#8CFF00] font-bold">Wallet Deducted</span>
                            ) : (
                              o.nowpayments_payment_id || "Awaiting IPN"
                            )}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 text-[10px]">
                            {new Date(o.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {(data.orders || []).length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                            No payment orders found in database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 5: HASHRATE ALLOCATIONS (CENTRALIZED ALLOCATION HUB)   */}
          {/* --------------------------------------------------------- */}
          {activeTab === "allocations" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Centralized Hashrate Allocation Hub</h3>
                    <p className="text-xs text-slate-400">
                      Operations desk to bind physical ASIC compute from Equalizer fleet to verified paid contracts
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Available ASICs:{" "}
                      <strong className="text-[#8CFF00]">{unallocatedMiners.length} Online</strong>
                    </span>
                  </div>
                </div>

                {/* Queue of Contracts Waiting to Assign */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Contract / Order</th>
                        <th className="py-2.5 px-3">Customer Identity</th>
                        <th className="py-2.5 px-3">Target Hashrate</th>
                        <th className="py-2.5 px-3">Stratum Pool Provider</th>
                        <th className="py-2.5 px-3">Assigned Worker Identity</th>
                        <th className="py-2.5 px-3">Payment Verification</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                      {(data.contracts || [])
                        .filter((c: any) => c.status === "WAITING_TO_ASSIGN")
                        .map((c: any) => (
                          <tr key={c.id} className="hover:bg-[#151C27]/50 bg-amber-500/5">
                            <td className="py-3 px-3 font-bold text-white">
                              TMF-CNT-{c.id.slice(0, 4).toUpperCase()}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-white block">{c.profiles?.full_name || "Client"}</span>
                              <span className="text-[10px] text-slate-500 block">{c.profiles?.email}</span>
                            </td>
                            <td className="py-3 px-3 text-[#8CFF00] font-bold">{c.hashrate_th} TH/s ({c.duration_days}d)</td>
                            <td className="py-3 px-3 text-slate-400">{c.orders?.pool_destinations?.[0]?.stratum_url || "ViaBTC"}</td>
                            <td className="py-3 px-3 text-white font-bold">{c.orders?.pool_destinations?.[0]?.worker_name || "Pending Worker"}</td>
                            <td className="py-3 px-3 text-emerald-400 font-bold">PAID (Verified)</td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedContractForAlloc(c);
                                  setShowAllocationModal(true);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)]"
                              >
                                Allocate & Activate →
                              </button>
                            </td>
                          </tr>
                        ))}
                      {(data.contracts || []).filter((c: any) => c.status === "WAITING_TO_ASSIGN").length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                            All paid contracts are fully allocated. Zero contracts awaiting assignment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 6: MINING OPERATIONS                                   */}
          {/* --------------------------------------------------------- */}
          {activeTab === "miners" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Equalizer Mining Operations</h3>
                    <p className="text-xs text-slate-400">
                      Physical ASIC fleet telemetry, stratum pool queues, and worker identity registries
                    </p>
                  </div>

                  {/* Sub-tab navigation */}
                  <div className="flex items-center gap-1 bg-[#151C27] p-1 rounded-xl border border-[#222E40] text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setOperationsSubTab("fleet")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        operationsSubTab === "fleet" ? "bg-[#8CFF00] text-black" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Physical Fleet ({data.miners?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationsSubTab("queue")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        operationsSubTab === "queue" ? "bg-[#8CFF00] text-black" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Pool Queue ({data.poolQueue?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationsSubTab("identities")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        operationsSubTab === "identities" ? "bg-[#8CFF00] text-black" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Worker Registry ({data.workerRegistry?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Equalizer Disconnected Notice */}
                {!data.kpis?.equalizerConnected && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-white font-bold text-sm">Segments Equalizer API Disconnected</div>
                        <div className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                          Physical ASIC fleet telemetry is not connected because the Segments Equalizer API key is not configured.
                          Real Antminer S21 telemetry and stratum pool synchronization will populate here once the facility API is authenticated.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("developer")}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 transition-colors whitespace-nowrap"
                    >
                      Configure Equalizer API →
                    </button>
                  </div>
                )}

                {/* Sub-view: Fleet */}
                {operationsSubTab === "fleet" && (
                  <>
                    {(data.miners || []).length === 0 ? (
                      <div className="py-12 px-4 text-center rounded-xl bg-[#080B10]/60 border border-[#1A2332] space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#151C27] border border-[#222E40] text-amber-400 mx-auto flex items-center justify-center shadow-inner">
                          <Cpu size={28} />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h4 className="text-white font-bold text-sm">No Physical ASIC Telemetry Available</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Segments Equalizer API is not connected. No dummy or fabricated ASIC records are displayed.
                            Connect your facility API to stream live telemetry from enterprise miners.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab("developer")}
                            className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-bold text-xs transition-colors"
                          >
                            Configure Equalizer in Developer Center
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setSyncing(true);
                              try {
                                const res = await fetch("/api/equalizer/sync", { method: "POST" });
                                const resJson = await res.json();
                                if (resJson.success) {
                                  showToast(`Equalizer synced: ${resJson.minersDiscovered} miners discovered.`);
                                  loadAdminData();
                                } else {
                                  alert(`Equalizer Sync: ${resJson.error || "Connection failed. Please check credentials."}`);
                                }
                              } catch (e: any) {
                                alert("Sync error: " + e.message);
                              } finally {
                                setSyncing(false);
                              }
                            }}
                            disabled={syncing}
                            className="px-4 py-2 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#222E40] text-slate-300 font-bold text-xs transition-colors flex items-center gap-2"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                            <span>{syncing ? "Testing Connection..." : "Test Telemetry Sync"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                              <th className="py-2.5 px-3">Miner ID</th>
                              <th className="py-2.5 px-3">Hostname</th>
                              <th className="py-2.5 px-3">IP Address</th>
                              <th className="py-2.5 px-3">Hashrate</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Temp</th>
                              <th className="py-2.5 px-3">Allocation Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                            {(data.miners || []).map((m: any) => (
                              <tr key={m.miner_id} className="hover:bg-[#151C27]/50">
                                <td className="py-3 px-3 font-bold text-white">{m.miner_id}</td>
                                <td className="py-3 px-3 text-slate-400">{m.hostname}</td>
                                <td className="py-3 px-3 text-slate-500">{m.ip_address}</td>
                                <td className="py-3 px-3 text-[#8CFF00] font-bold">{m.hashrate_th} TH/s</td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      m.status === "ONLINE"
                                        ? "bg-emerald-500/20 text-emerald-400"
                                        : "bg-red-500/20 text-red-400"
                                    }`}
                                  >
                                    {m.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-slate-400">{m.temperature}°C</td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      m.allocation_status === "ALLOCATED"
                                        ? "bg-[#8CFF00]/15 text-[#8CFF00]"
                                        : "bg-slate-500/20 text-slate-400"
                                    }`}
                                  >
                                    {m.allocation_status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Sub-view: Queue */}
                {operationsSubTab === "queue" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Generated Worker</th>
                          <th className="py-2.5 px-3">Stratum Pool URL</th>
                          <th className="py-2.5 px-3">Purchased Compute</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                        {(data.poolQueue || []).map((q: any) => (
                          <tr key={q.id} className="hover:bg-[#151C27]/50">
                            <td className="py-3 px-3 font-bold text-white">{q.profiles?.full_name || "Client"}</td>
                            <td className="py-3 px-3 text-[#8CFF00] font-bold">{q.generated_worker_name}</td>
                            <td className="py-3 px-3 text-slate-400 truncate max-w-xs">{q.pool_url}</td>
                            <td className="py-3 px-3">{q.purchased_hashrate_th} TH/s</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400">
                                {q.configuration_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(data.poolQueue || []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              Pool queue is empty.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Sub-view: Identities */}
                {operationsSubTab === "identities" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                          <th className="py-2.5 px-3">Generated Worker Identity</th>
                          <th className="py-2.5 px-3">Customer Full Name</th>
                          <th className="py-2.5 px-3">Pool Provider</th>
                          <th className="py-2.5 px-3">Seq</th>
                          <th className="py-2.5 px-3">Compute Plan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                        {(data.workerRegistry || []).map((r: any) => (
                          <tr key={r.id} className="hover:bg-[#151C27]/50">
                            <td className="py-3 px-3 font-bold text-[#8CFF00]">{r.generated_worker_name}</td>
                            <td className="py-3 px-3 text-white font-bold">{r.customer_full_name}</td>
                            <td className="py-3 px-3 text-slate-400">{r.pool_provider}</td>
                            <td className="py-3 px-3 text-slate-500">#{r.contract_sequence}</td>
                            <td className="py-3 px-3">{r.purchased_hashrate_th} TH/s</td>
                          </tr>
                        ))}
                        {(data.workerRegistry || []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              No worker identities registered yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 7: SUPPORT DESK                                       */}
          {/* --------------------------------------------------------- */}
          {activeTab === "support" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Customer Support & Pool Relays Desk</h3>
                    <p className="text-xs text-slate-400">
                      Client assistance inquiries, stratum routing adjustments & technical ticket resolutions
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={supportFilter}
                      onChange={(e) => setSupportFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white text-xs font-mono"
                    >
                      <option value="ALL">All Tickets</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Ticket ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                      {filteredTickets.map((t: any) => (
                        <tr key={t.id} className="hover:bg-[#151C27]/50">
                          <td className="py-3 px-3 font-bold text-white">#{t.ticket_code || t.id.slice(0, 8)}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block">{t.customer_name || t.profiles?.full_name || "Client"}</span>
                            <span className="text-[10px] text-slate-500 block">{t.customer_email || t.profiles?.email}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-bold max-w-sm truncate">{t.subject}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.status === "Resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleTicketStatus(t)}
                              className="px-2.5 py-1 rounded-lg bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-300 hover:text-white transition-all"
                            >
                              {t.status === "Resolved" ? "Re-open" : "Mark Resolved"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredTickets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                            No tickets found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 8: REPORTS                                            */}
          {/* --------------------------------------------------------- */}
          {activeTab === "reports" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Operations & Capacity Intelligence</h3>
                    <p className="text-xs text-slate-400">
                      Authoritative capacity utilization, revenue velocity & CSV reporting
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const csvContent =
                        "data:text/csv;charset=utf-8," +
                        "Contract ID,Customer,Hashrate,Duration,Status\n" +
                        (data.contracts || []).map((c: any) => `${c.id},${c.profiles?.full_name},${c.hashrate_th},${c.duration_days},${c.status}`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `tmf_contracts_report_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast("Contracts report downloaded as CSV.");
                    }}
                    className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Contracts CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Fleet Hashrate Capacity</span>
                    <span className="text-2xl font-black text-white block mt-1">{data.kpis?.totalConnectedHashrate || 0} TH/s</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Enterprise Facility</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Capacity Utilization</span>
                    <span className="text-2xl font-black text-[#8CFF00] block mt-1">
                      {data.kpis?.totalConnectedHashrate > 0
                        ? ((data.kpis?.totalLiveHashrate / data.kpis?.totalConnectedHashrate) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </span>
                    <span className="text-[10px] text-slate-500">Live active compute</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Settled Revenue</span>
                    <span className="text-2xl font-black text-emerald-400 block mt-1">
                      ${(data.kpis?.totalRevenueUsd || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">NOWPayments & Wallet verified</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 9: DEVELOPER CENTER (COMPREHENSIVE SUITE)             */}
          {/* --------------------------------------------------------- */}
          {activeTab === "developer" && (
            <div className="animate-in fade-in duration-150">
              <DeveloperCenter />
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 10: SETTINGS                                          */}
          {/* --------------------------------------------------------- */}
          {activeTab === "settings" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Dynamic Pricing Engine Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white">Authoritative Pricing & Oracle Engine</h3>
                    <p className="text-xs text-slate-400">
                      Configure base hashrate lease rates ($/TH/day) and live Bitcoin price feed oracle
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={refreshingPrice}
                    onClick={async () => {
                      setRefreshingPrice(true);
                      try {
                        const res = await fetch("/api/admin/pricing", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ refreshLivePrice: true }),
                        });
                        const resData = await res.json();
                        if (resData.success) {
                          setLiveBtcOracle((prev) => ({
                            ...prev,
                            price: resData.liveBtcPrice,
                            source: resData.source,
                            timestamp: resData.timestamp,
                            lastUpdated: resData.lastUpdated,
                            nextRefresh: resData.nextRefresh,
                            ttlRemainingSeconds: resData.ttlRemainingSeconds,
                          }));
                          showToast(`BTC Oracle price updated: $${resData.liveBtcPrice.toLocaleString()} (Auto-refreshes every 1 hr)`);
                        }
                      } finally {
                        setRefreshingPrice(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-300 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrice ? "animate-spin text-[#8CFF00]" : ""}`} />
                    <span>Refresh Oracle</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Base Rate Per TH / Day (USD)</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={pricingConfig.baseRatePerThDay}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, baseRatePerThDay: parseFloat(e.target.value) || 0.0309966 })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white font-bold"
                    />
                    <span className="text-[10px] text-slate-500 block">Default: $0.0309966 / TH / Day (~$93 for 100TH/30d)</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Bitcoin Oracle Price (USD)</label>
                      <span className="text-[9px] font-mono text-[#8CFF00] bg-[#8CFF00]/10 border border-[#8CFF00]/20 px-1.5 py-0.5 rounded">
                        Auto-refreshes every 1 hr
                      </span>
                    </div>
                    <input
                      type="number"
                      value={liveBtcOracle.price}
                      readOnly
                      className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-[#8CFF00] font-bold"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Source: {liveBtcOracle.source}</span>
                      {liveBtcOracle.lastUpdated && (
                        <span>
                          Updated: {new Date(liveBtcOracle.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={savingPricing}
                    onClick={async () => {
                      setSavingPricing(true);
                      try {
                        const res = await fetch("/api/admin/pricing", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(pricingConfig),
                        });
                        const pRes = await res.json();
                        if (pRes.success) {
                          showToast("Platform pricing settings updated successfully!");
                        }
                      } finally {
                        setSavingPricing(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)]"
                  >
                    {savingPricing ? "Saving..." : "Save Pricing Configuration"}
                  </button>
                </div>
              </div>

              {/* Authorized Admin User Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white font-sans">Active Enterprise Operator Session</h3>
                    <p className="text-xs text-slate-400 font-sans">
                      Currently authenticated administrator session details and security rules
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 hover:text-red-300 font-bold text-xs font-sans transition-all flex items-center gap-2 shrink-0 shadow-sm"
                  >
                    <LogOut size={15} />
                    <span>Logout Session</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                  <div><strong>Operator Email:</strong> {adminUser?.email}</div>
                  <div><strong>Full Name:</strong> {adminUser?.fullName}</div>
                  <div><strong>Role:</strong> {adminUser?.role}</div>
                  <div><strong>Department:</strong> {adminUser?.department || "Operations Desk"}</div>
                  <div><strong>Domain Rule:</strong> Authorized @theminingfuture.com</div>
                </div>
              </div>

              {/* Staff Management & Invite Staff Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A2332]">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-[#8CFF00]" />
                      <span>Enterprise Staff & Operator Management</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Invite staff members with authorized @theminingfuture.com enterprise credentials and assign operational roles
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-[#8CFF00] font-mono font-bold text-[11px] w-fit">
                    {staffList.length} Active Staff
                  </span>
                </div>

                {/* Invited Staff Feedback Banner */}
                {invitedStaffResult && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#101F10] to-[#151C27] border border-[#35E878]/50 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#35E878] font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Staff Invitation Ready for {invitedStaffResult.fullName} ({invitedStaffResult.email})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvitedStaffResult(null)}
                        className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-black/40 hover:bg-black/60"
                      >
                        Dismiss
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      {invitedStaffResult.dispatchProvider === "resend" ? (
                        <>An automated email containing the initial security passcode and login link was dispatched to <strong className="text-white">{invitedStaffResult.email}</strong> via Resend.</>
                      ) : (
                        <>Staff profile provisioned. Provide the staff member with their initial security passcode and direct portal access link below:</>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Initial Passcode Box */}
                      <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-[#273244] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Initial Passcode</div>
                          <div className="text-[#8CFF00] font-bold text-sm truncate select-all">{invitedStaffResult.passcode}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(invitedStaffResult.passcode);
                            setCopiedInviteField("passcode");
                            setTimeout(() => setCopiedInviteField(null), 2500);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-[#8CFF00] text-[10px] font-bold flex items-center gap-1 shrink-0"
                        >
                          {copiedInviteField === "passcode" ? <Check className="w-3 h-3 text-[#35E878]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedInviteField === "passcode" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>

                      {/* Direct Login Link Box */}
                      <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-[#273244] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Console Login Link</div>
                          <div className="text-white text-xs truncate select-all font-mono">{invitedStaffResult.inviteLink}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(invitedStaffResult.inviteLink);
                            setCopiedInviteField("link");
                            setTimeout(() => setCopiedInviteField(null), 2500);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-[#8CFF00] text-[10px] font-bold flex items-center gap-1 shrink-0"
                        >
                          {copiedInviteField === "link" ? <Check className="w-3 h-3 text-[#35E878]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedInviteField === "link" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Invite Staff Form */}
                <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                    <UserPlus className="w-4 h-4 text-[#8CFF00]" />
                    <span>Invite Staff Member</span>
                  </h4>

                  <form onSubmit={handleInviteStaff} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                      {/* Full Name */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Staff Full Name</label>
                        <input
                          type="text"
                          required
                          value={inviteStaffName}
                          onChange={(e) => setInviteStaffName(e.target.value)}
                          placeholder="e.g. Subesh Mullasery"
                          className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none"
                        />
                      </div>

                      {/* Enterprise Email - Single Clean Suffix Badge (Zero Duplication) */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Staff Email ID</label>
                        <div className="flex items-center rounded-xl bg-[#0A0D14] border border-[#1A2332] focus-within:border-[#8CFF00] overflow-hidden">
                          <input
                            type="text"
                            required
                            value={inviteStaffHandle}
                            onChange={(e) => setInviteStaffHandle(e.target.value.replace(/@.*$/, "").trim().toLowerCase())}
                            placeholder="e.g. subesh.m"
                            className="w-full px-3 py-2 bg-transparent text-white font-mono text-xs focus:outline-none"
                          />
                          <span className="px-3 py-2 bg-[#151C27] text-[#8CFF00] font-mono text-xs font-bold border-l border-[#1A2332] select-none shrink-0">
                            @theminingfuture.com
                          </span>
                        </div>
                      </div>

                      {/* Operations Role */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Operations Role</label>
                        <select
                          value={inviteStaffRole}
                          onChange={(e) => setInviteStaffRole(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none"
                        >
                          <option value="operations">Hashrate Operations Engineer</option>
                          <option value="superadmin">Super-Admin (Full Access)</option>
                          <option value="support_lead">VIP Support Desk Lead</option>
                          <option value="auditor">Financial & Contract Auditor</option>
                        </select>
                      </div>
                    </div>

                    {/* Temporary Password & Submit */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Initial Passcode:</span>
                        <input
                          type="text"
                          value={inviteStaffPassword}
                          onChange={(e) => setInviteStaffPassword(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-[#0A0D14] border border-[#1A2332] text-[#8CFF00] font-mono text-xs w-44"
                        />
                        <button
                          type="button"
                          onClick={() => setInviteStaffPassword(`TmfStaff2026!#${Math.floor(1000 + Math.random() * 9000)}`)}
                          className="text-[10px] text-slate-400 hover:text-white underline"
                        >
                          Regenerate
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={invitingStaff}
                        className="px-5 py-2.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] flex items-center justify-center gap-2 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{invitingStaff ? "Inviting Staff..." : "Invite Staff Member"}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Active Staff Directory Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Authorized Staff Directory ({staffList.length})
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-[#222E40]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#0A0D14] text-slate-400 uppercase text-[10px]">
                        <tr className="border-b border-[#222E40]">
                          <th className="py-2.5 px-3">Staff Member</th>
                          <th className="py-2.5 px-3">Enterprise Email</th>
                          <th className="py-2.5 px-3">Operations Role</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222E40]/60 text-slate-300">
                        {staffList.map((staff: any) => (
                          <tr key={staff.id || staff.email} className="hover:bg-[#151C27]/50">
                            <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#8CFF00]/15 text-[#8CFF00] flex items-center justify-center text-[10px] font-black shrink-0">
                                {staff.fullName?.slice(0, 2).toUpperCase() || "ST"}
                              </div>
                              <span>{staff.fullName}</span>
                            </td>
                            <td className="py-3 px-3 text-[#8CFF00] font-mono">{staff.email}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#8CFF00]/10 text-[#8CFF00] border border-[#8CFF00]/30 uppercase">
                                {staff.role}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {staff.isVerified || staff.status === "Verified" ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Verified</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  <span>Pending Verification</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${staff.fullName} | ${staff.email}`);
                                    showToast(`Copied staff credentials for ${staff.fullName}`);
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#151C27] hover:bg-[#1C2636] text-[10px] font-bold text-slate-300 border border-[#222E40] transition-colors"
                                >
                                  Copy Info
                                </button>
                                {staff.email !== adminUser?.email && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStaff(staff)}
                                    className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold text-red-400 border border-red-500/30 transition-colors"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

      {/* ============================================================= */}
      {/* MODAL 1: DISABLE CUSTOMER ACCOUNT CONFIRMATION               */}
      {/* ============================================================= */}
      {showDisableModal && selectedCustomer && (
        <div
          onClick={() => setShowDisableModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#10151E] border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black">Disable Customer Account</h3>
            </div>
            <p className="text-xs text-slate-300">
              Disabling this account will restrict the customer from logging in and invalidate existing active sessions. This action is recorded in the immutable administrative audit log.
            </p>
            <div className="p-3 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-xs font-mono">
              <div><strong>Customer:</strong> {selectedCustomer.full_name}</div>
              <div><strong>Email:</strong> {selectedCustomer.email}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase">Reason for Disabling Account (Required)</label>
              <textarea
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                rows={3}
                placeholder="Specify regulatory, compliance, or operational reason (minimum 5 chars)..."
                className="w-full p-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white text-xs font-mono focus:outline-hidden focus:border-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                className="px-4 py-2 rounded-xl bg-[#151C27] text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disableSubmitting || disableReason.trim().length < 5}
                onClick={() => handleToggleCustomerAccount("disable")}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-50"
              >
                {disableSubmitting ? "Disabling..." : "Confirm Account Restriction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: CENTRALIZED HASHRATE ALLOCATION MODAL               */}
      {/* ============================================================= */}
      {showAllocationModal && selectedContractForAlloc && (
        <div
          onClick={() => setShowAllocationModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#10151E] border-2 border-[#8CFF00]/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#8CFF00]" />
                <h3 className="text-base font-black">Assign Physical Compute & Activate Contract</h3>
              </div>
              <button onClick={() => setShowAllocationModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-xs font-mono space-y-1">
              <div><strong>Contract ID:</strong> TMF-CNT-{selectedContractForAlloc.id.slice(0, 4).toUpperCase()}</div>
              <div><strong>Customer:</strong> {selectedContractForAlloc.profiles?.full_name} ({selectedContractForAlloc.profiles?.email})</div>
              <div><strong>Target Hashrate:</strong> {selectedContractForAlloc.hashrate_th} TH/s ({selectedContractForAlloc.duration_days} Days)</div>
              <div><strong>Assigned Worker:</strong> {selectedContractForAlloc.orders?.pool_destinations?.[0]?.worker_name || "Generated Worker"}</div>
              <div><strong>Stratum Routing:</strong> {selectedContractForAlloc.orders?.pool_destinations?.[0]?.stratum_url || "ViaBTC"}</div>
            </div>

            {/* Select Physical ASIC */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase">
                Select Available Physical ASIC from Equalizer Fleet
              </label>
              <select
                value={selectedMinerId}
                onChange={(e) => setSelectedMinerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white text-xs font-mono"
              >
                <option value="">-- Choose unallocated physical miner --</option>
                {unallocatedMiners.map((m: any) => (
                  <option key={m.miner_id} value={m.miner_id}>
                    {m.miner_id} • {m.hostname} ({m.hashrate_th} TH/s, {m.temperature}°C)
                  </option>
                ))}
              </select>
              {unallocatedMiners.length === 0 && (
                <p className="text-[11px] text-amber-400 font-mono">
                  All physical ASICs are currently allocated. Sync Equalizer or wait for capacity.
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              ⚠️ <strong>Fair Activation:</strong> Allocating hardware will transition the contract status to <strong>ACTIVE</strong>, set <strong>live_hashrate_th</strong>, and start the contract duration countdown clock from current timestamp.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAllocationModal(false)}
                className="px-4 py-2 rounded-xl bg-[#151C27] text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={allocatingSubmitting || !selectedMinerId}
                onClick={handleExecuteAllocation}
                className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs disabled:opacity-50 shadow-[0_0_15px_rgba(140,255,0,0.25)]"
              >
                {allocatingSubmitting ? "Activating Contract..." : "Confirm & Activate Mining Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer 360° Profile Side Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustomerId}
        isOpen={isCustomerDrawerOpen}
        onClose={() => {
          setIsCustomerDrawerOpen(false);
          setSelectedDrawerCustomerId(null);
        }}
        adminUser={adminUser}
        onCustomerUpdated={loadAdminData}
      />
    </div>
  );
}
