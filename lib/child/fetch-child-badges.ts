import { createClient } from "@/lib/supabase/client";
import type { AppSupabaseClient } from "@/lib/supabase/types";

export async function fetchChildBadgeKeys(
  profileId: string,
  supabase?: AppSupabaseClient,
): Promise<string[]> {
  const client = supabase ?? createClient();

  await (client as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<unknown>;
  }).rpc("award_eligible_badges", { p_profile_id: profileId });

  const { data, error } = await client
    .from("child_badges")
    .select("badge_key")
    .eq("profile_id", profileId);

  if (error) throw error;
  return data?.map((row) => row.badge_key) ?? [];
}
