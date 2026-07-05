import { RPC } from "@/lib/database/rpc";
import type { createClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>;

export type StickyMessages = {
  personalStickyMessage: string | null;
  familyBroadcastMessage: string | null;
  /** Pesan efektif untuk aksi «Terima kasih» — pribadi mengutamakan keluarga. */
  stickyMessage: string | null;
};

type UntypedClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

function trimMessage(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadStickyMessages(
  supabase: SupabaseClient,
  profileId: string,
  familyId: string | null | undefined,
  options?: { parentStickyMessage?: string | null },
): Promise<StickyMessages> {
  const untyped = supabase as unknown as UntypedClient;
  const rpcClient = supabase as unknown as {
    rpc: (
      name: string,
      args: { p_profile_id: string },
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  };

  const [profileResult, familyResult, rpcResult] = await Promise.all([
    options?.parentStickyMessage !== undefined
      ? Promise.resolve({
          data: { parent_sticky_message: options.parentStickyMessage },
          error: null,
        })
      : untyped
          .from("child_profiles")
          .select("parent_sticky_message")
          .eq("id", profileId)
          .maybeSingle(),
    familyId
      ? untyped
          .from("families")
          .select("family_broadcast_message")
          .eq("id", familyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    rpcClient.rpc(RPC.getChildStickyMessage, { p_profile_id: profileId }),
  ]);

  if (profileResult.error) {
    console.error("loadStickyMessages profile:", profileResult.error.message);
  }
  if (familyResult.error) {
    console.error("loadStickyMessages family:", familyResult.error.message);
  }
  if (rpcResult.error) {
    console.error("loadStickyMessages rpc:", rpcResult.error.message);
  }

  const personal = trimMessage(profileResult.data?.parent_sticky_message);
  const familyFromTable = trimMessage(familyResult.data?.family_broadcast_message);
  const resolvedFromRpc = trimMessage(rpcResult.data);
  const familyBroadcastMessage = personal
    ? familyFromTable
    : (familyFromTable ?? resolvedFromRpc);

  return {
    personalStickyMessage: personal,
    familyBroadcastMessage,
    stickyMessage: personal ?? familyBroadcastMessage,
  };
}
