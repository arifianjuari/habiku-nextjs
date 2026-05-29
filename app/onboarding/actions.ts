"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function bootstrapOnboarding(prevState: any, formData: FormData) {
  const familyName = String(formData.get("familyName") ?? "").trim();
  const childName = String(formData.get("childName") ?? "").trim();
  const childPin = String(formData.get("childPin") ?? "").trim();
  const childDob = String(formData.get("childDob") ?? "").trim();
  const childGender = String(formData.get("childGender") ?? "other").trim();

  // Validate inputs
  if (!childName) {
    return { error: "Nama anak wajib diisi." };
  }
  if (!childPin || childPin.length < 4 || childPin.length > 12 || !/^[0-9]+$/.test(childPin)) {
    return { error: "PIN anak harus berupa 4-12 digit angka." };
  }
  if (!childDob) {
    return { error: "Tanggal lahir anak wajib diisi." };
  }

  const supabase = await createClient();

  // 1. Panggil RPC bootstrap_primary_family
  const { data: familyId, error: familyError } = await (supabase as any).rpc("bootstrap_primary_family", {
    p_family_name: familyName || "Keluarga Baru",
  });

  if (familyError) {
    console.error("Error bootstrapping family:", familyError);
    return { error: familyError.message || "Gagal membuat profil keluarga." };
  }

  // 2. Panggil RPC create_child_profile
  const { data: childId, error: childError } = await (supabase as any).rpc("create_child_profile", {
    p_name: childName,
    p_pin: childPin,
    p_date_of_birth: childDob,
    p_gender: childGender,
  });

  if (childError) {
    console.error("Error creating child profile:", childError);
    return { error: childError.message || "Keluarga berhasil dibuat, tetapi gagal menambahkan profil anak." };
  }

  // Revalidate path dan redirect
  revalidatePath("/parent");
  redirect("/parent");
}
