import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleTick(request);
}

export async function POST(request: NextRequest) {
  return handleTick(request);
}

async function handleTick(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = request.headers.get("x-mark-missed-secret")?.trim() ?? "";

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && headerSecret === cronSecret);

  if (cronSecret && !authorized) {
    return NextResponse.json({ error: "Akses tidak sah." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi." },
      { status: 500 },
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("mark_missed_tasks_tick");

  if (error) {
    console.error("[mark-missed-tick]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted_or_processed: data ?? 0,
  });
}
