import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSystemCleanup } from "@/lib/cleanup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check optional CRON_SECRET for security if configured in Vercel
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cleanupResult = await runSystemCleanup(supabase);

  return NextResponse.json({
    message: "System automated cleanup executed successfully.",
    result: cleanupResult,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
