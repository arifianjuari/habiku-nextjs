import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Account, Family } from "@/types/database";

export type SessionContext = {
  userId: string;
  account: Account;
  family: Family;
};

type AccountWithFamily = Account & {
  families: Family | Family[] | null;
};

/**
 * Muat akun ortu + keluarga untuk sesi aktif (deduplikasi per-request via React.cache).
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: row, error } = await supabase
    .from("accounts")
    .select("*, families(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !row) return null;

  const accountRow = row as AccountWithFamily;
  const familyRaw = accountRow.families;
  const family = (Array.isArray(familyRaw) ? familyRaw[0] : familyRaw) as Family | null;

  if (!family) return null;

  const { families: _families, ...account } = accountRow;

  return {
    userId: user.id,
    account: account as Account,
    family,
  };
});
