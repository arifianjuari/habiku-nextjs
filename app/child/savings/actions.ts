"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { RPC } from "@/lib/database/rpc";

function mapRpcError(message: string): string {
  if (message.includes("insufficient_goal_energy")) {
    return "Energi di target aktif tidak cukup.";
  }
  if (message.includes("insufficient_wallet")) {
    return "Energi di dompet tidak cukup.";
  }
  if (message.includes("insufficient_pocket")) {
    return "Saldo kantong tidak cukup (termasuk yang menunggu persetujuan).";
  }
  if (message.includes("savings_disabled")) {
    return "Fitur tabungan belum aktif.";
  }
  if (message.includes("pocket_locked")) {
    return "Kantong masih terkunci; belum bisa ditarik.";
  }
  if (message.includes("term_pocket_full")) {
    return "Kantong deposito sudah berisi setoran.";
  }
  if (message.includes("gold_savings_disabled")) {
    return "Tabung Emas belum aktif.";
  }
  if (message.includes("insufficient_gold")) {
    return "Saldo emas tidak cukup.";
  }
  if (message.includes("quantity_required")) {
    return "Jumlah emas minimal 0,001 butir.";
  }
  if (message.includes("energy_too_low_for_gold")) {
    return "Energi terlalu sedikit untuk membeli emas (pecahan minimal 0,001 butir).";
  }
  if (message.includes("quantity_too_small")) {
    return "Jumlah emas terlalu kecil; energi hasil jual minimal 1.";
  }
  if (message.includes("amount_required")) {
    return "Masukkan jumlah energi minimal 1.";
  }
  return message || "Terjadi kesalahan.";
}

export async function depositToSavingsAction(pocketId: string, amount: number) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.depositToSavings, {
    p_pocket_id: pocketId,
    p_amount: amount,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/child/targets");
  revalidatePath("/child/home");
  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  return { ok: true as const };
}

export async function requestSavingsWithdrawAction(
  pocketId: string,
  amount: number,
  note: string,
) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.requestSavingsWithdraw, {
    p_pocket_id: pocketId,
    p_amount: amount,
    p_note: note,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function requestGoldBuyAction(profileId: string, energyAmount: number) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.requestGoldBuy, {
    p_profile_id: profileId,
    p_energy_amount: energyAmount,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/child/targets");
  revalidatePath("/child/home");
  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  return { ok: true as const };
}

export async function requestGoldSellAction(profileId: string, quantityMilli: number) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.requestGoldSell, {
    p_profile_id: profileId,
    p_quantity_milli: quantityMilli,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/child/savings");
  revalidatePath("/child/home");
  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  return { ok: true as const };
}
