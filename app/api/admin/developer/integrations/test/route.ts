import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  testNowPaymentsConnection,
  testEqualizerConnection,
  getDecryptedSecrets,
  updateTestOutcome,
  IntegrationProvider,
  IntegrationEnvironment,
  TestResult,
} from "@/lib/services/integrations-vault";
import { isValidAdminEmail, AdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      provider,
      environment = "production",
      candidateApiKey,
      candidateEndpointUrl,
      adminUser,
    } = body as {
      provider: IntegrationProvider;
      environment: IntegrationEnvironment;
      candidateApiKey?: string;
      candidateEndpointUrl?: string;
      adminUser?: AdminUser;
    };

    if (!provider || !["nowpayments", "equalizer"].includes(provider)) {
      return NextResponse.json(
        { success: false, error: "Invalid provider specified for test." },
        { status: 400 }
      );
    }

    // 1. Resolve Effective Test Target & Credentials
    let effectiveApiKey = candidateApiKey;
    let effectiveEndpoint = candidateEndpointUrl;

    // If candidate key is blank or masked, retrieve decrypted key from secure vault
    if (!effectiveApiKey || effectiveApiKey.includes("••••") || effectiveApiKey === "Not Configured") {
      const stored = await getDecryptedSecrets<any>(provider, environment);
      effectiveApiKey = stored?.secrets?.apiKey || "";
      if (!effectiveEndpoint) {
        effectiveEndpoint = stored?.config?.endpointUrl || "";
      }
    }

    // Default endpoint fallbacks if not provided
    if (!effectiveEndpoint) {
      if (provider === "nowpayments") {
        effectiveEndpoint =
          environment === "sandbox"
            ? "https://api-sandbox.nowpayments.io/v1"
            : "https://api.nowpayments.io/v1";
      } else {
        effectiveEndpoint =
          process.env.EQUALIZER_API_URL ||
          process.env.SEGMENTS_EQUALIZER_BASE_URL ||
          "https://equalizer-fleet.theminingfuture.com";
      }
    }

    // 2. Execute Backend-Only Connection Test
    let testResult: TestResult;
    if (provider === "nowpayments") {
      testResult = await testNowPaymentsConnection(effectiveApiKey || "", effectiveEndpoint || "");
    } else {
      testResult = await testEqualizerConnection(effectiveEndpoint || "", effectiveApiKey || "", 5000);
    }

    // 3. Persist Test Outcome to Vault
    await updateTestOutcome(provider, environment, testResult);

    // 4. Record Audit Log for the Test Action (Sanitized)
    if (adminUser?.email && isValidAdminEmail(adminUser.email)) {
      const supabase = getAdminClient();
      try {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminUser.id || "00000000-0000-0000-0000-000000000000",
          action: `INTEGRATION_TEST_${provider.toUpperCase()}_${environment.toUpperCase()}`,
          target_entity: "system_integration_secrets",
          details: {
            provider,
            environment,
            success: testResult.success,
            statusCode: testResult.statusCode,
            latencyMs: testResult.latencyMs,
            message: testResult.message,
            endpoint: effectiveEndpoint,
            timestamp: testResult.timestamp,
          },
        });
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      result: testResult,
    });
  } catch (err: any) {
    console.error("[Integration Test Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to execute backend connection test.",
      },
      { status: 500 }
    );
  }
}
