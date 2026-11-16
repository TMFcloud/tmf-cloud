"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  Activity,
  Cpu,
  Clock,
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
} from "lucide-react";
import { AdminUser, getStoredAdminUser } from "@/lib/admin-auth";

interface StoredIntegrationSummary {
  id: string;
  provider: "nowpayments" | "equalizer";
  environment: "production" | "sandbox" | "staging";
  maskedPreview: Record<string, string>;
  config: Record<string, any>;
  lastTestedAt: string | null;
  lastTestStatus: "SUCCESS" | "FAILED" | "PENDING" | null;
  lastTestMessage: string | null;
  lastTestLatencyMs: number | null;
  updatedBy: string;
  updatedAt: string;
}

export default function ApiIntegrationsTab() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<"production" | "sandbox">("production");

  // Integrations Data
  const [integrations, setIntegrations] = useState<StoredIntegrationSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form Edit State for NOWPayments
  const [nwpRotateKey, setNwpRotateKey] = useState(false);
  const [nwpNewApiKey, setNwpNewApiKey] = useState("");
  const [nwpRotateSecret, setNwpRotateSecret] = useState(false);
  const [nwpNewIpnSecret, setNwpNewIpnSecret] = useState("");
  const [nwpEndpoint, setNwpEndpoint] = useState("");
  const [savingNwp, setSavingNwp] = useState(false);
  const [testingNwp, setTestingNwp] = useState(false);
  const [nwpTestResult, setNwpTestResult] = useState<any | null>(null);

  // Form Edit State for Equalizer
  const [eqRotateKey, setEqRotateKey] = useState(false);
  const [eqNewApiKey, setEqNewApiKey] = useState("");
  const [eqRotateSecret, setEqRotateSecret] = useState(false);
  const [eqNewApiSecret, setEqNewApiSecret] = useState("");
  const [eqEndpoint, setEqEndpoint] = useState("");
  const [eqClusterId, setEqClusterId] = useState("");
  const [eqTimeout, setEqTimeout] = useState("5000");
  const [savingEq, setSavingEq] = useState(false);
  const [testingEq, setTestingEq] = useState(false);
  const [eqTestResult, setEqTestResult] = useState<any | null>(null);

  // Super Admin Verification Modal
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [pendingSaveTarget, setPendingSaveTarget] = useState<"nowpayments" | "equalizer" | null>(null);
  const [securityPasscode, setSecurityPasscode] = useState("");
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Fetch Current Admin User
  useEffect(() => {
    const user = getStoredAdminUser();
    if (user) setAdminUser(user);
    fetchIntegrations();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchIntegrations = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/developer/integrations");
      const json = await res.json();
      if (json.success) {
        setIntegrations(json.integrations || []);
        setAuditLogs(json.auditLogs || []);
      }
    } catch (err) {
      console.error("Failed to load integrations:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Find record for current selected environment
  const currentNwp = integrations.find(
    (i) => i.provider === "nowpayments" && i.environment === selectedEnv
  );
  const targetEqEnv = selectedEnv === "production" ? "production" : "staging";
  const currentEq = integrations.find(
    (i) => i.provider === "equalizer" && i.environment === targetEqEnv
  );

  // Sync endpoint inputs when active environment or record changes
  useEffect(() => {
    if (currentNwp) {
      setNwpEndpoint(
        currentNwp.config?.endpointUrl ||
          (selectedEnv === "sandbox"
            ? "https://api-sandbox.nowpayments.io/v1"
            : "https://api.nowpayments.io/v1")
      );
    }
    if (currentEq) {
      setEqEndpoint(currentEq.config?.endpointUrl || "https://equalizer-fleet.theminingfuture.com");
      setEqClusterId(currentEq.config?.clusterId || "Cluster 04 Clean Grid");
      setEqTimeout(String(currentEq.config?.timeoutMs || 5000));
    }
    // Reset test banners when switching tabs
    setNwpTestResult(null);
    setEqTestResult(null);
  }, [selectedEnv, currentNwp?.id, currentEq?.id]);

  // Handle Save Initiated
  const handleInitiateSave = (target: "nowpayments" | "equalizer") => {
    // If saving production credentials, enforce Super-Admin verification modal
    if (selectedEnv === "production") {
      if (adminUser?.role !== "superadmin") {
        showToast("Access Denied: Only Super-Admin can modify Production credentials.");
        return;
      }
      setPendingSaveTarget(target);
      setSecurityPasscode("");
      setReauthError(null);
      setShowReauthModal(true);
    } else {
      // Sandbox/Staging does not require modal
      executeSave(target, undefined);
    }
  };

  // Execute Save API Request
  const executeSave = async (target: "nowpayments" | "equalizer", passcode?: string) => {
    if (target === "nowpayments") {
      setSavingNwp(true);
    } else {
      setSavingEq(true);
    }

    try {
      const payload: any = {
        provider: target,
        environment: target === "nowpayments" ? selectedEnv : targetEqEnv,
        adminUser,
        securityPasscode: passcode,
      };

      if (target === "nowpayments") {
        payload.secrets = {
          apiKey: nwpRotateKey ? nwpNewApiKey : undefined,
          ipnSecret: nwpRotateSecret ? nwpNewIpnSecret : undefined,
        };
        payload.config = {
          endpointUrl: nwpEndpoint.trim(),
          isSandbox: selectedEnv === "sandbox",
          ipnCallbackUrl: `${window.location.origin}/api/webhooks/nowpayments`,
        };
      } else {
        payload.secrets = {
          apiKey: eqRotateKey ? eqNewApiKey : undefined,
          apiSecret: eqRotateSecret ? eqNewApiSecret : undefined,
        };
        payload.config = {
          endpointUrl: eqEndpoint.trim(),
          clusterId: eqClusterId.trim(),
          timeoutMs: parseInt(eqTimeout) || 5000,
          readOnlyEnforced: true,
        };
      }

      const res = await fetch("/api/admin/developer/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.requireReauth) {
          setReauthError(json.error || "Security passcode required.");
          return;
        }
        throw new Error(json.error || "Failed to update integration.");
      }

      showToast(json.message || "Credentials securely encrypted and saved!");
      setShowReauthModal(false);

      // Reset rotate toggles
      if (target === "nowpayments") {
        setNwpRotateKey(false);
        setNwpNewApiKey("");
        setNwpRotateSecret(false);
        setNwpNewIpnSecret("");
      } else {
        setEqRotateKey(false);
        setEqNewApiKey("");
        setEqRotateSecret(false);
        setEqNewApiSecret("");
      }

      await fetchIntegrations();
    } catch (err: any) {
      if (showReauthModal) {
        setReauthError(err.message);
      } else {
        showToast(`Save Error: ${err.message}`);
      }
    } finally {
      setSavingNwp(false);
      setSavingEq(false);
    }
  };

  // Handle Backend Test Execution
  const handleTestConnection = async (target: "nowpayments" | "equalizer") => {
    if (target === "nowpayments") {
      setTestingNwp(true);
      setNwpTestResult(null);
    } else {
      setTestingEq(true);
      setEqTestResult(null);
    }

    try {
      const payload: any = {
        provider: target,
        environment: target === "nowpayments" ? selectedEnv : targetEqEnv,
        adminUser,
      };

      if (target === "nowpayments") {
        if (nwpRotateKey && nwpNewApiKey) {
          payload.candidateApiKey = nwpNewApiKey;
        }
        payload.candidateEndpointUrl = nwpEndpoint;
      } else {
        if (eqRotateKey && eqNewApiKey) {
          payload.candidateApiKey = eqNewApiKey;
        }
        payload.candidateEndpointUrl = eqEndpoint;
      }

      const res = await fetch("/api/admin/developer/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success && json.result) {
        if (target === "nowpayments") {
          setNwpTestResult(json.result);
        } else {
          setEqTestResult(json.result);
        }
        await fetchIntegrations();
      } else {
        const errorResult = {
          success: false,
          latencyMs: 0,
          message: json.error || "Test connection failed.",
          timestamp: new Date().toISOString(),
        };
        if (target === "nowpayments") {
          setNwpTestResult(errorResult);
        } else {
          setEqTestResult(errorResult);
        }
      }
    } catch (err: any) {
      const errRes = {
        success: false,
        latencyMs: 0,
        message: err.message || "Network error occurred during test.",
        timestamp: new Date().toISOString(),
      };
      if (target === "nowpayments") {
        setNwpTestResult(errRes);
      } else {
        setEqTestResult(errRes);
      }
    } finally {
      setTestingNwp(false);
      setTestingEq(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-[#151C27] border border-[#8CFF00]/40 text-white font-mono text-xs shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#8CFF00]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & ENVIRONMENT SELECTOR */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 flex items-center justify-center text-[#8CFF00]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">API & Integrations Hub</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#8CFF00]/15 text-[#8CFF00] border border-[#8CFF00]/30 uppercase">
                  ENTERPRISE VAULT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically secured credentials store (AES-256-GCM), live gateway testing & webhook state verifier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshing}
              onClick={fetchIntegrations}
              className="px-3 py-2 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#8CFF00]" : ""}`} />
              <span>Refresh Vault</span>
            </button>
          </div>
        </div>

        {/* ENVIRONMENT SELECTOR PILLS */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#1A2332]/80">
          <div className="flex items-center gap-2 bg-[#0A0D14] p-1 rounded-xl border border-[#1A2332] w-fit">
            <button
              type="button"
              onClick={() => setSelectedEnv("production")}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                selectedEnv === "production"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Production Vault</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedEnv("sandbox")}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                selectedEnv === "sandbox"
                  ? "bg-[#8CFF00]/20 text-[#8CFF00] border border-[#8CFF00]/40 shadow-[0_0_15px_rgba(140,255,0,0.2)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#8CFF00]" />
              <span>Sandbox / Staging Mode</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#8CFF00]" />
            <span>
              {selectedEnv === "production" ? (
                <strong className="text-amber-400">Strict Super-Admin Authorization Enforced</strong>
              ) : (
                <span className="text-emerald-400">Isolated Test Environment (Live payments disabled)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* TWO MAIN INTEGRATION CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================================================================= */}
        {/* CARD 1: NOWPAYMENTS GATEWAY                                       */}
        {/* ================================================================= */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A2332]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">NOWPayments Gateway Engine</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Official cryptocurrency invoice billing & automated stratum order confirmations
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                    currentNwp?.lastTestStatus === "SUCCESS"
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                      : currentNwp?.lastTestStatus === "FAILED"
                      ? "bg-red-500/15 border border-red-500/30 text-red-400"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentNwp?.lastTestStatus === "SUCCESS"
                        ? "bg-emerald-400"
                        : currentNwp?.lastTestStatus === "FAILED"
                        ? "bg-red-400"
                        : "bg-slate-400"
                    }`}
                  />
                  <span>
                    {currentNwp?.lastTestStatus === "SUCCESS"
                      ? "Operational"
                      : currentNwp?.lastTestStatus === "FAILED"
                      ? "Degraded"
                      : "Untested"}
                  </span>
                </span>
                {currentNwp?.lastTestLatencyMs !== null && currentNwp?.lastTestLatencyMs !== undefined && (
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Latency: {currentNwp.lastTestLatencyMs}ms
                  </div>
                )}
              </div>
            </div>

            {/* Test Result Feedback Banner */}
            {nwpTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                  nwpTestResult.success
                    ? "bg-[#0F1C12] border-emerald-500/40 text-emerald-300"
                    : "bg-[#1E1111] border-red-500/40 text-red-300"
                }`}
              >
                {nwpTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{nwpTestResult.success ? "Connection Verified" : "Connection Failed"}</span>
                    <span className="text-[10px] opacity-75">{nwpTestResult.latencyMs}ms</span>
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90">{nwpTestResult.message}</p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 font-mono text-xs">
              {/* NOWPayments API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#8CFF00]" />
                    <span>API Key ({selectedEnv})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNwpRotateKey(!nwpRotateKey);
                      setNwpNewApiKey("");
                    }}
                    className="text-[10px] text-[#8CFF00] hover:underline"
                  >
                    {nwpRotateKey ? "Cancel Rotation" : "Rotate / Update Key"}
                  </button>
                </div>

                {nwpRotateKey ? (
                  <input
                    type="password"
                    value={nwpNewApiKey}
                    onChange={(e) => setNwpNewApiKey(e.target.value)}
                    placeholder="Enter new NOWPayments API Key"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#8CFF00]/50 text-white focus:outline-none"
                  />
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-slate-300 flex items-center justify-between">
                    <span className="select-all font-bold">
                      {currentNwp?.maskedPreview?.apiKey || "Not Configured"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-sans">Encrypted Vault</span>
                  </div>
                )}
              </div>

              {/* IPN Secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>IPN Callback Secret (HMAC-SHA512)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNwpRotateSecret(!nwpRotateSecret);
                      setNwpNewIpnSecret("");
                    }}
                    className="text-[10px] text-[#8CFF00] hover:underline"
                  >
                    {nwpRotateSecret ? "Cancel Rotation" : "Rotate Secret"}
                  </button>
                </div>

                {nwpRotateSecret ? (
                  <input
                    type="password"
                    value={nwpNewIpnSecret}
                    onChange={(e) => setNwpNewIpnSecret(e.target.value)}
                    placeholder="Enter new NOWPayments IPN Secret"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#8CFF00]/50 text-white focus:outline-none"
                  />
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-slate-300 flex items-center justify-between">
                    <span className="select-all font-bold">
                      {currentNwp?.maskedPreview?.ipnSecret || "Not Configured"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-sans">Encrypted Vault</span>
                  </div>
                )}
              </div>

              {/* API Endpoint */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  API Gateway Base URL
                </label>
                <input
                  type="text"
                  value={nwpEndpoint}
                  onChange={(e) => setNwpEndpoint(e.target.value)}
                  placeholder="https://api.nowpayments.io/v1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none"
                />
              </div>

              {/* IPN Webhook URL Preview (Read-only copyable) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Authoritative IPN Callback Endpoint</span>
                  <span className="text-emerald-400 lowercase font-sans">HMAC-SHA512 Verified</span>
                </label>
                <div className="flex items-center rounded-xl bg-[#0A0D14] border border-[#1A2332] overflow-hidden">
                  <span className="px-3.5 py-2 text-slate-400 text-xs truncate flex-1 font-mono">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/nowpayments
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/nowpayments`);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }
                    }}
                    className="px-3 py-2 bg-[#151C27] hover:bg-[#1E293B] text-[#8CFF00] text-xs font-bold border-l border-[#1A2332] flex items-center gap-1 shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1A2332] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
            <button
              type="button"
              disabled={testingNwp}
              onClick={() => handleTestConnection("nowpayments")}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 text-emerald-400 ${testingNwp ? "animate-pulse" : ""}`} />
              <span>{testingNwp ? "Testing Gateway..." : "Test Connection"}</span>
            </button>

            <button
              type="button"
              disabled={savingNwp}
              onClick={() => handleInitiateSave("nowpayments")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5 fill-black" />
              <span>{savingNwp ? "Encrypting & Saving..." : "Save Credentials"}</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CARD 2: SEGMENTS EQUALIZER TELEMETRY                             */}
        {/* ================================================================= */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A2332]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 flex items-center justify-center text-[#8CFF00]">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Equalizer Telemetry Engine</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Hardware fleet monitoring, temperature, fan speed & stratum pool allocations
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                    currentEq?.lastTestStatus === "SUCCESS"
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                      : currentEq?.lastTestStatus === "FAILED"
                      ? "bg-red-500/15 border border-red-500/30 text-red-400"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentEq?.lastTestStatus === "SUCCESS"
                        ? "bg-emerald-400"
                        : currentEq?.lastTestStatus === "FAILED"
                        ? "bg-red-400"
                        : "bg-slate-400"
                    }`}
                  />
                  <span>
                    {currentEq?.lastTestStatus === "SUCCESS"
                      ? "Connected"
                      : currentEq?.lastTestStatus === "FAILED"
                      ? "Disconnected"
                      : "Untested"}
                  </span>
                </span>
                {currentEq?.lastTestLatencyMs !== null && currentEq?.lastTestLatencyMs !== undefined && (
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Latency: {currentEq.lastTestLatencyMs}ms
                  </div>
                )}
              </div>
            </div>

            {/* Test Result Feedback Banner */}
            {eqTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                  eqTestResult.success
                    ? "bg-[#0F1C12] border-emerald-500/40 text-emerald-300"
                    : "bg-[#1E1111] border-red-500/40 text-red-300"
                }`}
              >
                {eqTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{eqTestResult.success ? "Equalizer Connected" : "Connection Failed"}</span>
                    <span className="text-[10px] opacity-75">{eqTestResult.latencyMs}ms</span>
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90">{eqTestResult.message}</p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 font-mono text-xs">
              {/* Equalizer Bearer API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#8CFF00]" />
                    <span>Bearer API Key ({targetEqEnv})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEqRotateKey(!eqRotateKey);
                      setEqNewApiKey("");
                    }}
                    className="text-[10px] text-[#8CFF00] hover:underline"
                  >
                    {eqRotateKey ? "Cancel Rotation" : "Rotate / Update Key"}
                  </button>
                </div>

                {eqRotateKey ? (
                  <input
                    type="password"
                    value={eqNewApiKey}
                    onChange={(e) => setEqNewApiKey(e.target.value)}
                    placeholder="Enter new Equalizer Bearer Token"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#8CFF00]/50 text-white focus:outline-none"
                  />
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-slate-300 flex items-center justify-between">
                    <span className="select-all font-bold">
                      {currentEq?.maskedPreview?.apiKey || "Not Configured"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-sans">Encrypted Vault</span>
                  </div>
                )}
              </div>

              {/* API Secret / Secondary Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-cyan-400" />
                    <span>API Secret / Secondary Signature Key (Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEqRotateSecret(!eqRotateSecret);
                      setEqNewApiSecret("");
                    }}
                    className="text-[10px] text-[#8CFF00] hover:underline"
                  >
                    {eqRotateSecret ? "Cancel Rotation" : "Rotate Secret"}
                  </button>
                </div>

                {eqRotateSecret ? (
                  <input
                    type="password"
                    value={eqNewApiSecret}
                    onChange={(e) => setEqNewApiSecret(e.target.value)}
                    placeholder="Enter secondary secret or leave empty"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#8CFF00]/50 text-white focus:outline-none"
                  />
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-slate-300 flex items-center justify-between">
                    <span className="select-all font-bold">
                      {currentEq?.maskedPreview?.apiSecret || "Not Configured"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-sans">Optional</span>
                  </div>
                )}
              </div>

              {/* Equalizer Endpoint */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Cluster API Endpoint URL
                </label>
                <input
                  type="text"
                  value={eqEndpoint}
                  onChange={(e) => setEqEndpoint(e.target.value)}
                  placeholder="https://equalizer-fleet.theminingfuture.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none"
                />
              </div>

              {/* Cluster ID & Timeout */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Cluster ID
                  </label>
                  <input
                    type="text"
                    value={eqClusterId}
                    onChange={(e) => setEqClusterId(e.target.value)}
                    placeholder="Cluster 04 Clean Grid"
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={eqTimeout}
                    onChange={(e) => setEqTimeout(e.target.value)}
                    placeholder="5000"
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D14] border border-[#1A2332] text-white focus:border-[#8CFF00] focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Read-Only Safety Notice */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-[#273244] text-[11px] text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8CFF00] shrink-0" />
                <span>
                  <strong className="text-white">Strictly Read-Only:</strong> TMF connects via GET /api/v1/miners. No mutating POST/PUT commands are ever sent.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1A2332] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
            <button
              type="button"
              disabled={testingEq}
              onClick={() => handleTestConnection("equalizer")}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#222E40] text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Cpu className={`w-3.5 h-3.5 text-[#8CFF00] ${testingEq ? "animate-pulse" : ""}`} />
              <span>{testingEq ? "Testing Fleet..." : "Test Connection"}</span>
            </button>

            <button
              type="button"
              disabled={savingEq}
              onClick={() => handleInitiateSave("equalizer")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5 fill-black" />
              <span>{savingEq ? "Encrypting & Saving..." : "Save Credentials"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RECENT INTEGRATION AUDIT LOGS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#10151E] border border-[#1A2332] shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1A2332]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8CFF00]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Integration Vault Audit History
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Immutable log of credential rotations and connection probes
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-6 text-center text-xs font-mono text-slate-500">
            No integration modifications recorded yet. All changes are logged automatically.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#222E40]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0A0D14] text-slate-400 uppercase text-[10px]">
                <tr className="border-b border-[#222E40]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Provider</th>
                  <th className="py-2.5 px-3">Environment</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222E40]/60 text-slate-300">
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#151C27]/50">
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {log.details?.updated_by || log.details?.admin_email || "Super-Admin"}
                    </td>
                    <td className="py-3 px-3 text-[#8CFF00]">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 uppercase text-xs">
                      {log.details?.provider || "N/A"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#151C27] border border-[#273244] uppercase">
                        {log.details?.environment || "production"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        AUDITED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUPER ADMIN REAUTH MODAL */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#10151E] border border-[#273244] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Super-Admin Authorization</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Confirming production secret rotation for {pendingSaveTarget?.toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Modifying production integration credentials directly affects live customer billing and hardware fleet telemetry. Enter your Super-Admin Security Passcode to authorize:
            </p>

            {reauthError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 font-mono text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{reauthError}</span>
              </div>
            )}

            <div className="space-y-1.5 font-mono text-xs">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Super-Admin Security Passcode
              </label>
              <div className="relative">
                <input
                  type={showPasscodeText ? "text" : "password"}
                  autoFocus
                  value={securityPasscode}
                  onChange={(e) => setSecurityPasscode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && securityPasscode && pendingSaveTarget) {
                      executeSave(pendingSaveTarget, securityPasscode);
                    }
                  }}
                  placeholder="Enter Passcode (e.g. TmfOps2026!#Secure)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-[#273244] text-white focus:border-[#8CFF00] focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscodeText(!showPasscodeText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasscodeText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowReauthModal(false);
                  setPendingSaveTarget(null);
                  setSecurityPasscode("");
                }}
                className="px-4 py-2 rounded-xl bg-[#151C27] hover:bg-[#1E293B] text-slate-300 border border-[#273244]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!securityPasscode || savingNwp || savingEq}
                onClick={() => {
                  if (pendingSaveTarget) {
                    executeSave(pendingSaveTarget, securityPasscode);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black disabled:opacity-50 shadow-[0_0_15px_rgba(140,255,0,0.25)]"
              >
                {savingNwp || savingEq ? "Verifying..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
