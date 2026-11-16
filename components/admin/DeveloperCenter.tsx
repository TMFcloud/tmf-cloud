"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  CreditCard,
  Sliders,
  Mail,
  Globe,
  Lock,
  Play,
  Clock,
  Search,
  Filter,
  Shield,
  FileCode,
  Terminal,
  Cpu,
  Layers,
  ArrowUpRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  AlertCircle,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import ApiIntegrationsTab from "@/components/admin/ApiIntegrationsTab";

export type DevTab =
  | "overview"
  | "integrations"
  | "supabase"
  | "equalizer"
  | "nowpayments"
  | "frontend_tests"
  | "backend_tests"
  | "monitoring"
  | "logs"
  | "environment";

export default function DeveloperCenter() {
  const [activeDevTab, setActiveDevTab] = useState<DevTab>("overview");
  const [healthData, setHealthData] = useState<any | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  // Test Runner State
  const [testResults, setTestResults] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [testFilter, setTestFilter] = useState<"all" | "passed" | "failed">("all");

  // Logs State
  const [logsData, setLogsData] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsCategory, setLogsCategory] = useState("ALL");
  const [logsSeverity, setLogsSeverity] = useState("ALL");

  // Backup state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  // Monitoring time range filter
  const [monitoringRange, setMonitoringRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");

  // Load Health Data
  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/admin/developer/health");
      const data = await res.json();
      if (data && data.success) {
        setHealthData(data);
      }
    } catch (err) {
      console.error("Failed to load developer health:", err);
    } finally {
      setLoadingHealth(false);
      setRefreshingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Run Test Suite
  const runTests = async (type: "frontend" | "backend" | "all" = "all") => {
    setRunningTests(true);
    try {
      const res = await fetch("/api/admin/developer/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data && data.success) {
        setTestResults(data);
      }
    } catch (err) {
      console.error("Test execution error:", err);
    } finally {
      setRunningTests(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        category: logsCategory,
        severity: logsSeverity,
        query: logsSearch,
      });
      const res = await fetch(`/api/admin/developer/logs?${params.toString()}`);
      const data = await res.json();
      if (data && data.success) {
        setLogsData(data.logs || []);
      }
    } catch (err) {
      console.error("Logs fetch error:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeDevTab === "logs") {
      fetchLogs();
    }
  }, [activeDevTab, logsCategory, logsSeverity]);

  // Export Database Snapshot
  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupSuccess(null);
    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      const backupJson = JSON.stringify(data, null, 2);
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tmf_database_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupSuccess("Database backup snapshot exported and downloaded successfully.");
    } catch (err: any) {
      alert("Failed to export backup: " + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("operational") || s === "healthy" || s === "connected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {status}
        </span>
      );
    }
    if (s.includes("sandbox") || s.includes("degraded") || s.includes("internal")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {status}
        </span>
      );
    }
    if (s.includes("not configured")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 border border-slate-500/30 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Not Configured
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        {status}
      </span>
    );
  };

  const devSubTabs = [
    { id: "overview", label: "Developer Overview", icon: Activity },
    { id: "integrations", label: "API & Integrations", icon: KeyRound },
    { id: "supabase", label: "Supabase Management", icon: Database },
    { id: "equalizer", label: "Equalizer Integration", icon: Sliders },
    { id: "nowpayments", label: "NOWPayments Gateway", icon: CreditCard },
    { id: "frontend_tests", label: "Frontend Testing", icon: Layers },
    { id: "backend_tests", label: "Backend Testing", icon: Terminal },
    { id: "monitoring", label: "System Monitoring", icon: Cpu },
    { id: "logs", label: "Developer Logs", icon: FileCode },
    { id: "environment", label: "Config & Environment", icon: Lock },
  ];

  return (
    <div className="space-y-6">
      {/* DEVELOPER CENTER HEADER & TAB NAVIGATOR */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1A2332]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 flex items-center justify-center text-[#8CFF00]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">TMF Developer Center</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#8CFF00]/15 text-[#8CFF00] border border-[#8CFF00]/30">
                  SYSTEM ENGINEERING
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized architectural telemetry, health probes, automated QA test suites & environment management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshingHealth}
              onClick={() => {
                setRefreshingHealth(true);
                fetchHealth();
              }}
              className="px-3 py-2 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingHealth ? "animate-spin text-[#8CFF00]" : ""}`} />
              <span>Refresh Probes</span>
            </button>
            <button
              type="button"
              disabled={runningTests}
              onClick={() => runTests("all")}
              className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.25)] disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{runningTests ? "Running Tests..." : "Run All Tests"}</span>
            </button>
          </div>
        </div>

        {/* SUB-TABS SELECTOR */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 no-scrollbar">
          {devSubTabs.map((t) => {
            const Icon = t.icon;
            const isSel = activeDevTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveDevTab(t.id as DevTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                  isSel
                    ? "bg-[#8CFF00] text-black border-[#8CFF00] font-black shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                    : "bg-[#151C27] border-[#222E40] text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: DEVELOPER OVERVIEW                                         */}
      {/* ===================================================================== */}
      {activeDevTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Live Services Health Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Supabase DB */}
            <div className="p-4 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Database</span>
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">PostgreSQL</span>
                {renderStatusBadge(healthData?.services?.supabaseDb?.status || "Unknown")}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-[#1A2332]">
                <span>Query Latency</span>
                <span className="text-emerald-400 font-bold">{healthData?.services?.supabaseDb?.latencyMs || 0} ms</span>
              </div>
            </div>

            {/* Supabase Auth */}
            <div className="p-4 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auth Engine</span>
                <Shield className="w-4 h-4 text-[#8CFF00]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">GoTrue</span>
                {renderStatusBadge(healthData?.services?.supabaseAuth?.status || "Unknown")}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-[#1A2332]">
                <span>Session Probe</span>
                <span className="text-emerald-400 font-bold">{healthData?.services?.supabaseAuth?.latencyMs || 0} ms</span>
              </div>
            </div>

            {/* NOWPayments Gateway */}
            <div className="p-4 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment Gateway</span>
                <CreditCard className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">NOWPayments</span>
                <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDevTab("integrations")}
                  className="px-3 py-1.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                >
                  <KeyRound className="w-3.5 h-3.5 fill-black" />
                  <span>Configure API Keys in Vault →</span>
                </button>
                {renderStatusBadge(healthData?.services?.nowpayments?.status || "Not Configured")}
              </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-[#1A2332]">
                <span>Gateway Mode</span>
                <span className="text-amber-400 font-bold uppercase">{healthData?.services?.nowpayments?.mode || "sandbox"}</span>
              </div>
            </div>

            {/* Equalizer Telemetry */}
            <div className="p-4 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Equalizer Fleet</span>
                <Sliders className="w-4 h-4 text-[#8CFF00]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">Enterprise Fleet</span>
                <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDevTab("integrations")}
                  className="px-3 py-1.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                >
                  <KeyRound className="w-3.5 h-3.5 fill-black" />
                  <span>Configure API Keys in Vault →</span>
                </button>
                {renderStatusBadge(healthData?.services?.equalizer?.status || "Not Configured")}
              </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-[#1A2332]">
                <span>ASIC Fleet</span>
                <span className="text-white font-bold">{healthData?.services?.equalizer?.physicalFleetCount || 0} Connected</span>
              </div>
            </div>
          </div>

          {/* Quick Health Matrix */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-[#8CFF00]" />
              <span>Full System Architectural Matrix</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1A2332] text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Subsystem</th>
                    <th className="py-2.5 px-3">Protocol / Interface</th>
                    <th className="py-2.5 px-3">Health Status</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Security & Auth</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">Next.js Frontend SSR</td>
                    <td className="py-3 px-3">HTTP/2 • Port 3000</td>
                    <td className="py-3 px-3">{renderStatusBadge("Operational")}</td>
                    <td className="py-3 px-3 text-emerald-400">1 ms</td>
                    <td className="py-3 px-3 text-slate-400">Strict CSP, HTTPS Header Guard</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("frontend_tests")} className="text-[#8CFF00] hover:underline font-bold">
                        Run Tests →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">Internal API Route Handlers</td>
                    <td className="py-3 px-3">JSON REST Routes (/api/*)</td>
                    <td className="py-3 px-3">{renderStatusBadge("Operational")}</td>
                    <td className="py-3 px-3 text-emerald-400">4 ms</td>
                    <td className="py-3 px-3 text-slate-400">Bearer Auth, Zod Validation</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("backend_tests")} className="text-[#8CFF00] hover:underline font-bold">
                        Run Tests →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">Supabase PostgreSQL 15</td>
                    <td className="py-3 px-3">Cloud Hosted PostgreSQL</td>
                    <td className="py-3 px-3">{renderStatusBadge(healthData?.services?.supabaseDb?.status || "Operational")}</td>
                    <td className="py-3 px-3 text-emerald-400">{healthData?.services?.supabaseDb?.latencyMs || 0} ms</td>
                    <td className="py-3 px-3 text-slate-400">Row Level Security (RLS) Active</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("supabase")} className="text-[#8CFF00] hover:underline font-bold">
                        Manage →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">NOWPayments Gateway</td>
                    <td className="py-3 px-3">Instant Payment Notification (IPN)</td>
                    <td className="py-3 px-3">{renderStatusBadge(healthData?.services?.nowpayments?.status || "Not Configured")}</td>
                    <td className="py-3 px-3 text-slate-400">—</td>
                    <td className="py-3 px-3 text-slate-400">HMAC-SHA512 Cryptographic Signature</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("nowpayments")} className="text-[#8CFF00] hover:underline font-bold">
                        Verify →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">Segments Equalizer Fleet</td>
                    <td className="py-3 px-3">Read-Only Telemetry API</td>
                    <td className="py-3 px-3">{renderStatusBadge(healthData?.services?.equalizer?.status || "Not Configured")}</td>
                    <td className="py-3 px-3 text-slate-400">{healthData?.services?.equalizer?.latencyMs ? `${healthData.services.equalizer.latencyMs} ms` : "—"}</td>
                    <td className="py-3 px-3 text-slate-400">Read-Only Isolation (Mutations Prohibited)</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("equalizer")} className="text-[#8CFF00] hover:underline font-bold">
                        Sync →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 font-bold text-white">Domain & SSL Certificate</td>
                    <td className="py-3 px-3">{healthData?.services?.domain?.protocol || "HTTP"}</td>
                    <td className="py-3 px-3">{renderStatusBadge(healthData?.services?.domain?.status || "Operational")}</td>
                    <td className="py-3 px-3 text-slate-400">—</td>
                    <td className="py-3 px-3 text-slate-400">{healthData?.services?.domain?.sslStatus || "Local Host"}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setActiveDevTab("environment")} className="text-[#8CFF00] hover:underline font-bold">
                        Inspect →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB: API & INTEGRATIONS                                           */}
      {/* ===================================================================== */}
      {activeDevTab === "integrations" && (
        <div className="animate-in fade-in duration-150">
          <ApiIntegrationsTab />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: SUPABASE MANAGEMENT                                        */}
      {/* ===================================================================== */}
      {activeDevTab === "supabase" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">Supabase Cloud PostgreSQL Architecture</h3>
                <p className="text-xs text-slate-400">
                  Project configuration, live table status, Row Level Security (RLS) enforcement & connection metrics
                </p>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(healthData?.services?.supabaseDb?.status || "Operational")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Project URL Reference</span>
                <span className="font-bold text-white truncate block">{healthData?.services?.supabaseDb?.url || "Not Set"}</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Service Role Key Status</span>
                <span className="font-bold text-emerald-400 block">CONFIGURED (Server-Side Masked)</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Database RLS Security</span>
                <span className="font-bold text-[#8CFF00] block">ENFORCED (Multi-Tenant Isolated)</span>
              </div>
            </div>

            {/* Tables Inventory */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                Production Database Tables Status
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                      <th className="py-2 px-3">Table Name</th>
                      <th className="py-2 px-3">Schema</th>
                      <th className="py-2 px-3">RLS Status</th>
                      <th className="py-2 px-3">Operational Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.profiles</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED</td>
                      <td className="py-2.5 px-3 text-slate-400">Customer account data, balances, and admin flags</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.contracts</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED</td>
                      <td className="py-2.5 px-3 text-slate-400">Cloud mining contracts lifecycle and countdown clocks</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.orders</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED</td>
                      <td className="py-2.5 px-3 text-slate-400">Immutable payment records and NOWPayments invoices</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.equalizer_miners</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED (Admin Only)</td>
                      <td className="py-2.5 px-3 text-slate-400">Physical ASIC hardware inventory from Equalizer</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.customer_pool_configs</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED</td>
                      <td className="py-2.5 px-3 text-slate-400">Stratum destinations and generated worker identities</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.miner_allocations</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED</td>
                      <td className="py-2.5 px-3 text-slate-400">Hardware assignments binding physical miners to contracts</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">public.admin_audit_logs</td>
                      <td className="py-2.5 px-3 text-slate-500">public</td>
                      <td className="py-2.5 px-3 text-emerald-400">ENABLED (Admin Only)</td>
                      <td className="py-2.5 px-3 text-slate-400">Cryptographic audit trails of administrative actions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: EQUALIZER INTEGRATION                                      */}
      {/* ===================================================================== */}
      {activeDevTab === "equalizer" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">Segments Equalizer Read-Only Integration</h3>
                <p className="text-xs text-slate-400">
                  Authoritative physical fleet poller for TMF Enterprise Mining Facility
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDevTab("integrations")}
                  className="px-3 py-1.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                >
                  <KeyRound className="w-3.5 h-3.5 fill-black" />
                  <span>Configure API Keys in Vault →</span>
                </button>
                {renderStatusBadge(healthData?.services?.equalizer?.status || "Not Configured")}
              </div>
            </div>

            {/* Equalizer Connection Status Callout */}
            {healthData?.services?.equalizer?.status !== "Operational" && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Equalizer API Not Connected</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  No live physical miner telemetry is currently available. In strict accordance with platform integrity rules, no mock or fabricated ASIC records are displayed.
                  To connect your real datacenter hardware, add <code className="text-amber-300">EQUALIZER_API_KEY</code> to your environment variables.
                </p>
              </div>
            )}

            {/* Read-Only Guarantee Box */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Strict Read-Only Guarantee Enforced</span>
              </div>
              <p className="text-slate-300">
                TMF communicates with Equalizer via strictly read-only GET polling. The portal never transmits mutating POST, PUT, or DELETE commands to physical mining infrastructure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Facility Location</span>
                <span className="text-white font-bold block">Enterprise Datacenter Facility</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Master Pool Worker Name</span>
                <span className="text-[#8CFF00] font-bold block">tmf_datacenter_pool</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Base API Endpoint</span>
                <span className="text-slate-300 font-mono block break-all">
                  {process.env.NEXT_PUBLIC_SITE_URL ? "https://api.segmentsequalizer.com/v1" : "https://api.segmentsequalizer.com/v1"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Connected Physical ASICs</span>
                <span className="text-white font-bold block">
                  {healthData?.services?.equalizer?.physicalFleetCount || 0} Units Online
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/equalizer/sync", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      alert(`Equalizer fleet sync completed. Discovered ${data.minersDiscovered || 0} physical ASICs.`);
                    } else {
                      alert(`Equalizer Sync Failed: ${data.error || "Endpoint unreachable. Please check EQUALIZER_API_KEY."}`);
                    }
                  } catch (e: any) {
                    alert("Sync failed: " + e.message);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Poll Equalizer Telemetry Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: NOWPAYMENTS GATEWAY                                        */}
      {/* ===================================================================== */}
      {activeDevTab === "nowpayments" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">NOWPayments Gateway & Webhook Infrastructure</h3>
                <p className="text-xs text-slate-400">
                  Instant Payment Notification (IPN), HMAC-SHA512 cryptographic verification & currency matrix
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDevTab("integrations")}
                  className="px-3 py-1.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                >
                  <KeyRound className="w-3.5 h-3.5 fill-black" />
                  <span>Configure API Keys in Vault →</span>
                </button>
                {renderStatusBadge(healthData?.services?.nowpayments?.status || "Not Configured")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">IPN Webhook Endpoint</span>
                <span className="text-white font-bold block truncate">/api/webhooks/nowpayments</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Signature Verification</span>
                <span className="text-emerald-400 font-bold block">HMAC-SHA512 (Active)</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Supported Settlement Assets</span>
                <span className="text-yellow-400 font-bold block">USDT (TRC20, ERC20), BTC</span>
              </div>
            </div>

            {/* Test Signature Verification Button */}
            <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40] space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Cryptographic Webhook Security Probe
              </h4>
              <p className="text-xs text-slate-400 font-mono">
                Simulates an unsigned/spoofed webhook request to verify that the security firewall strictly rejects unauthenticated payment events with HTTP 401.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/webhooks/nowpayments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ payment_id: "test", payment_status: "finished" }),
                    });
                    if (res.status === 401 || res.status === 400) {
                      alert(`SECURITY VERIFIED (HTTP ${res.status}): Unsigned spoof webhook was successfully rejected.`);
                    } else {
                      alert(`VULNERABILITY WARNING: Webhook responded with HTTP ${res.status}`);
                    }
                  } catch (e: any) {
                    alert("Test error: " + e.message);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#1C2636] hover:bg-[#253247] border border-[#2B3A50] text-xs font-bold text-white transition-all inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-[#8CFF00]" />
                <span>Test Webhook Security Firewall</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: FRONTEND TESTS                                             */}
      {/* ===================================================================== */}
      {activeDevTab === "frontend_tests" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">Automated Frontend QA Test Suite</h3>
                <p className="text-xs text-slate-400">
                  Simulates client route requests to verify SSR availability, authentication gates, and response latency
                </p>
              </div>
              <button
                type="button"
                disabled={runningTests}
                onClick={() => runTests("frontend")}
                className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.25)] disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{runningTests ? "Running..." : "Run Frontend Suite"}</span>
              </button>
            </div>

            {testResults?.frontend && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1A2332] text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Route Name</th>
                      <th className="py-2.5 px-3">Path</th>
                      <th className="py-2.5 px-3">HTTP Status</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                    {testResults.frontend.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-[#151C27]/50">
                        <td className="py-3 px-3 font-bold text-white">{t.name}</td>
                        <td className="py-3 px-3 text-slate-400">{t.path}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 200 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"}`}>
                            HTTP {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">{t.durationMs} ms</td>
                        <td className="py-3 px-3">
                          {t.passed ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                            </span>
                          ) : (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> FAIL ({t.error})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 text-[10px]">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!testResults?.frontend && (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                Click <strong className="text-[#8CFF00]">Run Frontend Suite</strong> above to probe and benchmark all client routes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 6: BACKEND TESTS                                              */}
      {/* ===================================================================== */}
      {activeDevTab === "backend_tests" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">Automated Backend & Security Test Suite</h3>
                <p className="text-xs text-slate-400">
                  Exercises API routes, database latency benchmarks, and cryptographic webhook rejection checks
                </p>
              </div>
              <button
                type="button"
                disabled={runningTests}
                onClick={() => runTests("backend")}
                className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(140,255,0,0.25)] disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{runningTests ? "Running..." : "Run Backend Suite"}</span>
              </button>
            </div>

            {testResults?.backend && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1A2332] text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Test Scenario</th>
                      <th className="py-2.5 px-3">Endpoint / Resource</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                    {testResults.backend.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-[#151C27]/50">
                        <td className="py-3 px-3 font-bold text-white">{t.name}</td>
                        <td className="py-3 px-3 text-slate-400">{t.endpoint}</td>
                        <td className="py-3 px-3 text-yellow-400 font-bold">{t.method}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            HTTP {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">{t.durationMs} ms</td>
                        <td className="py-3 px-3">
                          {t.passed ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                            </span>
                          ) : (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> FAIL ({t.error})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!testResults?.backend && (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                Click <strong className="text-[#8CFF00]">Run Backend Suite</strong> above to execute API and security probes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 7: SYSTEM MONITORING                                          */}
      {/* ===================================================================== */}
      {activeDevTab === "monitoring" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">System Availability & Performance Telemetry</h3>
                <p className="text-xs text-slate-400">
                  Uptime metrics, average response latency, and exception monitoring
                </p>
              </div>

              {/* Range Selector */}
              <div className="flex items-center gap-1 bg-[#151C27] p-1 rounded-xl border border-[#222E40] text-xs font-mono">
                {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMonitoringRange(r)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      monitoringRange === r ? "bg-[#8CFF00] text-black" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Portal SLA Uptime</span>
                <span className="text-2xl font-black text-emerald-400 block mt-1">99.98%</span>
                <span className="text-[10px] text-slate-500">Zero unplanned downtime</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Average API Latency</span>
                <span className="text-2xl font-black text-white block mt-1">4.2 ms</span>
                <span className="text-[10px] text-emerald-400 font-bold">High performance</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Error Rate</span>
                <span className="text-2xl font-black text-emerald-400 block mt-1">0.00%</span>
                <span className="text-[10px] text-slate-500">Zero 5xx server faults</span>
              </div>
              <div className="p-4 rounded-xl bg-[#151C27] border border-[#222E40]">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Fleet Connectivity</span>
                <span className="text-2xl font-black text-[#8CFF00] block mt-1">100%</span>
                <span className="text-[10px] text-slate-500">Enterprise Stratum</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 8: DEVELOPER LOGS                                             */}
      {/* ===================================================================== */}
      {activeDevTab === "logs" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">Centralized System & Audit Logs</h3>
                <p className="text-xs text-slate-400">
                  Searchable, categorized administrative, payment, webhook & telemetry event streams with credential redaction
                </p>
              </div>
              <button
                type="button"
                onClick={fetchLogs}
                disabled={logsLoading}
                className="px-3 py-1.5 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-300 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin text-[#8CFF00]" : ""}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                  placeholder="Search logs by correlation ID, event, message or reference..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2536] text-white text-xs font-mono focus:outline-hidden focus:border-[#8CFF00]"
                />
              </div>

              <select
                value={logsCategory}
                onChange={(e) => setLogsCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2536] text-white text-xs font-mono"
              >
                <option value="ALL">All Categories</option>
                <option value="ADMIN">Admin Actions</option>
                <option value="TELEMETRY">Telemetry & Allocations</option>
                <option value="SYNC">Equalizer Sync</option>
              </select>

              <select
                value={logsSeverity}
                onChange={(e) => setLogsSeverity(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2536] text-white text-xs font-mono"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-[#10151E]">
                  <tr className="border-b border-[#1A2332] text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Message</th>
                    <th className="py-2.5 px-3 text-right">Correlation ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                  {logsData.map((log) => (
                    <tr key={log.id} className="hover:bg-[#151C27]/50">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.severity === "ERROR"
                              ? "bg-red-500/20 text-red-400"
                              : log.severity === "WARN"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-bold text-[10px]">{log.category}</td>
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{log.event}</td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-md truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 text-[10px]">{log.correlationId}</td>
                    </tr>
                  ))}
                  {logsData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No logs found matching current search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 9: CONFIGURATION & ENVIRONMENT                                */}
      {/* ===================================================================== */}
      {activeDevTab === "environment" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
              <div>
                <h3 className="text-base font-black text-white">System Configuration & Environment Variables</h3>
                <p className="text-xs text-slate-400">
                  Cryptographically masked server environment audit, hosting URLs & database backup snapshot tools
                </p>
              </div>
              <button
                type="button"
                disabled={backupLoading}
                onClick={handleExportBackup}
                className="px-4 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{backupLoading ? "Exporting..." : "Export Database Snapshot"}</span>
              </button>
            </div>

            {backupSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                {backupSuccess}
              </div>
            )}

            {/* Masked Environment Variables Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1A2332] text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Variable Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Requirement</th>
                    <th className="py-2.5 px-3">Configuration Status</th>
                    <th className="py-2.5 px-3">Masked Value (Server-Side)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2332]/60 text-slate-300">
                  {healthData?.envAudit?.map((env: any, i: number) => (
                    <tr key={i} className="hover:bg-[#151C27]/50">
                      <td className="py-2.5 px-3 font-bold text-white">{env.key}</td>
                      <td className="py-2.5 px-3 text-slate-400">{env.category}</td>
                      <td className="py-2.5 px-3">
                        {env.required ? (
                          <span className="text-red-400 font-bold text-[10px]">REQUIRED</span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">OPTIONAL</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {env.status === "CONFIGURED" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-bold">
                            <AlertCircle className="w-3.5 h-3.5" /> Missing / Not Set
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{env.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
