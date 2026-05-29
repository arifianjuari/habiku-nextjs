"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createFamilyInviteAction() {
  const supabase = await createClient();

  // Panggil RPC create_family_invite()
  const { data: token, error } = await (supabase as any).rpc("create_family_invite");

  if (error) {
    console.error("Error creating family invite:", error);
    return { error: error.message || "Gagal membuat link undangan keluarga." };
  }

  revalidatePath("/parent/settings");
  return { success: true, token };
}

export async function acceptFamilyInviteAction(token: string) {
  if (!token || !token.trim()) {
    return { error: "Token undangan tidak valid." };
  }

  const supabase = await createClient();

  // Panggil RPC accept_family_invite(p_token)
  const { data: familyId, error } = await (supabase as any).rpc("accept_family_invite", {
    p_token: token.trim(),
  });

  if (error) {
    console.error("Error accepting family invite:", error);
    return { error: error.message || "Gagal menerima undangan keluarga." };
  }

  revalidatePath("/parent");
  revalidatePath("/onboarding");
  return { success: true, familyId };
}
