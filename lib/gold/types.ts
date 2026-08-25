export type GoldPrices = {
  sellPriceEnergy: number;
  buyPriceEnergy: number;
  unitLabel: string;
};

export type GoldTransactionRow = {
  id: string;
  profile_id: string;
  kind: "buy" | "sell";
  quantityMilli: number;
  energy_amount: number;
  unit_price_energy: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  child_name?: string;
};

export type GoldTradePending = {
  id: string;
  profile_id: string;
  kind: "buy" | "sell";
  quantityMilli: number;
  energy_amount: number;
  child_name: string;
  created_at: string;
};

export type GoldSavingsSettings = {
  goldSavingsEnabled: boolean;
  prices: GoldPrices;
};

export type ParentGoldSavingsData = GoldSavingsSettings & {
  holdingsByProfile: Record<string, number>;
  pendingTrades: GoldTradePending[];
  transactions: GoldTransactionRow[];
};

export type ChildGoldSavingsData = GoldSavingsSettings & {
  quantityMilli: number;
  reservedSellMilli: number;
  pendingBuyEnergy: number;
  estimatedSellEnergy: number;
  pendingTrades: GoldTradePending[];
  transactions: GoldTransactionRow[];
};
