import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";
    const severity = searchParams.get("severity") || "ALL";
    const query = (searchParams.get("query") || "").toLowerCase();

    const supabase = getAdminClient();

    // Fetch from admin_audit_logs
    const { data: auditLogs } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch from detection_activity_feed
    const { data: activityLogs } = await supabase
      .from("detection_activity_feed")
      .select("*")
      .order("event_time", { ascending: false })
      .limit(50);

    // Fetch from equalizer_sync_history
    const { data: syncLogs } = await supabase
      .from("equalizer_sync_history")
      .select("*")
      .order("sync_started_at", { ascending: false })
      .limit(20);

    const unifiedLogs: any[] = [];

    // Process audit logs
    (auditLogs || []).forEach((log: any) => {
      const detailsStr = JSON.stringify(log.details || {});
      const safeDetails = redactSensitiveInfo(detailsStr);

      unifiedLogs.push({
        id: log.id,
        timestamp: log.created_at,
        severity: "INFO",
        category: "ADMIN",
        event: log.action,
        reference: log.target_id || log.target_entity,
        message: `Admin action: ${log.action} on ${log.target_entity}. Details: ${safeDetails}`,
        correlationId: `aud_${log.id.slice(0, 8)}`,
        source: "Admin Audit Engine",
      });
    });

    // Process activity feed
    (activityLogs || []).forEach((act: any) => {
      let sev = "INFO";
      if (act.event_type.includes("ALERT") || act.event_type.includes("ERROR")) sev = "ERROR";
      else if (act.event_type.includes("WAITING") || act.event_type.includes("FLAGGED")) sev = "WARN";

      unifiedLogs.push({
        id: act.id,
        timestamp: act.event_time,
        severity: sev,
        category: "TELEMETRY",
        event: act.event_type,
        reference: act.worker_name || act.miner_id || act.customer_id,
        message: redactSensitiveInfo(act.message),
        correlationId: `act_${act.id.slice(0, 8)}`,
        source: "Equalizer Fleet Monitor",
      });
    });

    // Process sync history
    (syncLogs || []).forEach((s: any) => {
      unifiedLogs.push({
        id: s.id,
        timestamp: s.sync_started_at,
        severity: s.status === "SUCCESS" ? "INFO" : "ERROR",
        category: "SYNC",
        event: `EQUALIZER_SYNC_${s.status}`,
        reference: s.id,
        message: s.error_message
          ? `Equalizer sync failed: ${s.error_message}`
          : `Equalizer sync completed in ${s.duration_ms}ms. Discovered ${s.miners_discovered} ASICs (${s.miners_online} online).`,
        correlationId: `sync_${s.id.slice(0, 8)}`,
        source: "Equalizer Poller",
      });
    });

    // Sort descending by timestamp
    unifiedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by category
    let filtered = unifiedLogs;
    if (category !== "ALL") {
      filtered = filtered.filter((l) => l.category === category);
    }

    // Filter by severity
    if (severity !== "ALL") {
      filtered = filtered.filter((l) => l.severity === severity);
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(query) ||
          l.event.toLowerCase().includes(query) ||
          (l.reference && l.reference.toLowerCase().includes(query)) ||
          l.correlationId.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      success: true,
      totalCount: filtered.length,
      logs: filtered,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Developer logs error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

function redactSensitiveInfo(text: string): string {
  if (!text) return "";
  return text
    .replace(/(password["':\s]+)[^,}\s"]+/gi, "$1***REDACTED***")
    .replace(/(token["':\s]+)[^,}\s"]+/gi, "$1***REDACTED***")
    .replace(/(secret["':\s]+)[^,}\s"]+/gi, "$1***REDACTED***")
    .replace(/(sb_secret_[a-zA-Z0-9_\-]+)/gi, "sb_secret_***REDACTED***")
    .replace(/(sb_publishable_[a-zA-Z0-9_\-]+)/gi, "sb_publishable_***REDACTED***");
}
