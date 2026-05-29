import { createClient } from "@/lib/supabase/server";
import type { Account, Family } from "@/types/database";

export type SessionContext = {
  userId: string;
  account: Account;
  family: Family;
};

/**
 * Muat akun ortu + keluarga untuk sesi aktif.
 * Dipakai di layout/server components setelah migrasi & RLS aktif.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const account = accountRow as Account | null;
  if (accountError || !account) return null;

  const { data: familyRow, error: familyError } = await supabase
    .from("families")
    .select("*")
    .eq("id", account.family_id)
    .maybeSingle();

  const family = familyRow as Family | null;
  if (familyError || !family) return null;

  return {
    userId: user.id,
    account,
    family,
  };
}
