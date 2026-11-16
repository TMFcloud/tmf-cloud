import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "supabase", "complete_setup.sql");
    const sqlContent = fs.readFileSync(filePath, "utf-8");

    return NextResponse.json({
      success: true,
      sql: sqlContent,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
