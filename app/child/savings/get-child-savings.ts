"use server";

import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchChildSavingsData } from "@/lib/savings/fetch-savings";
import { createClient } from "@/lib/supabase/server";
import type { ChildSavingsData } from "@/lib/savings/types";

export async function getChildSavingsDataAction(
  profileId: string,
): Promise<{ data?: ChildSavingsData; error?: string }> {
  const context = await getSessionContext();
  if (!context) return { error: "Sesi tidak valid." };

  const supabase = await createClient();
  const { data: child, error } = await supabase
    .from("child_profiles")
    .select("id, family_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !child || child.family_id !== context.family.id) {
    return { error: "Profil anak tidak ditemukan." };
  }

  const data = await fetchChildSavingsData(profileId, context.family.id);
  return { data };
}
