"use server";

import { RPC } from "@/lib/database/rpc";
import { childAvatarStoragePath } from "@/lib/storage/child-avatar";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createChildProfileAction(
  name: string,
  pin: string,
  dobString: string,
  gender: "female" | "male" | "other"
) {
  if (!name || !name.trim()) {
    return { error: "Nama anak wajib diisi." };
  }
  if (!pin || pin.length < 4 || pin.length > 12 || !/^\d+$/.test(pin)) {
    return { error: "PIN harus berupa angka 4-12 digit." };
  }
  if (!dobString) {
    return { error: "Tanggal lahir wajib diisi." };
  }

  const supabase = await createClient();

  const { data: newId, error } = await (supabase as any).rpc("create_child_profile", {
    p_name: name.trim(),
    p_pin: pin,
    p_date_of_birth: dobString,
    p_gender: gender,
  });

  if (error) {
    console.error("Error creating child profile:", error);
    return { error: error.message || "Gagal membuat profil anak." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/parent");
  return { success: true, id: newId };
}

export async function updateChildProfileAction(
  profileId: string,
  name?: string,
  pin?: string,
  dobString?: string,
  gender?: "female" | "male" | "other",
  avatarPreference?: "photo" | "emoji",
  avatarEmoji?: string
) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }
  
  if (pin && (pin.length < 4 || pin.length > 12 || !/^\d+$/.test(pin))) {
    return { error: "PIN baru harus berupa angka 4-12 digit." };
  }

  const supabase = await createClient();

  const { error } = await (supabase as any).rpc("update_child_profile", {
    p_profile_id: profileId,
    p_name: name?.trim() || null,
    p_pin: pin || null,
    p_date_of_birth: dobString || null,
    p_gender: gender || null,
    p_avatar_preference: avatarPreference || null,
    p_avatar_emoji: avatarEmoji || null,
  });

  if (error) {
    console.error("Error updating child profile:", error);
    return { error: error.message || "Gagal memperbarui profil anak." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/parent");
  return { success: true };
}

export async function setChildProfileAvatarPathAction(
  profileId: string,
  storagePath?: string,
) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const path = (storagePath ?? childAvatarStoragePath(profileId)).trim();
  if (path.length < 3) {
    return { error: "Path foto avatar tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc(RPC.setChildProfileAvatarPath, {
    p_profile_id: profileId,
    p_storage_path: path,
  });

  if (error) {
    console.error("set_child_profile_avatar_path:", error);
    return { error: error.message || "Gagal menyimpan path foto avatar." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/parent");
  return { success: true, storagePath: path };
}

export async function archiveChildProfileAction(profileId: string) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.archiveChildProfile, { p_profile_id: profileId });

  if (error) {
    console.error("archive_child_profile:", error);
    return { error: error.message || "Gagal mengarsipkan profil anak." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/parent");
  return { success: true };
}

export async function restoreChildProfileAction(profileId: string) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.restoreChildProfile, { p_profile_id: profileId });

  if (error) {
    console.error("restore_child_profile:", error);
    return { error: error.message || "Gagal memulihkan profil anak." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/parent");
  return { success: true };
}
