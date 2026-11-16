import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = body.type || "all"; // "frontend" | "backend" | "all"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const frontendResults: any[] = [];
  const backendResults: any[] = [];

  // 1. RUN FRONTEND TESTS
  if (type === "frontend" || type === "all") {
    const routesToTest = [
      { name: "Public Homepage", path: "/", critical: true },
      { name: "Customer Portal Dashboard", path: "/dashboard", critical: true },
      { name: "Customer Login Gateway", path: "/login", critical: true },
      { name: "Customer Registration Flow", path: "/register", critical: true },
      { name: "TMF Enterprise Admin Console", path: "/admin", critical: true },
      { name: "TMF Admin Login Gate", path: "/admin/login", critical: true },
    ];

    for (const route of routesToTest) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${siteUrl}${route.path}`, {
          signal: controller.signal,
          headers: { "User-Agent": "TMF-Automated-QA-Runner/1.0" },
        });
        clearTimeout(timeout);
        const durationMs = Date.now() - start;

        frontendResults.push({
          name: route.name,
          path: route.path,
          status: res.status,
          durationMs,
          passed: res.status === 200 || res.status === 307 || res.status === 308,
          timestamp: new Date().toISOString(),
          error: res.status >= 400 ? `HTTP Status ${res.status}` : null,
        });
      } catch (err: any) {
        frontendResults.push({
          name: route.name,
          path: route.path,
          status: 0,
          durationMs: Date.now() - start,
          passed: false,
          timestamp: new Date().toISOString(),
          error: err.message || "Failed to connect",
        });
      }
    }
  }

  // 2. RUN BACKEND TESTS
  if (type === "backend" || type === "all") {
    const apiEndpoints = [
      {
        name: "Authoritative Pricing API",
        endpoint: "/api/public/pricing",
        method: "GET",
        expectedStatus: 200,
      },
      {
        name: "Database Health & Schema Probe",
        endpoint: "/api/admin/health/db",
        method: "GET",
        expectedStatus: 200,
      },
      {
        name: "Admin Data Aggregator",
        endpoint: "/api/admin/data",
        method: "GET",
        expectedStatus: 200,
      },
      {
        name: "Support Desk Query API",
        endpoint: "/api/support/tickets",
        method: "GET",
        expectedStatus: 200,
      },
    ];

    for (const test of apiEndpoints) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${siteUrl}${test.endpoint}`, {
          method: test.method,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        const passed = res.status === test.expectedStatus;

        backendResults.push({
          name: test.name,
          endpoint: test.endpoint,
          method: test.method,
          status: res.status,
          durationMs,
          passed,
          timestamp: new Date().toISOString(),
          error: !passed ? `Expected ${test.expectedStatus}, got ${res.status}` : null,
        });
      } catch (err: any) {
        backendResults.push({
          name: test.name,
          endpoint: test.endpoint,
          method: test.method,
          status: 0,
          durationMs: Date.now() - start,
          passed: false,
          timestamp: new Date().toISOString(),
          error: err.message || "Network Error",
        });
      }
    }

    // Direct Database Query Benchmark
    const dbStart = Date.now();
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase.from("system_pricing_settings").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;
      backendResults.push({
        name: "Supabase PostgreSQL Latency Benchmark",
        endpoint: "PostgreSQL:system_pricing_settings",
        method: "SELECT",
        status: error ? 500 : 200,
        durationMs: dbLatency,
        passed: !error && dbLatency < 3000,
        timestamp: new Date().toISOString(),
        error: error ? error.message : null,
      });
    } catch (err: any) {
      backendResults.push({
        name: "Supabase PostgreSQL Latency Benchmark",
        endpoint: "PostgreSQL:system_pricing_settings",
        method: "SELECT",
        status: 500,
        durationMs: Date.now() - dbStart,
        passed: false,
        timestamp: new Date().toISOString(),
        error: err.message,
      });
    }

    // NOWPayments Webhook Signature Security Test (Send unauthenticated spoof payload, must reject 401!)
    const hookStart = Date.now();
    try {
      const res = await fetch(`${siteUrl}/api/webhooks/nowpayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: 99999999, payment_status: "finished" }),
      });
      const hookDuration = Date.now() - hookStart;
      // It MUST reject unauthenticated webhooks (status 400 or 401)
      const passed = res.status === 400 || res.status === 401;
      backendResults.push({
        name: "NOWPayments HMAC Webhook Security Rejection Test",
        endpoint: "/api/webhooks/nowpayments",
        method: "POST (Unsigned)",
        status: res.status,
        durationMs: hookDuration,
        passed,
        timestamp: new Date().toISOString(),
        error: !passed ? `Security failure: API accepted unsigned webhook with status ${res.status}` : null,
      });
    } catch (err: any) {
      backendResults.push({
        name: "NOWPayments HMAC Webhook Security Rejection Test",
        endpoint: "/api/webhooks/nowpayments",
        method: "POST (Unsigned)",
        status: 0,
        durationMs: Date.now() - hookStart,
        passed: false,
        timestamp: new Date().toISOString(),
        error: err.message,
      });
    }
  }

  const allTests = [...frontendResults, ...backendResults];
  const passedCount = allTests.filter((t) => t.passed).length;
  const failedCount = allTests.length - passedCount;

  return NextResponse.json({
    success: true,
    totalTests: allTests.length,
    passedCount,
    failedCount,
    frontend: frontendResults,
    backend: backendResults,
    timestamp: new Date().toISOString(),
  });
}
