import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchMarketGoldQuote } from "@/lib/gold/fetch-market-quote";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi." },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
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

  let quote;
  try {
    quote = await fetchMarketGoldQuote();
  } catch (error) {
    console.error("[sync-gold-market-price] quote", error);
    return NextResponse.json(
      { error: "Harga pasar tidak tersedia. Harga tersimpan tidak diubah." },
      { status: 502 },
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: families, error: listError } = await supabase
    .from("family_settings")
    .select("family_id")
    .eq("gold_follow_market", true)
    .eq("gold_savings_enabled", true);

  if (listError) {
    console.error("[sync-gold-market-price] list", listError);
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const familyIds = (families ?? []).map((row) => row.family_id);
  if (familyIds.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      spot_energy: quote.spotEnergy,
      sell_price_energy: quote.sellPriceEnergy,
      buy_price_energy: quote.buyPriceEnergy,
    });
  }

  const { error: updateError } = await supabase
    .from("family_settings")
    .update({
      gold_sell_price_energy: quote.sellPriceEnergy,
      gold_buy_price_energy: quote.buyPriceEnergy,
    })
    .in("family_id", familyIds)
    .eq("gold_follow_market", true)
    .eq("gold_savings_enabled", true);

  if (updateError) {
    console.error("[sync-gold-market-price] update", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updated: familyIds.length,
    spot_energy: quote.spotEnergy,
    sell_price_energy: quote.sellPriceEnergy,
    buy_price_energy: quote.buyPriceEnergy,
  });
}
