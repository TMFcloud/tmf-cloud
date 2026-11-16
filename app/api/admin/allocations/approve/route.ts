import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { approveAndAllocateMiner } from "@/lib/services/allocator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { minerId, contractId, customerId, notes } = body;

    if (!minerId || !customerId) {
      return NextResponse.json(
        { success: false, error: "minerId and customerId are required." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Authenticate admin (or default to master admin uuid)
    const authHeader = req.headers.get("authorization");
    let adminId = "00000000-0000-0000-0000-000000000000";

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      if (data?.user?.id) {
        adminId = data.user.id;
      }
    }

    const result = await approveAndAllocateMiner(supabase, {
      minerId,
      contractId,
      customerId,
      adminId,
      notes,
    });

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    console.error("Approve allocation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve miner allocation" },
      { status: 500 }
    );
  }
}
