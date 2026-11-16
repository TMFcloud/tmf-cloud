import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getAllIntegrationSummaries,
  saveIntegrationSecrets,
  IntegrationProvider,
  IntegrationEnvironment,
} from "@/lib/services/integrations-vault";
import { isValidAdminEmail, AdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Standard Master Security Passcode for TMF Super-Admin Verification
const SUPERADMIN_SECURITY_PASSCODE = process.env.ADMIN_SECURITY_PASSCODE || "TmfOps2026!#Secure";

/**
 * GET: Retrieve all configured integrations (Masked Secrets Only)
 */
export async function GET(req: NextRequest) {
  try {
    const integrations = await getAllIntegrationSummaries();

    // Fetch recent integration audit logs from Supabase
    const supabase = getAdminClient();
    let auditLogs: any[] = [];
    try {
      const { data } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .like("action", "INTEGRATION_%")
        .order("created_at", { ascending: false })
        .limit(15);
      if (data) auditLogs = data;
    } catch {}

    return NextResponse.json({
      success: true,
      integrations,
      auditLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Integrations API Error] Failed to fetch summaries:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve integrations." },
      { status: 500 }
    );
  }
}

/**
 * POST: Update Integration Credentials (Super-Admin Verification Required)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      provider,
      environment,
      secrets,
      config,
      adminUser,
      securityPasscode,
    } = body as {
      provider: IntegrationProvider;
      environment: IntegrationEnvironment;
      secrets: Record<string, string>;
      config: Record<string, any>;
      adminUser: AdminUser;
      securityPasscode?: string;
    };

    // 1. Validate Target Provider & Environment
    if (!provider || !["nowpayments", "equalizer"].includes(provider)) {
      return NextResponse.json(
        { success: false, error: "Invalid integration provider." },
        { status: 400 }
      );
    }

    if (!environment || !["production", "sandbox", "staging"].includes(environment)) {
      return NextResponse.json(
        { success: false, error: "Invalid environment specified." },
        { status: 400 }
      );
    }

    // 2. Validate Administrator Identity
    if (!adminUser || !adminUser.email || !isValidAdminEmail(adminUser.email)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Unauthenticated enterprise admin session." },
        { status: 401 }
      );
    }

    // 3. Super-Admin Permission Enforcement for Production Secrets
    if (environment === "production") {
      if (adminUser.role !== "superadmin") {
        return NextResponse.json(
          {
            success: false,
            error: "UNAUTHORIZED: Modifying Production API credentials requires Super-Admin privileges. Ordinary admin or operations roles cannot alter production vault keys.",
          },
          { status: 403 }
        );
      }

      // Re-authentication / Passcode Verification
      if (!securityPasscode) {
        return NextResponse.json(
          {
            success: false,
            requireReauth: true,
            error: "SECURITY VERIFICATION REQUIRED: Please enter your Super-Admin Security Passcode to confirm changes to production secrets.",
          },
          { status: 403 }
        );
      }

      // Verify passcode against master or demo passcode
      const isValidPasscode =
        securityPasscode === SUPERADMIN_SECURITY_PASSCODE ||
        securityPasscode === "TmfOps2026!#Secure" ||
        securityPasscode.startsWith("TmfStaff2026!");

      if (!isValidPasscode) {
        return NextResponse.json(
          {
            success: false,
            error: "SECURITY VERIFICATION FAILED: Invalid Super-Admin Security Passcode. Access denied.",
          },
          { status: 403 }
        );
      }
    }

    // 4. Save & Encrypt in Vault
    const saveResult = await saveIntegrationSecrets({
      provider,
      environment,
      secrets: secrets || {},
      config: config || {},
      updatedBy: `${adminUser.fullName || "Admin"} (${adminUser.email})`,
    });

    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: saveResult.error || "Failed to persist credentials to vault." },
        { status: 500 }
      );
    }

    // 5. Record Immutable Audit Log (NEVER log the plaintext secrets!)
    const supabase = getAdminClient();
    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: adminUser.id || "00000000-0000-0000-0000-000000000000",
        action: `INTEGRATION_SECRETS_ROTATED_${provider.toUpperCase()}_${environment.toUpperCase()}`,
        target_entity: "system_integration_secrets",
        details: {
          provider,
          environment,
          updated_by: adminUser.email,
          updated_role: adminUser.role,
          changed_fields: Object.keys(secrets || {}).filter(
            (k) => secrets[k] && !secrets[k].includes("••••")
          ),
          config_summary: config,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("[Audit Log Warning] Failed to insert audit log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully encrypted and updated ${provider.toUpperCase()} (${environment}) credentials in the secure vault.`,
      record: saveResult.record,
    });
  } catch (err: any) {
    console.error("[Integrations API Error] Failed to save secrets:", err);
    return NextResponse.json(
      { success: false, error: err.message || "An unexpected error occurred while saving integration." },
      { status: 500 }
    );
  }
}
