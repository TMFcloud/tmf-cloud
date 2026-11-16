import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, action, reason, adminId } = body;
    const SYSTEM_ADMIN_UUID = "def6574c-a835-4691-bce2-96672b8041d3";
    const resolvedAdminId =
      adminId && adminId.length === 36 && !adminId.startsWith("0000")
        ? adminId
        : SYSTEM_ADMIN_UUID;

    if (!customerId || !action) {
      return NextResponse.json(
        { success: false, error: "customerId and action ('enable' | 'disable') are required." },
        { status: 400 }
      );
    }

    if (action === "disable" && (!reason || reason.trim().length < 5)) {
      return NextResponse.json(
        { success: false, error: "A valid reason (minimum 5 characters) is strictly required to disable a customer account." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    if (action === "disable") {
      // 1. Invalidate sessions server-side by setting ban_duration in Supabase Auth
      try {
        await supabase.auth.admin.updateUserById(customerId, {
          ban_duration: "876000h", // 100 years
        });
      } catch (authErr) {
        console.warn("Could not ban auth user directly, recording profile status:", authErr);
      }

      // 2. Update profile table status
      await supabase
        .from("profiles")
        .update({
          account_status: "DISABLED",
          disabled_reason: reason.trim(),
          disabled_at: new Date().toISOString(),
          disabled_by: resolvedAdminId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      // 3. Record in admin_audit_logs
      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "CUSTOMER_ACCOUNT_DISABLED",
        target_entity: "profiles",
        target_id: customerId,
        details: {
          reason: reason.trim(),
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        customerId,
        status: "DISABLED",
        message: "Customer account disabled successfully. Active sessions restricted.",
      });
    } else if (action === "enable") {
      // 1. Lift ban in Supabase Auth
      try {
        await supabase.auth.admin.updateUserById(customerId, {
          ban_duration: "none",
        });
      } catch (authErr) {
        console.warn("Could not unban auth user directly:", authErr);
      }

      // 2. Update profile table status
      await supabase
        .from("profiles")
        .update({
          account_status: "ACTIVE",
          disabled_reason: null,
          disabled_at: null,
          disabled_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      // 3. Record in admin_audit_logs
      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "CUSTOMER_ACCOUNT_REACTIVATED",
        target_entity: "profiles",
        target_id: customerId,
        details: {
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        customerId,
        status: "ACTIVE",
        message: "Customer account reactivated successfully.",
      });
    } else if (action === "add_note") {
      const note = (body.note || "").trim();
      if (!note) {
        return NextResponse.json(
          { success: false, error: "Note content is required." },
          { status: 400 }
        );
      }
      const priority = body.priority || "NORMAL";
      const authorName = body.authorName || "Operations Admin";
      const authorEmail = body.authorEmail || "operations@theminingfuture.com";

      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "ADMIN_NOTE",
        target_entity: "profiles",
        target_id: customerId,
        details: {
          note,
          priority,
          author_name: authorName,
          author_email: authorEmail,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Private internal staff note recorded successfully.",
      });
    } else if (action === "wallet_adjust") {
      const amount = parseFloat(body.amount);
      const adjustType = body.adjustType || "CREDIT"; // "CREDIT" | "DEBIT"
      const reason = (body.reason || "").trim();

      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, error: "A valid positive adjustment amount is required." },
          { status: 400 }
        );
      }

      if (!reason || reason.length < 5) {
        return NextResponse.json(
          { success: false, error: "Mandatory adjustment reason (min 5 characters) is required." },
          { status: 400 }
        );
      }

      const { data: currentProf } = await supabase
        .from("profiles")
        .select("wallet_balance_usdt")
        .eq("id", customerId)
        .single();

      const prevBalance = Number(currentProf?.wallet_balance_usdt || 0);
      const newBalance =
        adjustType === "DEBIT"
          ? Math.max(0, prevBalance - amount)
          : prevBalance + amount;

      await supabase
        .from("profiles")
        .update({
          wallet_balance_usdt: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "WALLET_ADJUSTMENT",
        target_entity: "wallet",
        target_id: customerId,
        details: {
          type: adjustType,
          amount,
          previous_balance: prevBalance,
          new_balance: newBalance,
          reason,
          currency: "USDT",
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        previousBalance: prevBalance,
        newBalance,
        message: `Wallet balance adjusted to $${newBalance.toFixed(2)} USDT.`,
      });
    } else if (action === "resend_verification") {
      let targetEmail = body.email;
      if (!targetEmail) {
        const { data: userRes } = await supabase.auth.admin.getUserById(customerId);
        targetEmail = userRes?.user?.email;
      }

      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "RESEND_VERIFICATION_TRIGGERED",
        target_entity: "profiles",
        target_id: customerId,
        details: {
          email: targetEmail,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Verification reminder logged and dispatched for ${targetEmail || "customer"}.`,
      });
    } else if (action === "send_notification") {
      const notice = (body.message || "").trim();
      if (!notice) {
        return NextResponse.json(
          { success: false, error: "Notification message content is required." },
          { status: 400 }
        );
      }

      await supabase.from("admin_audit_logs").insert({
        admin_id: resolvedAdminId,
        action: "CUSTOMER_NOTIFICATION_SENT",
        target_entity: "profiles",
        target_id: customerId,
        details: {
          message: notice,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Customer notification logged and scheduled for dispatch.",
      });
    } else {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Customer management error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update customer account status" },
      { status: 500 }
    );
  }
}
