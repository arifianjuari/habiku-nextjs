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
    return "Saldo kantong tidak cukup.";
  }
  if (message.includes("savings_disabled")) {
    return "Fitur tabungan dinonaktifkan di pengaturan keluarga.";
  }
  if (message.includes("interest_rate_too_high")) {
    return "Bunga melebihi batas maksimum 20% per bulan.";
  }
  if (message.includes("lock_months_required")) {
    return "Deposito membutuhkan durasi kunci (bulan).";
  }
  if (message.includes("term_pocket_full")) {
    return "Kantong deposito ini sudah berisi setoran.";
  }
  if (message.includes("pocket_locked")) {
    return "Kantong masih terkunci; penarikan belum bisa diajukan.";
  }
  if (message.includes("pocket_not_found")) {
    return "Kantong tabungan tidak ditemukan.";
  }
  if (message.includes("name_required")) {
    return "Nama kantong wajib diisi.";
  }
  if (message.includes("pocket_not_empty")) {
    return "Kantong masih berisi saldo. Tarik dulu semua energi sebelum menghapus.";
  }
  if (message.includes("pending_withdrawals")) {
    return "Masih ada permintaan penarikan yang menunggu persetujuan.";
  }
  if (message.includes("goal_not_ready")) {
    return "Target ini sudah tidak bisa diklaim — energinya sudah ditabung atau diklaim. Tolak permintaan ini.";
  }
  if (message.includes("invalid_gold_spread")) {
    return "Harga beli harus lebih rendah dari harga jual.";
  }
  if (message.includes("price_required")) {
    return "Harga emas wajib diisi (minimal 1 energi).";
  }
  if (message.includes("gold_savings_disabled")) {
    return "Tabung Emas dinonaktifkan di pengaturan keluarga.";
  }
  if (message.includes("insufficient_gold")) {
    return "Saldo emas tidak cukup.";
  }
  if (message.includes("quantity_required")) {
    return "Jumlah butir emas minimal 1.";
  }
  if (message.includes("invalid_transaction")) {
    return "Transaksi tidak valid atau sudah diproses.";
  }
  return message || "Terjadi kesalahan.";
}

export async function createSavingsPocketAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const profileId = String(formData.get("profileId") ?? "");
  const name = String(formData.get("name") ?? "");
  const emoji = String(formData.get("emoji") ?? "🐷");
  const accentColor = String(formData.get("accentColor") ?? "#8B5CF6");
  const targetRaw = String(formData.get("targetAmount") ?? "");
  const targetAmount = targetRaw ? Number(targetRaw) : null;
  const pocketType = String(formData.get("pocketType") ?? "flexible");
  const monthlyInterestBps = Number(formData.get("monthlyInterestBps") ?? 0);
  const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
  const lockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : null;
  const lockBonusCoefficient = Number(formData.get("lockBonusCoefficient") ?? 1);
  const defaultForGoalSave = formData.get("defaultForGoalSave") === "on";

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.createSavingsPocketV2, {
    p_profile_id: profileId,
    p_name: name,
    p_pocket_type: pocketType,
    p_emoji: emoji,
    p_accent_color: accentColor,
    p_target_amount: targetAmount,
    p_monthly_interest_bps: monthlyInterestBps,
    p_lock_months: lockMonths,
    p_lock_bonus_coefficient: lockBonusCoefficient,
    p_default_for_goal_save: defaultForGoalSave,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const, pocketId: data };
}

export async function updateSavingsPocketAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const pocketId = String(formData.get("pocketId") ?? "");
  const name = String(formData.get("name") ?? "");
  const emoji = String(formData.get("emoji") ?? "🐷");
  const accentColor = String(formData.get("accentColor") ?? "#8B5CF6");
  const targetRaw = String(formData.get("targetAmount") ?? "");
  const targetAmount = targetRaw ? Number(targetRaw) : null;
  const pocketType = String(formData.get("pocketType") ?? "flexible");
  const monthlyInterestBps = Number(formData.get("monthlyInterestBps") ?? 0);
  const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
  const lockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : null;
  const lockBonusCoefficient = Number(formData.get("lockBonusCoefficient") ?? 1);
  const defaultForGoalSave = formData.get("defaultForGoalSave") === "on";

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.updateSavingsPocketV2, {
    p_pocket_id: pocketId,
    p_name: name,
    p_pocket_type: pocketType,
    p_emoji: emoji,
    p_accent_color: accentColor,
    p_target_amount: targetAmount,
    p_monthly_interest_bps: monthlyInterestBps,
    p_lock_months: lockMonths,
    p_lock_bonus_coefficient: lockBonusCoefficient,
    p_default_for_goal_save: defaultForGoalSave,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function deleteSavingsPocketAction(pocketId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.deleteSavingsPocket, { p_pocket_id: pocketId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function approveSavingsWithdrawAction(transactionId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.approveSavingsWithdraw, { p_transaction_id: transactionId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  return { ok: true as const };
}

export async function rejectSavingsWithdrawAction(
  transactionId: string,
  reason: string,
) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectSavingsWithdraw, {
    p_transaction_id: transactionId,
    p_reason: reason,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function approveGoalClaimAction(requestId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.approveGoalRewardRedeem, { p_request_id: requestId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function rejectGoalClaimAction(requestId: string, reason: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectGoalRewardRedeem, {
    p_request_id: requestId,
    p_reason: reason,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  return { ok: true as const };
}

export async function updateGoldPricesAction(sellPrice: number, buyPrice: number) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.updateGoldPrices, {
    p_sell_price: sellPrice,
    p_buy_price: buyPrice,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  return { ok: true as const };
}

export async function approveGoldTransactionAction(transactionId: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.approveGoldTransaction, { p_transaction_id: transactionId });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/parent/ledger");
  revalidatePath("/child/savings");
  revalidatePath("/child/home");
  return { ok: true as const };
}

export async function rejectGoldTransactionAction(transactionId: string, reason: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectGoldTransaction, {
    p_transaction_id: transactionId,
    p_reason: reason,
  });

  if (error) return { error: mapRpcError(error.message) };

  revalidatePath("/parent/savings");
  revalidatePath("/child/savings");
  return { ok: true as const };
}
