import { cookies } from "next/headers";
import { CHILD_PROFILE_COOKIE } from "@/lib/child/child-mode-session";
import { isValidChildProfileId } from "@/lib/child/profile-id";

export async function getServerChildProfileId(): Promise<string | null> {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(CHILD_PROFILE_COOKIE)?.value;
  return isValidChildProfileId(profileId) ? profileId : null;
}
