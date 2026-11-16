import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { configId, notes } = body;

    if (!configId) {
      return NextResponse.json(
        { success: false, error: "configId is required" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Authenticate admin
    const authHeader = req.headers.get("authorization");
    let adminId = "00000000-0000-0000-0000-000000000000";

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      if (data?.user?.id) {
        adminId = data.user.id;
      }
    }

    const { data: config, error: fetchErr } = await supabase
      .from("customer_pool_configs")
      .select("*, profiles:customer_id(full_name)")
      .eq("id", configId)
      .single();

    if (fetchErr || !config) {
      return NextResponse.json(
        { success: false, error: "Pool configuration record not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    await supabase
      .from("customer_pool_configs")
      .update({
        configuration_status: "Configured in Equalizer",
        configured_at: now,
        configured_by: adminId,
        updated_at: now,
      })
      .eq("id", configId);

    // Append to activity feed
    await supabase.from("detection_activity_feed").insert({
      event_type: "WAITING_APPROVAL",
      customer_id: config.customer_id,
      worker_name: config.generated_worker_name,
      message: `Admin manually configured worker in Equalizer: ${config.generated_worker_name}. Telemetry discovery initiated.`,
    });

    return NextResponse.json({
      success: true,
      message: `Worker ${config.generated_worker_name} marked as configured in Equalizer.`,
    });
  } catch (error: any) {
    console.error("Mark configured error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update configuration status" },
      { status: 500 }
    );
  }
}
