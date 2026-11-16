import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isConfigured = !!supabaseUrl && !supabaseUrl.includes("placeholder");

  if (!isConfigured) {
    return NextResponse.json({
      success: true,
      mode: "development_mock",
      connected: false,
      message: "Supabase credentials not configured in .env.local. Running in in-memory development mode.",
      latencyMs: 0,
      tables: {
        system_pricing_settings: { status: "MOCK_ACTIVE", rows: 1 },
        equalizer_miners: { status: "MOCK_ACTIVE", rows: 6 },
        customer_pool_configs: { status: "MOCK_ACTIVE", rows: 3 },
        worker_identity_registry: { status: "MOCK_ACTIVE", rows: 3 },
        contracts: { status: "MOCK_ACTIVE", rows: 2 },
        orders: { status: "MOCK_ACTIVE", rows: 2 },
        support_tickets: { status: "MOCK_ACTIVE", rows: 3 },
      },
      envStatus: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl || "NOT_SET",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "CONFIGURED" : "NOT_SET",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "CONFIGURED" : "NOT_SET",
      },
    });
  }

  try {
    const supabase = getAdminClient();

    // Query key tables to verify schema and table health
    const [
      pricingRes,
      minersRes,
      configsRes,
      contractsRes,
      ticketsRes,
      profilesRes,
    ] = await Promise.all([
      supabase.from("system_pricing_settings").select("*", { count: "exact" }).limit(1),
      supabase.from("equalizer_miners").select("*", { count: "exact" }).limit(1),
      supabase.from("customer_pool_configs").select("*", { count: "exact" }).limit(1),
      supabase.from("contracts").select("*", { count: "exact" }).limit(1),
      supabase.from("support_tickets").select("*", { count: "exact" }).limit(1),
      supabase.from("profiles").select("*", { count: "exact" }).limit(1),
    ]);

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: "live_supabase_postgresql",
      connected: true,
      message: "Successfully connected to live Supabase PostgreSQL database.",
      latencyMs,
      supabaseUrl,
      tables: {
        system_pricing_settings: {
          status: pricingRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: pricingRes.count ?? 0,
          error: pricingRes.error?.message,
        },
        equalizer_miners: {
          status: minersRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: minersRes.count ?? 0,
          error: minersRes.error?.message,
        },
        customer_pool_configs: {
          status: configsRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: configsRes.count ?? 0,
          error: configsRes.error?.message,
        },
        contracts: {
          status: contractsRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: contractsRes.count ?? 0,
          error: contractsRes.error?.message,
        },
        support_tickets: {
          status: ticketsRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: ticketsRes.count ?? 0,
          error: ticketsRes.error?.message,
        },
        profiles: {
          status: profilesRes.error ? "TABLE_NOT_FOUND" : "HEALTHY",
          rows: profilesRes.count ?? 0,
          error: profilesRes.error?.message,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      mode: "live_supabase_postgresql",
      connected: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    });
  }
}
