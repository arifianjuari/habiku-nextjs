import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  RPC,
  type ApproveTaskHistoryArgs,
  type RejectTaskHistoryArgs,
  type RpcName,
  type VerifyChildPinArgs,
} from "@/lib/database/rpc";

type HabikuClient = SupabaseClient<Database>;

export async function callRpc<TResult>(
  client: HabikuClient,
  fn: RpcName,
  args?: Record<string, unknown>,
): Promise<{ data: TResult | null; error: Error | null }> {
  const { data, error } = await (
    client as unknown as {
      rpc: (
        name: string,
        params?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc(fn, args ?? {});

  return {
    data: (data as TResult) ?? null,
    error: error ? new Error(error.message) : null,
  };
}

export function approveTaskHistory(
  client: HabikuClient,
  args: ApproveTaskHistoryArgs,
) {
  return callRpc(client, RPC.approveTaskHistory, args);
}

export function rejectTaskHistory(
  client: HabikuClient,
  args: RejectTaskHistoryArgs,
) {
  return callRpc(client, RPC.rejectTaskHistory, args);
}

export function verifyChildProfilePin(
  client: HabikuClient,
  args: VerifyChildPinArgs,
) {
  return callRpc<boolean>(client, RPC.verifyChildProfilePin, args);
}
