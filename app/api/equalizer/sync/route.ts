import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchEqualizerMinerTelemetry, syncEqualizerMinersToDatabase } from "@/lib/services/equalizer";
import { runAutomaticWorkerDetection } from "@/lib/services/matcher";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const supabase = getAdminClient();

  try {
    // 1. Create sync history log entry
    const { data: syncLog, error: logErr } = await supabase
      .from("equalizer_sync_history")
      .insert({
        status: "PARTIAL",
        sync_started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const syncLogId = syncLog?.id;

    // 2. Poll Equalizer READ-ONLY API
    const eqResponse = await fetchEqualizerMinerTelemetry();

    if (!eqResponse || !eqResponse.success) {
      const errorMessage = eqResponse?.error || "Segments Equalizer API is disconnected or unauthenticated.";
      if (syncLogId) {
        await supabase
          .from("equalizer_sync_history")
          .update({
            status: "FAILED",
            error_message: errorMessage,
            sync_completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
          })
          .eq("id", syncLogId);
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          isConfigured: eqResponse?.isConfigured ?? false,
          minersDiscovered: 0,
          minersOnline: 0,
        },
        { status: 503 }
      );
    }

    // 3. Sync miners into database
    const { upsertedCount, onlineCount } = await syncEqualizerMinersToDatabase(
      supabase,
      eqResponse.miners
    );

    // 4. Run automatic worker matching engine
    const { matches, newLogsCount } = await runAutomaticWorkerDetection(
      supabase,
      eqResponse.miners
    );

    const durationMs = Date.now() - startTime;

    // 5. Update sync history log with final stats
    if (syncLogId) {
      await supabase
        .from("equalizer_sync_history")
        .update({
          status: "SUCCESS",
          sync_completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          miners_discovered: upsertedCount,
          miners_online: onlineCount,
          matches_detected: matches.length,
          telemetry_updated: upsertedCount,
          sync_summary: {
            cluster: eqResponse.cluster_name,
            totalHashrateTh: eqResponse.total_hashrate_th,
            newMatchesCount: newLogsCount,
          },
        })
        .eq("id", syncLogId);
    }

    return NextResponse.json({
      success: true,
      minersDiscovered: upsertedCount,
      minersOnline: onlineCount,
      matchesDetected: matches.length,
      newMatchesCount: newLogsCount,
      matches,
      durationMs,
      cluster: eqResponse.cluster_name,
      totalHashrateTh: eqResponse.total_hashrate_th,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Equalizer sync route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Equalizer synchronization failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = getAdminClient();
  try {
    const { data: latestSync } = await supabase
      .from("equalizer_sync_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      latestSync,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
