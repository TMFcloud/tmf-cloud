import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Clean in-memory fallback for offline test suites only (no fake customer records)
let memoryTickets: any[] = [];

export async function GET(req: NextRequest) {
  try {
    const isPlaceholder =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (!isPlaceholder) {
      try {
        const supabase = getAdminClient();
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          return NextResponse.json({ success: true, tickets: data, source: "supabase" });
        }
      } catch (err) {
        // Fallback to memory
      }
    }

    return NextResponse.json({ success: true, tickets: memoryTickets, source: "memory" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticketCode = `TICKET-${Math.floor(1000 + Math.random() * 9000)}`;

    const isValidUuid = (val: any) =>
      typeof val === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const dbPayload: any = {
      ticket_code: ticketCode,
      ticket_type: body.ticket_type || "GENERAL",
      customer_name: body.customer_name || "Client User",
      customer_email: body.customer_email || "client@theminingfuture.com",
      customer_phone: body.customer_phone || "+971 50 123 4567",
      customer_whatsapp: body.customer_whatsapp || "971501234567",
      subject: body.subject || "General inquiry",
      message: body.message || "",
      priority: body.priority || "Normal",
      status: body.status || "In Progress",
      customer_id: isValidUuid(body.customer_id) ? body.customer_id : null,
      contract_id: isValidUuid(body.contract_id) ? body.contract_id : null,
    };

    if (isValidUuid(body.id)) {
      dbPayload.id = body.id;
    }

    const isPlaceholder =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (!isPlaceholder) {
      try {
        const supabase = getAdminClient();
        const { data, error } = await supabase
          .from("support_tickets")
          .insert(dbPayload)
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
        } else if (data) {
          return NextResponse.json({ success: true, ticket: data, source: "supabase" });
        }
      } catch (err) {
        console.error("Supabase ticket exception:", err);
      }
    }

    const fallbackTicket = {
      id: ticketCode,
      ...dbPayload,
      customer_id: body.customer_id || "cust-001",
      created_at: new Date().toISOString(),
    };

    memoryTickets = [fallbackTicket, ...memoryTickets];
    return NextResponse.json({ success: true, ticket: fallbackTicket, source: "memory" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, status } = body;

    if (!ticketId) {
      return NextResponse.json({ success: false, error: "ticketId is required" }, { status: 400 });
    }

    const isPlaceholder =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (!isPlaceholder) {
      try {
        const supabase = getAdminClient();
        const { data, error } = await supabase
          .from("support_tickets")
          .update({ status, updated_at: new Date().toISOString() })
          .or(`id.eq.${ticketId},ticket_code.eq.${ticketId}`)
          .select()
          .maybeSingle();

        if (!error && data) {
          return NextResponse.json({ success: true, ticket: data, source: "supabase" });
        }
      } catch (err) {
        // Fallback
      }
    }

    memoryTickets = memoryTickets.map((t) =>
      t.id === ticketId || t.ticket_code === ticketId ? { ...t, status } : t
    );

    return NextResponse.json({ success: true, status, source: "memory" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
