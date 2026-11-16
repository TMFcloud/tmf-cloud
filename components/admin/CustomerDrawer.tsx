"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
  Wallet,
  CreditCard,
  FileText,
  Activity,
  Headset,
  Lock,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Search,
  ArrowUpDown,
  UserCheck,
  UserX,
  Send,
  Cpu,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  MoreVertical,
  Mail,
  Sliders,
  TrendingUp,
} from "lucide-react";
import { AdminUser } from "@/lib/admin-auth";

export type DrawerTab =
  | "overview"
  | "mining"
  | "purchases"
  | "contracts"
  | "wallet"
  | "journey"
  | "activity"
  | "support"
  | "security";

interface CustomerDrawerProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  adminUser: AdminUser | null;
  onCustomerUpdated?: () => void;
}

export default function CustomerDrawer({
  customerId,
  isOpen,
  onClose,
  adminUser,
  onCustomerUpdated,
}: CustomerDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("journey");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Note Modal
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNotePriority, setNewNotePriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");

  // Wallet Adjust Modal
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState("");
  const [walletAdjustType, setWalletAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [walletAdjustReason, setWalletAdjustReason] = useState("");

  // Timeline Filters
  const [timelineCategory, setTimelineCategory] = useState<string>("ALL");
  const [timelineSearch, setTimelineSearch] = useState<string>("");
  const [timelineSortOrder, setTimelineSortOrder] = useState<"desc" | "asc">("desc");
  const [timelineDateRange, setTimelineDateRange] = useState<string>("ALL");
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Fetch full 360 data
  const loadCustomer360 = useCallback(async (isSilent = false) => {
    if (!customerId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/customers/detail?customerId=${encodeURIComponent(customerId)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Failed to load customer profile.");
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e.message || "Network error loading customer.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomer360();
    } else {
      setData(null);
    }
  }, [isOpen, customerId, loadCustomer360]);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Copy UUID
  const handleCopyUuid = () => {
    if (!data?.customer?.id) return;
    navigator.clipboard.writeText(data.customer.id);
    setCopiedUuid(true);
    showToast("Customer UUID copied to clipboard.");
    setTimeout(() => setCopiedUuid(false), 2000);
  };

  // Customer Account Toggle (Enable / Disable)
  const handleToggleAccount = async (action: "enable" | "disable") => {
    if (!customerId) return;
    setActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/customers/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          action,
          reason: disableReason,
          adminId: adminUser?.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Action failed.");
        return;
      }
      showToast(`Account ${action === "disable" ? "disabled" : "reactivated"} successfully.`);
      setShowDisableModal(false);
      setDisableReason("");
      loadCustomer360(true);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Add Internal Staff Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !newNoteText.trim()) return;
    setActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/customers/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          action: "add_note",
          note: newNoteText.trim(),
          priority: newNotePriority,
          adminId: adminUser?.id,
          authorName: adminUser?.fullName || "Operations Admin",
          authorEmail: adminUser?.email || "admin@theminingfuture.com",
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Failed to add note.");
        return;
      }
      showToast("Private staff note recorded.");
      setShowAddNoteModal(false);
      setNewNoteText("");
      loadCustomer360(true);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Adjust Wallet Balance
  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(walletAdjustAmount);
    if (!customerId || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    if (!walletAdjustReason.trim() || walletAdjustReason.trim().length < 5) {
      alert("Mandatory reason (min 5 characters) is required for immutable ledger compliance.");
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/customers/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          action: "wallet_adjust",
          amount: amt,
          adjustType: walletAdjustType,
          reason: walletAdjustReason.trim(),
          adminId: adminUser?.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Failed to adjust wallet.");
        return;
      }
      showToast(`Wallet adjusted: ${walletAdjustType === "DEBIT" ? "-" : "+"}$${amt.toFixed(2)} USDT.`);
      setShowWalletModal(false);
      setWalletAdjustAmount("");
      setWalletAdjustReason("");
      loadCustomer360(true);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Resend Email Verification
  const handleResendVerification = async () => {
    if (!customerId) return;
    setActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/customers/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          action: "resend_verification",
          adminId: adminUser?.id,
          email: data?.customer?.email,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error || "Failed to resend verification.");
        return;
      }
      showToast("Verification dispatch recorded.");
      setShowActionMenu(false);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Export Customer Profile & Journey to CSV
  const handleExportCsv = () => {
    if (!data?.customer) return;
    const events = data.timelineEvents || [];
    let csv = "Timestamp,Event Type,Category,Title,Description,Status,Source,Reference ID\n";
    events.forEach((evt: any) => {
      const line = [
        `"${evt.timestamp}"`,
        `"${evt.eventType}"`,
        `"${evt.category}"`,
        `"${(evt.title || "").replace(/"/g, '""')}"`,
        `"${(evt.description || "").replace(/"/g, '""')}"`,
        `"${evt.status}"`,
        `"${evt.source}"`,
        `"${evt.referenceId || ""}"`,
      ].join(",");
      csv += line + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `customer_360_${data.customer.id.slice(0, 8)}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Customer 360 CSV exported successfully.");
  };

  // Toggle event expansion in timeline
  const toggleEventExpanded = (id: string) => {
    setExpandedEventIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered timeline events
  const filteredTimelineEvents = useMemo(() => {
    let list = data?.timelineEvents || [];

    // Filter by Category
    if (timelineCategory !== "ALL") {
      list = list.filter((e: any) => e.category === timelineCategory);
    }

    // Filter by Search
    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      list = list.filter(
        (e: any) =>
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.referenceId?.toLowerCase().includes(q) ||
          e.eventType?.toLowerCase().includes(q)
      );
    }

    // Filter by Date Range
    if (timelineDateRange !== "ALL") {
      const now = Date.now();
      const days = parseInt(timelineDateRange, 10);
      if (!isNaN(days)) {
        const threshold = now - days * 24 * 60 * 60 * 1000;
        list = list.filter((e: any) => new Date(e.timestamp).getTime() >= threshold);
      }
    }

    // Sort order
    if (timelineSortOrder === "asc") {
      list = [...list].sort(
        (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } else {
      list = [...list].sort(
        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    return list;
  }, [data?.timelineEvents, timelineCategory, timelineSearch, timelineDateRange, timelineSortOrder]);

  if (!isOpen) return null;

  const cust = data?.customer;
  const cards = data?.summaryCards;
  const lifecycle = data?.lifecycle;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Desktop 700px, Mobile full-screen) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen sm:w-[700px] max-w-[100vw] bg-[#080B10] border-l border-[#273244] shadow-2xl flex flex-col h-full text-[#F5F7FA] overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Toast Notification */}
          {toastMsg && (
            <div className="absolute top-4 left-4 right-4 z-60 bg-[#151C27] border border-[#A3FF00] text-[#A3FF00] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-mono font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STICKY DRAWER HEADER                                      */}
          {/* ========================================================= */}
          <header className="sticky top-0 z-40 bg-[#10151E] border-b border-[#273244] px-5 py-4 shrink-0">
            <div className="flex items-start justify-between gap-3">
              {/* Customer Avatar & Primary Identifiers */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#151C27] border-2 border-[#A3FF00] text-[#A3FF00] flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                  {cust?.fullName ? cust.fullName.slice(0, 2).toUpperCase() : "CU"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                      {cust?.fullName || "Customer Profile"}
                    </h2>
                    {cust?.isEmailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#35E878]/15 text-[#35E878] border border-[#35E878]/30">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFC928]/15 text-[#FFC928] border border-[#FFC928]/30">
                        <AlertTriangle className="w-3 h-3" /> Unverified
                      </span>
                    )}
                    {cust?.accountStatus === "DISABLED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF5555]/15 text-[#FF5555] border border-[#FF5555]/30">
                        DISABLED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#35E878]/15 text-[#35E878] border border-[#35E878]/30">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#929BAA] font-mono mt-0.5">
                    <span className="truncate">{cust?.email || "—"}</span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleCopyUuid}
                      title="Copy customer UUID"
                      className="hover:text-[#A3FF00] transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <span>UUID: {cust?.id?.slice(0, 8)}...</span>
                      {copiedUuid ? <Check className="w-3 h-3 text-[#A3FF00]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => loadCustomer360(true)}
                  disabled={refreshing}
                  title="Refresh customer data"
                  className="p-2 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-[#929BAA] hover:text-[#A3FF00] transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#A3FF00]" : ""}`} />
                </button>

                {/* Actions Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className="p-2 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-[#929BAA] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Actions Dropdown Menu */}
                  {showActionMenu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#10151E] border border-[#273244] shadow-2xl py-2 z-50 text-xs font-mono space-y-1 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowAddNoteModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-slate-200 flex items-center gap-2.5 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-[#A3FF00]" />
                        <span>Add Private Note</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowWalletModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-slate-200 flex items-center gap-2.5 transition-colors"
                      >
                        <Wallet className="w-4 h-4 text-[#A3FF00]" />
                        <span>Adjust Wallet Balance</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResendVerification}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-slate-200 flex items-center gap-2.5 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-amber-400" />
                        <span>Resend Verification Email</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowActionMenu(false);
                          handleExportCsv();
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-slate-200 flex items-center gap-2.5 transition-colors"
                      >
                        <Download className="w-4 h-4 text-blue-400" />
                        <span>Export Customer 360 CSV</span>
                      </button>

                      <div className="border-t border-[#273244] my-1" />

                      {cust?.accountStatus === "DISABLED" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowActionMenu(false);
                            handleToggleAccount("enable");
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-[#35E878] flex items-center gap-2.5 transition-colors font-bold"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Reactivate Account</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setShowActionMenu(false);
                            setShowDisableModal(true);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-[#151C27] text-[#FF5555] flex items-center gap-2.5 transition-colors font-bold"
                        >
                          <UserX className="w-4 h-4" />
                          <span>Disable Customer Account</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-[#151C27] hover:bg-[#FF5555]/15 border border-[#273244] text-[#929BAA] hover:text-[#FF5555] transition-colors"
                  aria-label="Close Profile Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lifecycle Alert Banner (If Applicable) */}
            {lifecycle?.alert && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="font-bold">{lifecycle.alert}</span>
              </div>
            )}
          </header>

          {/* ========================================================= */}
          {/* SCROLLABLE BODY                                           */}
          {/* ========================================================= */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <div className="w-10 h-10 border-2 border-[#A3FF00] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono text-[#929BAA] uppercase tracking-wider">
                  Retrieving Customer 360° Records...
                </p>
              </div>
            ) : error ? (
              <div className="py-16 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-[#FF5555] mx-auto" />
                <p className="text-sm font-bold text-white">{error}</p>
                <button
                  type="button"
                  onClick={() => loadCustomer360()}
                  className="px-4 py-2 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-xs font-mono text-white"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <>
                {/* ===================================================== */}
                {/* 6 SUMMARY CARDS                                       */}
                {/* ===================================================== */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Card 1: Current Hashrate */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Live Hashrate</span>
                      <Zap className="w-3.5 h-3.5 text-[#A3FF00]" />
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {cards?.currentHashrateTh > 0 ? `${cards.currentHashrateTh} TH/s` : "0.0 TH/s"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {cards?.hashrateStatus === "Data unavailable" ? (
                        <span className="text-amber-400 font-bold">⚠️ Hardware Disconnected</span>
                      ) : (
                        <span>Pool Reported</span>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Wallet Balance */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Wallet Balance</span>
                      <Wallet className="w-3.5 h-3.5 text-[#35E878]" />
                    </div>
                    <div className="text-lg font-black font-mono text-[#A3FF00]">
                      ${Number(cards?.walletBalance?.available || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      USDT Balance
                    </div>
                  </div>

                  {/* Card 3: Total Purchases */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Confirmed Orders</span>
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {cards?.totalPurchases?.count || 0}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      ${Number(cards?.totalPurchases?.totalUsd || 0).toFixed(2)} Settled
                    </div>
                  </div>

                  {/* Card 4: Active Contracts */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Active Leases</span>
                      <FileText className="w-3.5 h-3.5 text-[#A3FF00]" />
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {cards?.activeContracts?.activeCount || 0}
                    </div>
                    <div className="text-[10px] font-mono text-amber-400 font-bold">
                      {cards?.activeContracts?.waitingAllocationCount > 0
                        ? `${cards.activeContracts.waitingAllocationCount} Waiting Allocation`
                        : "All Allocated"}
                    </div>
                  </div>

                  {/* Card 5: Lifetime Value */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Customer LTV</span>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      ${Number(cards?.customerLtv?.totalSpentUsd || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Verified Revenue
                    </div>
                  </div>

                  {/* Card 6: Total Allocated Hashrate */}
                  <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#929BAA] font-bold uppercase tracking-wider">
                      <span>Allocated Hash</span>
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {cards?.hashrateBreakdown?.allocatedHashrateTh || 0} TH/s
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {cards?.hashrateBreakdown?.purchasedHashrateTh || 0} TH/s Purchased
                    </div>
                  </div>
                </div>

                {/* ===================================================== */}
                {/* STICKY TAB NAVIGATION (9 TABS)                         */}
                {/* ===================================================== */}
                <div className="sticky top-0 z-30 bg-[#080B10] pt-2 pb-1 border-b border-[#273244]">
                  <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-mono">
                    {[
                      { id: "journey", label: "Customer Journey", icon: TrendingUp },
                      { id: "overview", label: "Overview", icon: Layers },
                      { id: "mining", label: "Mining", icon: Zap },
                      { id: "purchases", label: "Purchases", icon: CreditCard },
                      { id: "contracts", label: "Contracts", icon: FileText },
                      { id: "wallet", label: "Wallet", icon: Wallet },
                      { id: "activity", label: "Activity", icon: Activity },
                      { id: "support", label: "Support & Notes", icon: Headset },
                      { id: "security", label: "Security", icon: Shield },
                    ].map((t) => {
                      const Icon = t.icon;
                      const isActive = activeTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTab(t.id as DrawerTab)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 font-bold transition-all ${
                            isActive
                              ? "bg-[#151C27] text-[#A3FF00] border border-[#A3FF00]/40 shadow-sm"
                              : "text-[#929BAA] hover:text-white hover:bg-[#151C27]/50"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* ===================================================== */}
                {/* TAB 1: CUSTOMER JOURNEY (360° TIMELINE)               */}
                {/* ===================================================== */}
                {activeTab === "journey" && (
                  <div className="space-y-6">
                    {/* Lifecycle Progress Stepper */}
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#929BAA] uppercase tracking-wider font-mono">
                          Customer Lifecycle Progression
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#A3FF00]/15 text-[#A3FF00] border border-[#A3FF00]/30 font-mono">
                          {lifecycle?.currentStage}
                        </span>
                      </div>

                      {/* Progress Bar & Dots */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1 font-mono text-[10px]">
                        {(lifecycle?.stages || []).map((stage: any, idx: number) => (
                          <div
                            key={stage.id}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              stage.completed
                                ? "bg-[#35E878]/10 border-[#35E878]/30 text-[#35E878]"
                                : stage.current
                                ? "bg-[#A3FF00]/15 border-[#A3FF00] text-[#A3FF00] font-bold shadow-sm"
                                : "bg-[#080B10] border-[#273244] text-[#929BAA]"
                            }`}
                          >
                            <span className="block font-black text-xs mb-0.5">
                              {stage.completed ? "✓" : idx + 1}
                            </span>
                            <span className="leading-tight block">{stage.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline Controls (Filter, Search, Sort) */}
                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs font-mono">
                      {/* Search */}
                      <div className="flex-1 relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={timelineSearch}
                          onChange={(e) => setTimelineSearch(e.target.value)}
                          placeholder="Search events by ID, worker, or keyword..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#151C27] border border-[#273244] text-white text-xs focus:outline-hidden focus:border-[#A3FF00]"
                        />
                      </div>

                      {/* Category Filter */}
                      <select
                        value={timelineCategory}
                        onChange={(e) => setTimelineCategory(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#151C27] border border-[#273244] text-white text-xs"
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Account">Account Events</option>
                        <option value="Purchase">Purchase Events</option>
                        <option value="Payment">Payment Events</option>
                        <option value="Allocation">Allocation Events</option>
                        <option value="Contract">Contract Events</option>
                        <option value="Admin">Admin Events</option>
                        <option value="Support">Support Events</option>
                        <option value="Security">Security Events</option>
                      </select>

                      {/* Sort Order */}
                      <button
                        type="button"
                        onClick={() => setTimelineSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                        className="px-3 py-1.5 rounded-xl bg-[#151C27] hover:bg-[#1E293B] border border-[#273244] text-white flex items-center gap-1.5"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#A3FF00]" />
                        <span>{timelineSortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
                      </button>
                    </div>

                    {/* Vertical Chronological Timeline */}
                    <div className="relative pl-6 space-y-4 border-l-2 border-[#273244] ml-3">
                      {filteredTimelineEvents.map((evt: any) => {
                        const isExpanded = !!expandedEventIds[evt.id];
                        const dateFormatted = new Date(evt.timestamp).toLocaleString();

                        // Event badge styling
                        let badgeBg = "bg-[#35E878]/15 text-[#35E878] border-[#35E878]/30";
                        if (evt.status === "PENDING") {
                          badgeBg = "bg-[#FFC928]/15 text-[#FFC928] border-[#FFC928]/30";
                        } else if (evt.status === "FAILED") {
                          badgeBg = "bg-[#FF5555]/15 text-[#FF5555] border-[#FF5555]/30";
                        }

                        return (
                          <div key={evt.id} className="relative group">
                            {/* Connector Node */}
                            <div
                              className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-[#080B10] flex items-center justify-center ${
                                evt.status === "COMPLETED"
                                  ? "border-[#35E878]"
                                  : evt.status === "PENDING"
                                  ? "border-[#FFC928]"
                                  : "border-[#FF5555]"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  evt.status === "COMPLETED"
                                    ? "bg-[#35E878]"
                                    : evt.status === "PENDING"
                                    ? "bg-[#FFC928]"
                                    : "bg-[#FF5555]"
                                }`}
                              />
                            </div>

                            {/* Event Card */}
                            <div className="p-3.5 rounded-2xl bg-[#151C27] border border-[#273244] hover:border-[#A3FF00]/40 transition-all space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-white">{evt.title}</span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border font-mono ${badgeBg}`}
                                    >
                                      {evt.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    {evt.description}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleEventExpanded(evt.id)}
                                  className="p-1 rounded text-slate-400 hover:text-white"
                                >
                                  <ChevronDown
                                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  />
                                </button>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-[#273244]/60">
                                <span>{dateFormatted}</span>
                                <span className="text-[#A3FF00] font-bold">{evt.source}</span>
                              </div>

                              {/* Expandable Metadata */}
                              {isExpanded && evt.metadata && (
                                <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244] text-[11px] font-mono space-y-1 mt-2 text-slate-300">
                                  <div className="text-[10px] uppercase text-slate-500 font-bold">Metadata</div>
                                  <pre className="text-[10px] text-[#A3FF00] whitespace-pre-wrap break-all overflow-x-auto">
                                    {JSON.stringify(evt.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {filteredTimelineEvents.length === 0 && (
                        <div className="p-8 text-center bg-[#151C27] rounded-2xl border border-[#273244] text-xs font-mono text-slate-400">
                          No customer journey events found matching search criteria.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 2: OVERVIEW                                       */}
                {/* ===================================================== */}
                {activeTab === "overview" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <h3 className="text-sm font-black text-white">Full Customer Profile Specification</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Full Name</span>
                          <span className="text-sm font-bold text-white">{cust?.fullName}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Email Address</span>
                          <span className="text-sm font-bold text-white">{cust?.email}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Customer UUID</span>
                          <span className="text-xs font-bold text-[#A3FF00] break-all">{cust?.id}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Account Registration Date</span>
                          <span className="text-xs text-white">
                            {cust?.registrationDate ? new Date(cust.registrationDate).toLocaleString() : "—"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Email Verification Timestamp</span>
                          <span className="text-xs text-white">
                            {cust?.emailConfirmedAt ? new Date(cust.emailConfirmedAt).toLocaleString() : "Unverified"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Last Successful Sign In</span>
                          <span className="text-xs text-[#35E878] font-bold">
                            {cust?.lastLoginAt ? new Date(cust.lastLoginAt).toLocaleString() : "No login records"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Geographic Region</span>
                          <span className="text-xs text-white">{cust?.country}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Phone / Communication</span>
                          <span className="text-xs text-white">{cust?.phone || "Not provided"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 3: MINING PERFORMANCE                             */}
                {/* ===================================================== */}
                {activeTab === "mining" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white">Pool-Reported ASIC Telemetry</h3>
                        <span className="text-[11px] text-slate-400">Strictly Non-Fabricated</span>
                      </div>

                      {cards?.hashrateStatus === "Data unavailable" ? (
                        <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
                          <Cpu className="w-8 h-8 text-amber-400 mx-auto" />
                          <h4 className="text-white font-bold">Live Mining Telemetry Unavailable</h4>
                          <p className="text-slate-300 text-xs leading-relaxed max-w-md mx-auto">
                            The Segments Equalizer API endpoint is not authenticated. In accordance with zero-fake-data policies, no simulated hashrate is displayed.
                          </p>
                          <button
                            type="button"
                            onClick={() => loadCustomer360(true)}
                            className="px-4 py-2 rounded-xl bg-[#A3FF00] hover:bg-[#8EE600] text-black font-black text-xs transition-colors"
                          >
                            Retry Telemetry Connection
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                            <span className="text-[10px] text-slate-500 uppercase block">Current Hashrate</span>
                            <span className="text-lg font-black text-white">{cards?.currentHashrateTh} TH/s</span>
                          </div>
                          <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                            <span className="text-[10px] text-slate-500 uppercase block">24h Average</span>
                            <span className="text-lg font-black text-white">{cards?.hashrate24hAvgTh} TH/s</span>
                          </div>
                          <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                            <span className="text-[10px] text-slate-500 uppercase block">Telemetry Source</span>
                            <span className="text-xs font-bold text-[#A3FF00]">{cards?.hashrateDataSource}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 4: PURCHASES (ORDER HISTORY)                      */}
                {/* ===================================================== */}
                {activeTab === "purchases" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white">Customer Orders ({data.orders?.length || 0})</h3>
                        <span className="text-[11px] text-slate-400">NOWPayments & Checkout Gateway</span>
                      </div>

                      <div className="space-y-2">
                        {(data.orders || []).map((ord: any) => (
                          <div
                            key={ord.id}
                            className="p-3.5 rounded-xl bg-[#080B10] border border-[#273244] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">
                                Order #{ord.id.slice(0, 8)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  ord.status === "PAID"
                                    ? "bg-[#35E878]/15 text-[#35E878] border border-[#35E878]/30"
                                    : "bg-[#FFC928]/15 text-[#FFC928] border border-[#FFC928]/30"
                                }`}
                              >
                                {ord.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                              <div>
                                <span className="text-[9px] text-slate-500 block">Hashrate</span>
                                <span className="font-bold text-[#A3FF00]">{ord.hashrate_th} TH/s</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Duration</span>
                                <span>{ord.duration_days} Days</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Amount</span>
                                <span className="font-bold text-white">${Number(ord.total_usd).toFixed(2)} USD</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Gateway ID</span>
                                <span className="truncate">{ord.nowpayments_payment_id || "sandbox"}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {(data.orders || []).length === 0 && (
                          <div className="py-8 text-center text-slate-500">No purchases found.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 5: CONTRACTS                                      */}
                {/* ===================================================== */}
                {activeTab === "contracts" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white">Active & Past Contracts ({data.contracts?.length || 0})</h3>
                      </div>

                      <div className="space-y-3">
                        {(data.contracts || []).map((c: any) => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl bg-[#080B10] border border-[#273244] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">
                                Contract #{c.id.slice(0, 8)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  c.status === "ACTIVE"
                                    ? "bg-[#35E878]/15 text-[#35E878] border border-[#35E878]/30"
                                    : "bg-[#FFC928]/15 text-[#FFC928] border border-[#FFC928]/30"
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                              <div>
                                <span className="text-[9px] text-slate-500 block">Compute</span>
                                <span className="font-bold text-[#A3FF00]">{c.hashrate_th} TH/s</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Duration</span>
                                <span>{c.duration_days} Days</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Activation</span>
                                <span>{c.start_date ? new Date(c.start_date).toLocaleDateString() : "Pending"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">Expiration</span>
                                <span>{c.end_date ? new Date(c.end_date).toLocaleDateString() : "Pending"}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {(data.contracts || []).length === 0 && (
                          <div className="py-8 text-center text-slate-500">No active contracts found.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 6: WALLET & TRANSACTIONS                          */}
                {/* ===================================================== */}
                {activeTab === "wallet" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Ledger Balance</span>
                          <span className="text-2xl font-black text-[#A3FF00]">
                            ${Number(cust?.walletBalanceUsdt || 0).toFixed(2)} USDT
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowWalletModal(true)}
                          className="px-3.5 py-2 rounded-xl bg-[#A3FF00] hover:bg-[#8EE600] text-black font-black text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adjust Balance</span>
                        </button>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#273244]">
                        <span className="text-[11px] font-bold text-slate-400 block">
                          Transaction Ledger ({data.walletLedger?.length || 0})
                        </span>
                        {(data.walletLedger || []).map((tx: any) => (
                          <div
                            key={tx.id}
                            className="p-3 rounded-xl bg-[#080B10] border border-[#273244] flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">{tx.description}</div>
                              <div className="text-[10px] text-slate-500">
                                {new Date(tx.date).toLocaleString()} • Ref: {tx.reference}
                              </div>
                            </div>
                            <span
                              className={`font-black font-mono ${
                                tx.amount >= 0 ? "text-[#35E878]" : "text-[#FF5555]"
                              }`}
                            >
                              {tx.amount >= 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                            </span>
                          </div>
                        ))}

                        {(data.walletLedger || []).length === 0 && (
                          <div className="py-6 text-center text-slate-500">No wallet transactions recorded.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 7: ACTIVITY & LOGIN HISTORY                       */}
                {/* ===================================================== */}
                {activeTab === "activity" && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <h3 className="text-sm font-black text-white">Authentication & Account Activity</h3>
                      <div className="space-y-2">
                        {data.timelineEvents
                          ?.filter((e: any) => e.category === "Account" || e.category === "Security")
                          .map((act: any) => (
                            <div
                              key={act.id}
                              className="p-3 rounded-xl bg-[#080B10] border border-[#273244] flex items-center justify-between gap-3"
                            >
                              <div>
                                <span className="font-bold text-white block">{act.title}</span>
                                <span className="text-[11px] text-slate-400">{act.description}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {new Date(act.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 8: SUPPORT & PRIVATE NOTES                        */}
                {/* ===================================================== */}
                {activeTab === "support" && (
                  <div className="space-y-4 font-mono text-xs">
                    {/* Private Internal Admin Notes */}
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white">Private Internal Admin Notes</h3>
                        <button
                          type="button"
                          onClick={() => setShowAddNoteModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-[#A3FF00] hover:bg-[#8EE600] text-black font-black text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Note</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(data.adminNotes || []).map((n: any) => (
                          <div
                            key={n.id}
                            className="p-3 rounded-xl bg-[#080B10] border border-[#273244] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#A3FF00]">{n.adminName}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(n.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-200 text-xs leading-relaxed">{n.content}</p>
                          </div>
                        ))}

                        {(data.adminNotes || []).length === 0 && (
                          <div className="py-6 text-center text-slate-500">
                            No internal staff notes on this profile.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Support Tickets */}
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <h3 className="text-sm font-black text-white">
                        Customer Tickets ({data.tickets?.length || 0})
                      </h3>
                      <div className="space-y-2">
                        {(data.tickets || []).map((t: any) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-[#080B10] border border-[#273244] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">
                                #{t.ticket_code || t.id.slice(0, 8)} • {t.subject}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-400 font-bold">
                                {t.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{t.message}</p>
                          </div>
                        ))}

                        {(data.tickets || []).length === 0 && (
                          <div className="py-6 text-center text-slate-500">No support tickets found.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================================================== */}
                {/* TAB 9: SECURITY                                       */}
                {/* ===================================================== */}
                {activeTab === "security" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#151C27] border border-[#273244] space-y-3">
                      <h3 className="text-sm font-black text-white">Security & Access Governance</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Email Status</span>
                          <span className="font-bold text-white">
                            {data.security?.isEmailVerified ? "Confirmed via Auth Provider" : "Unverified"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Account Access</span>
                          <span
                            className={`font-bold ${
                              data.security?.accountStatus === "DISABLED" ? "text-[#FF5555]" : "text-[#35E878]"
                            }`}
                          >
                            {data.security?.accountStatus}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Last Authenticated Session</span>
                          <span className="font-bold text-white">
                            {data.security?.lastLoginAt ? new Date(data.security.lastLoginAt).toLocaleString() : "None"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080B10] border border-[#273244]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Ban Duration</span>
                          <span className="font-bold text-white">
                            {data.security?.bannedUntil ? `Banned until ${data.security.bannedUntil}` : "No Active Bans"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ========================================================= */}
          {/* MODAL: ADD PRIVATE STAFF NOTE                             */}
          {/* ========================================================= */}
          {showAddNoteModal && (
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 font-mono text-xs">
              <div className="w-full max-w-md rounded-2xl bg-[#10151E] border border-[#273244] p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">Add Private Staff Note</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddNoteModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddNote} className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                      Note Content (Internal Only)
                    </label>
                    <textarea
                      rows={4}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Enter internal details, VIP status, verification notes or telephone interactions..."
                      className="w-full p-3 rounded-xl bg-[#080B10] border border-[#273244] text-white focus:outline-hidden focus:border-[#A3FF00]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                      Priority Level
                    </label>
                    <select
                      value={newNotePriority}
                      onChange={(e: any) => setNewNotePriority(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#080B10] border border-[#273244] text-white"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent / Flagged</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddNoteModal(false)}
                      className="px-4 py-2 rounded-xl bg-[#151C27] text-slate-300 font-bold hover:bg-[#1E293B]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionSubmitting}
                      className="px-4 py-2 rounded-xl bg-[#A3FF00] hover:bg-[#8EE600] text-black font-black"
                    >
                      {actionSubmitting ? "Saving..." : "Save Private Note"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL: ADJUST WALLET BALANCE                              */}
          {/* ========================================================= */}
          {showWalletModal && (
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 font-mono text-xs">
              <div className="w-full max-w-md rounded-2xl bg-[#10151E] border border-[#273244] p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">Manual Wallet Adjustment</h3>
                  <button
                    type="button"
                    onClick={() => setShowWalletModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  ⚠️ <strong>Immutable Ledger Requirement:</strong> Any manual balance adjustment writes an immutable entry into the operations audit log recording your Admin ID, reason, and previous/new balances.
                </div>

                <form onSubmit={handleAdjustWallet} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                        Adjustment Type
                      </label>
                      <select
                        value={walletAdjustType}
                        onChange={(e: any) => setWalletAdjustType(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#080B10] border border-[#273244] text-white"
                      >
                        <option value="CREDIT">Credit (+) Deposit</option>
                        <option value="DEBIT">Debit (-) Deduction</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                        Amount (USDT)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={walletAdjustAmount}
                        onChange={(e) => setWalletAdjustAmount(e.target.value)}
                        placeholder="e.g. 50.00"
                        className="w-full p-2.5 rounded-xl bg-[#080B10] border border-[#273244] text-white focus:outline-hidden focus:border-[#A3FF00]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                      Mandatory Reason (Auditable)
                    </label>
                    <input
                      type="text"
                      value={walletAdjustReason}
                      onChange={(e) => setWalletAdjustReason(e.target.value)}
                      placeholder="e.g. Compensation for maintenance window / wire settlement"
                      className="w-full p-2.5 rounded-xl bg-[#080B10] border border-[#273244] text-white focus:outline-hidden focus:border-[#A3FF00]"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowWalletModal(false)}
                      className="px-4 py-2 rounded-xl bg-[#151C27] text-slate-300 font-bold hover:bg-[#1E293B]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionSubmitting}
                      className="px-4 py-2 rounded-xl bg-[#A3FF00] hover:bg-[#8EE600] text-black font-black"
                    >
                      {actionSubmitting ? "Adjusting..." : "Apply Adjustment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL: DISABLE ACCOUNT CONFIRMATION                       */}
          {/* ========================================================= */}
          {showDisableModal && (
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 font-mono text-xs">
              <div className="w-full max-w-md rounded-2xl bg-[#10151E] border border-red-500/40 p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-red-400">Confirm Account Disabling</h3>
                  <button
                    type="button"
                    onClick={() => setShowDisableModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">
                  Disabling customer <strong className="text-white">{cust?.email}</strong> will restrict active sessions and prevent login. Please specify the mandatory operational reason:
                </p>

                <textarea
                  rows={3}
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="Mandatory reason: Suspicious chargeback, compliance review, etc."
                  className="w-full p-3 rounded-xl bg-[#080B10] border border-red-500/30 text-white focus:outline-hidden focus:border-red-400 text-xs"
                  required
                />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisableModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#151C27] text-slate-300 font-bold hover:bg-[#1E293B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionSubmitting || disableReason.trim().length < 5}
                    onClick={() => handleToggleAccount("disable")}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black disabled:opacity-50"
                  >
                    {actionSubmitting ? "Disabling..." : "Disable Account"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
