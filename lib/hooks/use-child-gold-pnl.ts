"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchChildGoldPnlSnapshot } from "@/lib/gold/fetch-gold";
import { childQueryKeys } from "@/lib/child/query-keys";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function useChildGoldPnl(
  profileId: string | null,
  quantityMilli: number,
  buyPriceEnergy: number,
  sellPriceEnergy: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey:
      profileId && enabled
        ? [...childQueryKeys.savings(profileId), "gold-pnl"] as const
        : ["child", "gold-pnl", "disabled"],
    queryFn: () =>
      fetchChildGoldPnlSnapshot(
        createClient(),
        profileId!,
        quantityMilli,
        buyPriceEnergy,
        sellPriceEnergy,
      ),
    enabled: Boolean(profileId && enabled),
    staleTime: CHILD_STALE_MS,
  });
}
