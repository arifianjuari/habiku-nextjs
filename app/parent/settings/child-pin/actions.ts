"use server";

import { revalidatePath } from "next/cache";
import { updateChildProfileAction } from "@/app/parent/profil-anak/actions";

export async function updateChildPinAction(profileId: string, pin: string) {
  const res = await updateChildProfileAction(profileId, undefined, pin);

  if (res?.success) {
    revalidatePath("/parent/settings/child-pin");
  }

  return res;
}
