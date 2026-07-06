"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  PiggyBank,
  Plus,
  Check,
  X,
  BookOpen,
  Settings2,
  Gift,
  Lock,
  Zap,
  Wallet,
  Layers,
  Clock,
  Pencil,
  Trash2,
  Coins,
} from "lucide-react";
import type { ParentSavingsData, SavingsPocketWithBalance } from "@/lib/savings/types";
import type { GoldTradePending } from "@/lib/gold/types";
import { formatGoldQuantity } from "@/lib/gold/units";
import { ChildTabSelector } from "@/components/parent/child-tab-selector";
import { SavingsPocketEmojiPicker } from "@/components/parent/savings-pocket-emoji-picker";
import {
  DEFAULT_SAVINGS_POCKET_EMOJI,
  resolveSavingsPocketEmoji,
  type SavingsPocketEmoji,
} from "@/lib/savings/pocket-emoji";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSavingsPocketAction,
  updateSavingsPocketAction,
  deleteSavingsPocketAction,
  approveSavingsWithdrawAction,
  rejectSavingsWithdrawAction,
  approveGoalClaimAction,
  rejectGoalClaimAction,
  approveGoldTransactionAction,
  rejectGoldTransactionAction,
} from "@/app/parent/savings/actions";
import { DynamicParentGoldSavingsSection } from "@/components/parent/parent-dynamic-views";
import {
  bpsToPercentInputValue,
  effectiveMonthlyBps,
  formatInterestBps,
  MONTHLY_INTEREST_ABS_MAX_BPS,
  parseInterestPercentInput,
  sanitizeInterestPercentInput,
} from "@/lib/savings/interest";
import { cn } from "@/lib/utils";

type ParentSavingsViewProps = ParentSavingsData;

type SummaryStatProps = {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone?: "emerald" | "violet" | "slate";
};

function SummaryStat({ icon, label, value, suffix, tone = "slate" }: SummaryStatProps) {
  const valueTone =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "violet"
        ? "text-violet-700"
        : "text-foreground";

  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card px-2 py-2 shadow-sm sm:px-2.5">
      <div className="flex items-start gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 sm:size-6">
          {icon}
        </span>
        <p className="min-w-0 text-[9px] font-medium leading-tight text-muted-foreground text-pretty sm:text-[10px]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 font-heading text-base font-black tabular-nums leading-none sm:text-lg",
          valueTone,
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-0.5 text-xs font-bold text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}

type ApprovalActionsProps = {
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
};

function ApprovalActions({ disabled, onApprove, onReject }: ApprovalActionsProps) {
  return (
    <div className="flex w-full gap-1.5 sm:w-auto sm:shrink-0">
      <Button
        size="sm"
        data-compact
        disabled={disabled}
        onClick={onApprove}
        className="h-8 flex-1 gap-1 rounded-lg bg-emerald-600 text-xs font-bold hover:bg-emerald-700 sm:flex-none"
      >
        <Check className="size-3.5" aria-hidden />
        Setujui
      </Button>
      <Button
        size="sm"
        variant="outline"
        data-compact
        disabled={disabled}
        onClick={onReject}
        className="h-8 flex-1 gap-1 rounded-lg text-xs font-bold sm:flex-none"
      >
        <X className="size-3.5" aria-hidden />
        Tolak
      </Button>
    </div>
  );
}

function SavingsPocketCard({
  pocket,
  onEdit,
  onDelete,
  canDelete,
}: {
  pocket: SavingsPocketWithBalance;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const progress =
    pocket.target_amount && pocket.target_amount > 0
      ? Math.min(100, Math.round((pocket.balance / pocket.target_amount) * 100))
      : null;
  const effectiveBps = effectiveMonthlyBps(pocket);

  const metaParts: string[] = [];
  if (pocket.monthly_interest_bps > 0) {
    let interest = `Bunga ${formatInterestBps(effectiveBps)}/bln`;
    if (pocket.projected_interest > 0) interest += ` · +${pocket.projected_interest} E`;
    metaParts.push(interest);
  }
  if (pocket.target_amount) metaParts.push(`Target ${pocket.target_amount} E`);
  if (pocket.is_locked && pocket.locked_until) {
    metaParts.push(
      `Kunci ${new Date(pocket.locked_until).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })}`,
    );
  }
  if (pocket.reserved > 0) metaParts.push(`${pocket.reserved} E pending`);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="space-y-2 px-2.5 py-2.5">
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            {pocket.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-xs font-bold text-foreground">{pocket.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
                  pocket.pocket_type === "term"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {pocket.pocket_type === "term" ? "Deposito" : "Akumulatif"}
              </span>
              {pocket.default_for_goal_save ? (
                <span className="rounded bg-violet-100 px-1.5 py-px text-[9px] font-bold text-violet-700">
                  Default
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-0.5 font-heading text-base font-black tabular-nums text-violet-700">
              {pocket.balance}
              <Zap className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
            </span>
            {progress !== null ? (
              <span className="text-[10px] font-black tabular-nums text-violet-600">
                {progress}%
              </span>
            ) : null}
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-compact
                onClick={onEdit}
                aria-label={`Ubah kantong ${pocket.name}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
              {canDelete ? (
                <button
                  type="button"
                  data-compact
                  onClick={onDelete}
                  aria-label={`Hapus kantong ${pocket.name}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-red-200/80 text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {metaParts.length > 0 ? (
          <p className="min-w-0 truncate text-[10px] leading-tight text-muted-foreground">
            {metaParts.map((part, i) => (
              <span key={part}>
                {i > 0 ? <span className="text-border"> · </span> : null}
                <span
                  className={cn(
                    part.startsWith("Bunga") && "text-emerald-700",
                    (part.startsWith("Kunci") || part.includes("pending")) && "text-amber-700",
                  )}
                >
                  {part.startsWith("Kunci") ? (
                    <>
                      <Lock className="mr-0.5 inline size-2.5 -translate-y-px" aria-hidden />
                      {part}
                    </>
                  ) : part.includes("pending") ? (
                    <>
                      <Clock className="mr-0.5 inline size-2.5 -translate-y-px" aria-hidden />
                      {part}
                    </>
                  ) : (
                    part
                  )}
                </span>
              </span>
            ))}
          </p>
        ) : null}

        {progress !== null ? (
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-violet-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progres kantong ${pocket.name}`}
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ParentSavingsView({
  children,
  pocketsByProfile: initialPocketsByProfile,
  savableByProfile,
  pendingWithdrawals,
  pendingGoalClaims,
  savingsEnabled,
  gold,
}: ParentSavingsViewProps) {
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const [pocketsByProfile, setPocketsByProfile] = useState(initialPocketsByProfile);
  const [isPending, startTransition] = useTransition();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState(pendingWithdrawals);
  const [claims, setClaims] = useState(pendingGoalClaims);
  const [goldTrades, setGoldTrades] = useState<GoldTradePending[]>(gold.pendingTrades);
  const [rejectWithdrawId, setRejectWithdrawId] = useState<string | null>(null);
  const [rejectClaimId, setRejectClaimId] = useState<string | null>(null);
  const [rejectGoldTradeId, setRejectGoldTradeId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createPocketOpen, setCreatePocketOpen] = useState(false);
  const [pocketType, setPocketType] = useState<"flexible" | "term">("flexible");
  const [editingPocket, setEditingPocket] = useState<SavingsPocketWithBalance | null>(null);
  const [deletePocketTarget, setDeletePocketTarget] = useState<SavingsPocketWithBalance | null>(
    null,
  );
  const [editPocketType, setEditPocketType] = useState<"flexible" | "term">("flexible");
  const [createInterestPct, setCreateInterestPct] = useState("");
  const [editInterestPct, setEditInterestPct] = useState("");
  const [createPocketEmoji, setCreatePocketEmoji] = useState<SavingsPocketEmoji>(
    DEFAULT_SAVINGS_POCKET_EMOJI,
  );
  const [editPocketEmoji, setEditPocketEmoji] = useState<SavingsPocketEmoji>(
    DEFAULT_SAVINGS_POCKET_EMOJI,
  );

  useEffect(() => {
    setPocketsByProfile(initialPocketsByProfile);
    setWithdrawals(pendingWithdrawals);
    setClaims(pendingGoalClaims);
    setGoldTrades(gold.pendingTrades);
  }, [initialPocketsByProfile, pendingWithdrawals, pendingGoalClaims, gold.pendingTrades]);

  const activeChild = children.find((c) => c.id === activeChildId);
  const pockets = pocketsByProfile[activeChildId] ?? [];
  const savable = savableByProfile[activeChildId] ?? 0;
  const totalPocketBalance = pockets.reduce((sum, pocket) => sum + pocket.balance, 0);
  const pendingCount = claims.length + withdrawals.length + goldTrades.length;

  const canEditPocketStructure = (editingPocket?.balance ?? 0) === 0;
  const canCorrectInterest = (editingPocket?.balance ?? 0) > 0;

  const canDeletePocket = (pocket: SavingsPocketWithBalance) =>
    pocket.balance === 0 && pocket.reserved === 0 && !pocket.is_locked;

  const openEditPocket = (pocket: SavingsPocketWithBalance) => {
    setEditingPocket(pocket);
    setEditPocketType(pocket.pocket_type);
    setEditInterestPct(bpsToPercentInputValue(pocket.monthly_interest_bps));
    setEditPocketEmoji(resolveSavingsPocketEmoji(pocket.emoji));
  };

  const handleUpdatePocket = (formData: FormData) => {
    if (!editingPocket) return;
    formData.set("pocketId", editingPocket.id);
    formData.set("pocketType", editPocketType);
    const parsedInterest = parseInterestPercentInput(editInterestPct);
    if (!parsedInterest.ok) {
      toast.error(parsedInterest.error);
      return;
    }
    formData.set("monthlyInterestBps", String(parsedInterest.bps));
    const pocketId = editingPocket.id;
    const nextName = String(formData.get("name") ?? editingPocket.name);
    const nextEmoji = String(formData.get("emoji") ?? editingPocket.emoji);
    const nextAccent = String(formData.get("accentColor") ?? editingPocket.accent_color);
    const targetRaw = String(formData.get("targetAmount") ?? "");
    const nextTarget = targetRaw ? Number(targetRaw) : null;
    const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
    const nextLockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : editingPocket.lock_months;
    const nextLockBonusCoefficient = Number(
      formData.get("lockBonusCoefficient") ?? editingPocket.lock_bonus_coefficient,
    );
    const previousPockets = pocketsByProfile;

    setPocketsByProfile((prev) => ({
      ...prev,
      [editingPocket.profile_id]: (prev[editingPocket.profile_id] ?? []).map((pocket) =>
        pocket.id === pocketId
          ? {
              ...pocket,
              name: nextName,
              emoji: nextEmoji,
              accent_color: nextAccent,
              target_amount: nextTarget,
              pocket_type: canEditPocketStructure ? editPocketType : pocket.pocket_type,
              monthly_interest_bps: parsedInterest.bps,
              lock_months:
                editPocketType === "term" ? nextLockMonths : pocket.lock_months,
              lock_bonus_coefficient:
                editPocketType === "term" ? nextLockBonusCoefficient : pocket.lock_bonus_coefficient,
            }
          : pocket,
      ),
    }));

    startTransition(async () => {
      const res = await updateSavingsPocketAction(formData);
      if (res.error) {
        toast.error(res.error);
        setPocketsByProfile(previousPockets);
      } else {
        toast.success("Kantong tabungan diperbarui.");
        setEditingPocket(null);
      }
    });
  };

  const handleDeletePocket = () => {
    if (!deletePocketTarget) return;
    const pocketId = deletePocketTarget.id;
    const profileId = deletePocketTarget.profile_id;
    const previousPockets = pocketsByProfile;

    setPocketsByProfile((prev) => ({
      ...prev,
      [profileId]: (prev[profileId] ?? []).filter((pocket) => pocket.id !== pocketId),
    }));
    setDeletePocketTarget(null);
    if (editingPocket?.id === pocketId) setEditingPocket(null);

    startTransition(async () => {
      const res = await deleteSavingsPocketAction(pocketId);
      if (res.error) {
        toast.error(res.error);
        setPocketsByProfile(previousPockets);
      } else {
        toast.success("Kantong tabungan dihapus.");
      }
    });
  };

  const handleCreatePocket = (formData: FormData) => {
    formData.set("profileId", activeChildId);
    formData.set("pocketType", pocketType);
    const parsedInterest = parseInterestPercentInput(createInterestPct);
    if (!parsedInterest.ok) {
      toast.error(parsedInterest.error);
      return;
    }
    formData.set("monthlyInterestBps", String(parsedInterest.bps));
    const optimisticId = `optimistic-${Date.now()}`;
    const nextName = String(formData.get("name") ?? "");
    const nextEmoji = String(formData.get("emoji") ?? createPocketEmoji);
    const nextAccent = String(formData.get("accentColor") ?? "#8B5CF6");
    const targetRaw = String(formData.get("targetAmount") ?? "");
    const nextTarget = targetRaw ? Number(targetRaw) : null;
    const lockMonthsRaw = String(formData.get("lockMonths") ?? "");
    const lockMonths = lockMonthsRaw ? Number(lockMonthsRaw) : null;

    const optimisticPocket: SavingsPocketWithBalance = {
      id: optimisticId,
      profile_id: activeChildId,
      name: nextName,
      emoji: nextEmoji,
      accent_color: nextAccent,
      target_amount: nextTarget,
      is_active: true,
      created_at: new Date().toISOString(),
      pocket_type: pocketType,
      monthly_interest_bps: parsedInterest.bps,
      lock_months: lockMonths,
      lock_bonus_coefficient: Number(formData.get("lockBonusCoefficient") ?? 1),
      default_for_goal_save: formData.get("defaultForGoalSave") === "on",
      balance: 0,
      reserved: 0,
      is_locked: pocketType === "term",
      locked_until: null,
      interest_accrued: 0,
      projected_interest: 0,
    };

    setPocketsByProfile((prev) => ({
      ...prev,
      [activeChildId]: [...(prev[activeChildId] ?? []), optimisticPocket],
    }));

    startTransition(async () => {
      const res = await createSavingsPocketAction(formData);
      if (res.error) {
        toast.error(res.error);
        setPocketsByProfile((prev) => ({
          ...prev,
          [activeChildId]: (prev[activeChildId] ?? []).filter((p) => p.id !== optimisticId),
        }));
      } else {
        toast.success("Kantong tabungan dibuat.");
        setCreatePocketOpen(false);
        setPocketType("flexible");
        setCreateInterestPct("");
        setCreatePocketEmoji(DEFAULT_SAVINGS_POCKET_EMOJI);
        if (res.pocketId) {
          setPocketsByProfile((prev) => ({
            ...prev,
            [activeChildId]: (prev[activeChildId] ?? []).map((pocket) =>
              pocket.id === optimisticId ? { ...pocket, id: res.pocketId! } : pocket,
            ),
          }));
        } else {
          setPocketsByProfile((prev) => ({
            ...prev,
            [activeChildId]: (prev[activeChildId] ?? []).filter((p) => p.id !== optimisticId),
          }));
        }
      }
    });
  };

  const handleApproveWithdraw = (txId: string) => {
    const previousWithdrawals = withdrawals;
    setWithdrawals((prev) => prev.filter((item) => item.id !== txId));
    setPendingActionId(txId);
    startTransition(async () => {
      const res = await approveSavingsWithdrawAction(txId);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setWithdrawals(previousWithdrawals);
      } else {
        toast.success("Penarikan disetujui. Energi kembali ke target aktif anak.");
      }
    });
  };

  const handleRejectWithdraw = () => {
    if (!rejectWithdrawId) return;
    const txId = rejectWithdrawId;
    const previousWithdrawals = withdrawals;
    setWithdrawals((prev) => prev.filter((item) => item.id !== txId));
    setRejectWithdrawId(null);
    setPendingActionId(txId);
    startTransition(async () => {
      const res = await rejectSavingsWithdrawAction(txId, rejectReason);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setWithdrawals(previousWithdrawals);
      } else {
        toast.success("Penarikan ditolak.");
        setRejectReason("");
      }
    });
  };

  const handleApproveClaim = (requestId: string) => {
    const previousClaims = claims;
    setClaims((prev) => prev.filter((item) => item.id !== requestId));
    setPendingActionId(requestId);
    startTransition(async () => {
      const res = await approveGoalClaimAction(requestId);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setClaims(previousClaims);
      } else {
        toast.success("Hadiah disetujui untuk dicairkan.");
      }
    });
  };

  const handleRejectClaim = () => {
    if (!rejectClaimId) return;
    const requestId = rejectClaimId;
    const previousClaims = claims;
    setClaims((prev) => prev.filter((item) => item.id !== requestId));
    setRejectClaimId(null);
    setPendingActionId(requestId);
    startTransition(async () => {
      const res = await rejectGoalClaimAction(requestId, rejectReason);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setClaims(previousClaims);
      } else {
        toast.success("Permintaan hadiah ditolak.");
        setRejectReason("");
      }
    });
  };

  const handleApproveGoldTrade = (txId: string) => {
    const previousGoldTrades = goldTrades;
    setGoldTrades((prev) => prev.filter((item) => item.id !== txId));
    setPendingActionId(txId);
    startTransition(async () => {
      const res = await approveGoldTransactionAction(txId);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setGoldTrades(previousGoldTrades);
      } else {
        toast.success("Transaksi emas disetujui.");
      }
    });
  };

  const handleRejectGoldTrade = () => {
    if (!rejectGoldTradeId) return;
    const txId = rejectGoldTradeId;
    const previousGoldTrades = goldTrades;
    setGoldTrades((prev) => prev.filter((item) => item.id !== txId));
    setRejectGoldTradeId(null);
    setPendingActionId(txId);
    startTransition(async () => {
      const res = await rejectGoldTransactionAction(txId, rejectReason);
      setPendingActionId(null);
      if (res.error) {
        toast.error(res.error);
        setGoldTrades(previousGoldTrades);
      } else {
        toast.success("Transaksi emas ditolak.");
        setRejectReason("");
      }
    });
  };

  const pendingApprovalsSection =
    pendingCount > 0 ? (
      <section
        className="space-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 shadow-sm"
        aria-label="Permintaan menunggu persetujuan"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100">
            <Clock className="size-4 text-amber-700" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold text-amber-950">Perlu persetujuan</p>
            <p className="text-[10px] text-amber-800/80">{pendingCount} permintaan menunggu</p>
          </div>
        </div>

        <div className="space-y-2">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="flex flex-col gap-2.5 rounded-xl border border-violet-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Gift className="size-4 shrink-0 text-violet-600" aria-hidden />
                  <span className="truncate">
                    {claim.child_name} · {claim.goal_title}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Cair hadiah · {claim.amount} E
                </p>
              </div>
              <ApprovalActions
                disabled={pendingActionId === claim.id}
                onApprove={() => handleApproveClaim(claim.id)}
                onReject={() => setRejectClaimId(claim.id)}
              />
            </div>
          ))}

          {withdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="flex flex-col gap-2.5 rounded-xl border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  <span aria-hidden>{withdrawal.pocket_emoji} </span>
                  {withdrawal.child_name} · {withdrawal.pocket_name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Penarikan {withdrawal.amount} E
                  {withdrawal.note ? ` — ${withdrawal.note}` : ""}
                </p>
              </div>
              <ApprovalActions
                disabled={pendingActionId === withdrawal.id}
                onApprove={() => handleApproveWithdraw(withdrawal.id)}
                onReject={() => setRejectWithdrawId(withdrawal.id)}
              />
            </div>
          ))}

          {goldTrades.map((trade) => (
            <div
              key={trade.id}
              className="flex flex-col gap-2.5 rounded-xl border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Coins className="size-4 shrink-0 text-amber-600" aria-hidden />
                  <span className="truncate">
                    {trade.child_name} · {trade.kind === "buy" ? "Beli emas" : "Jual emas"}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatGoldQuantity(trade.quantityMilli, gold.prices.unitLabel)} ·{" "}
                  {trade.energy_amount} E
                </p>
              </div>
              <ApprovalActions
                disabled={pendingActionId === trade.id}
                onApprove={() => handleApproveGoldTrade(trade.id)}
                onReject={() => setRejectGoldTradeId(trade.id)}
              />
            </div>
          ))}
        </div>
      </section>
    ) : null;

  const approvalRejectDialogs = (
    <>
      <Dialog open={!!rejectWithdrawId} onOpenChange={(o) => !o && setRejectWithdrawId(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Tolak penarikan</DialogTitle>
            <DialogDescription className="text-xs">
              Beri alasan singkat agar anak mengerti (opsional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-withdraw-reason" className="text-xs font-bold">
              Alasan
            </Label>
            <Input
              id="reject-withdraw-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. nabung dulu sampai kunci habis"
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectWithdrawId(null)} className="rounded-xl">
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleRejectWithdraw}
              className="rounded-xl"
            >
              Tolak penarikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectClaimId} onOpenChange={(o) => !o && setRejectClaimId(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Tolak cair hadiah</DialogTitle>
            <DialogDescription className="text-xs text-pretty">
              Anak masih bisa memilih menabung energinya ke kantong.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-claim-reason" className="text-xs font-bold">
              Alasan
            </Label>
            <Input
              id="reject-claim-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. nabung dulu untuk hadiah yang lebih besar"
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectClaimId(null)} className="rounded-xl">
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleRejectClaim}
              className="rounded-xl"
            >
              Tolak permintaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectGoldTradeId} onOpenChange={(o) => !o && setRejectGoldTradeId(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Tolak transaksi emas</DialogTitle>
            <DialogDescription className="text-xs text-pretty">
              Anak akan mendapat notifikasi jika permintaan beli/jual emas ditolak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-gold-reason" className="text-xs font-bold">
              Alasan
            </Label>
            <Input
              id="reject-gold-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Mis. diskusi dulu soal tabungan emas"
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectGoldTradeId(null)} className="rounded-xl">
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleRejectGoldTrade}
              className="rounded-xl"
            >
              Tolak transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Tambahkan profil anak terlebih dahulu.
          </p>
        </div>
        <DynamicParentGoldSavingsSection gold={gold} children={children} activeChildId="" />
      </div>
    );
  }

  const savingsDisabledCard = !savingsEnabled ? (
    <Card className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100">
          <PiggyBank className="size-7 text-violet-400" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Tabungan digital nonaktif</p>
          <p className="max-w-xs text-xs text-muted-foreground text-pretty">
            Aktifkan fitur tabungan agar anak bisa menabung energi dari target hadiah.
          </p>
        </div>
        <Link
          href="/parent/settings/engagement"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 shadow-sm transition-colors hover:bg-violet-50"
        >
          <Settings2 className="size-4" aria-hidden />
          Pengaturan Engagement
        </Link>
      </CardContent>
    </Card>
  ) : null;

  if (!savingsEnabled && !gold.goldSavingsEnabled) {
    return (
      <div className="space-y-4">
        {savingsDisabledCard}
        <DynamicParentGoldSavingsSection gold={gold} children={children} activeChildId={activeChildId} />
      </div>
    );
  }

  if (!savingsEnabled) {
    return (
      <div className="min-w-0 space-y-3.5 overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {savingsDisabledCard}
        {pendingApprovalsSection}
        <ChildTabSelector
          profiles={children}
          activeChildId={activeChildId}
          onActiveChildIdChange={setActiveChildId}
        />
        <DynamicParentGoldSavingsSection gold={gold} children={children} activeChildId={activeChildId} />
        {approvalRejectDialogs}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3.5 overflow-x-clip pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {pendingApprovalsSection}

      <ChildTabSelector
        profiles={children}
        activeChildId={activeChildId}
        onActiveChildIdChange={setActiveChildId}
      />

      {activeChild ? (
        <section
          className="grid grid-cols-3 gap-1.5 sm:gap-2"
          aria-label={`Ringkasan tabungan ${activeChild.name}`}
        >
          <SummaryStat
            icon={<Wallet className="size-3.5 text-emerald-600" aria-hidden />}
            label="Bisa ditabung"
            value={savable}
            suffix="E"
            tone="emerald"
          />
          <SummaryStat
            icon={<PiggyBank className="size-3.5 text-violet-600" aria-hidden />}
            label="Total tabungan"
            value={totalPocketBalance}
            suffix="E"
            tone="violet"
          />
          <SummaryStat
            icon={<Layers className="size-3.5 text-slate-600" aria-hidden />}
            label="Kantong"
            value={pockets.length}
            tone="slate"
          />
        </section>
      ) : null}

      <section className="space-y-2" aria-label="Daftar kantong tabungan">
        <div className="space-y-0.5 px-0.5">
          <h2 className="text-xs font-bold text-muted-foreground">Kantong tabungan</h2>
          {activeChild ? (
            <p className="text-[10px] leading-snug text-muted-foreground text-pretty">
              Energi di target aktif bisa ditabung ke kantong
            </p>
          ) : null}
        </div>

        {pockets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/20 px-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-3xl shadow-inner">
              🐷
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Belum ada kantong</p>
              <p className="max-w-[240px] text-xs text-muted-foreground text-pretty">
                Buat kantong pertama untuk {activeChild?.name} agar anak bisa menabung energi.
              </p>
            </div>
            <Button
              type="button"
              data-compact
              onClick={() => setCreatePocketOpen(true)}
              className="h-9 gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold hover:bg-violet-800"
            >
              <Plus className="size-4" aria-hidden />
              Buat kantong
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {pockets.map((pocket) => (
              <SavingsPocketCard
                key={pocket.id}
                pocket={pocket}
                onEdit={() => openEditPocket(pocket)}
                onDelete={() => setDeletePocketTarget(pocket)}
                canDelete={canDeletePocket(pocket)}
              />
            ))}
          </div>
        )}
      </section>

      <DynamicParentGoldSavingsSection gold={gold} children={children} activeChildId={activeChildId} />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.5rem)] z-50">
        <div className="pointer-events-auto mx-auto flex w-full max-w-lg items-center justify-center gap-2 px-4">
          <Link
            href="/parent/ledger"
            data-compact
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-4 text-xs font-bold text-slate-700 shadow-lg shadow-slate-950/8 backdrop-blur-sm transition-colors hover:bg-slate-50"
          >
            <BookOpen className="size-4" aria-hidden />
            Buku besar
          </Link>
          {activeChild ? (
            <button
              type="button"
              data-compact
              onClick={() => setCreatePocketOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-violet-700 px-4 text-xs font-bold text-white shadow-lg shadow-violet-950/20 transition-colors hover:bg-violet-800"
            >
              <Plus className="size-4" aria-hidden />
              Kantong baru
            </button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={createPocketOpen}
        onOpenChange={(open) => {
          setCreatePocketOpen(open);
          if (!open) {
            setCreateInterestPct("");
            setCreatePocketEmoji(DEFAULT_SAVINGS_POCKET_EMOJI);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">
              Kantong untuk {activeChild?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-pretty">
              Atur tipe, bunga, dan kunci. Deposito hanya menerima satu setoran.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreatePocket(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pocket-name" className="text-xs font-bold">
                Nama kantong
              </Label>
              <Input
                id="pocket-name"
                name="name"
                required
                maxLength={40}
                placeholder="Mis. Tabungan sepeda"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tipe kantong</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPocketType("flexible")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs transition-colors",
                    pocketType === "flexible"
                      ? "border-violet-500 bg-violet-50 font-semibold ring-1 ring-violet-500/20"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block font-bold">Akumulatif</span>
                  <span className="text-muted-foreground">Banyak setoran</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPocketType("term")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs transition-colors",
                    pocketType === "term"
                      ? "border-amber-500 bg-amber-50 font-semibold ring-1 ring-amber-500/20"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block font-bold">Deposito</span>
                  <span className="text-muted-foreground">Satu setoran + kunci</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pocket-emoji" className="text-xs font-bold">
                Emoji kantong
              </Label>
              <SavingsPocketEmojiPicker
                id="pocket-emoji"
                name="emoji"
                value={createPocketEmoji}
                onChange={setCreatePocketEmoji}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pocket-target" className="text-xs font-bold">
                Target (opsional)
              </Label>
              <Input
                id="pocket-target"
                name="targetAmount"
                type="number"
                min={1}
                placeholder="100"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="monthly-interest" className="text-xs font-bold">
                  Bunga (%/bulan)
                </Label>
                <Input
                  id="monthly-interest"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={createInterestPct}
                  onChange={(e) =>
                    setCreateInterestPct((prev) =>
                      sanitizeInterestPercentInput(e.target.value, prev),
                    )
                  }
                  className="h-10 tabular-nums"
                />
                <p className="text-[10px] text-muted-foreground">
                  Min. 0% · maks. {MONTHLY_INTEREST_ABS_MAX_BPS / 100}% · 2 desimal
                </p>
              </div>
              {pocketType === "term" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="lock-months" className="text-xs font-bold">
                    Kunci (bulan)
                  </Label>
                  <Input
                    id="lock-months"
                    name="lockMonths"
                    type="number"
                    min={1}
                    max={36}
                    defaultValue={3}
                    required
                    className="h-10"
                  />
                </div>
              ) : null}
            </div>

            {pocketType === "term" ? (
              <div className="space-y-1.5">
                <Label htmlFor="lock-coefficient" className="text-xs font-bold">
                  Koefisien bonus kunci
                </Label>
                <Input
                  id="lock-coefficient"
                  name="lockBonusCoefficient"
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  defaultValue={1}
                  className="h-10"
                />
                <p className="text-[10px] text-muted-foreground text-pretty">
                  Semakin tinggi, bunga efektif lebih besar selama masa kunci.
                </p>
              </div>
            ) : (
              <input type="hidden" name="lockBonusCoefficient" value="1" />
            )}

            <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
              <input type="checkbox" name="defaultForGoalSave" className="rounded border-input" />
              Kantong default saat anak menabung dari target hadiah
            </label>

            <input type="hidden" name="accentColor" value="#8B5CF6" />
            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 w-full rounded-xl bg-violet-700 font-bold hover:bg-violet-800"
              >
                Buat kantong
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingPocket}
        onOpenChange={(open) => {
          if (!open) setEditingPocket(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
          {editingPocket ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-base">
                  Ubah kantong {editingPocket.emoji} {editingPocket.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-pretty">
                  {canEditPocketStructure
                    ? "Kantong masih kosong — semua pengaturan bisa diubah."
                    : "Kantong sudah berisi saldo — bunga, kunci, dan koefisien bisa dikoreksi. Tipe kantong tidak bisa diubah."}
                </DialogDescription>
              </DialogHeader>
              <form
                key={editingPocket.id}
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdatePocket(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pocket-name" className="text-xs font-bold">
                    Nama kantong
                  </Label>
                  <Input
                    id="edit-pocket-name"
                    name="name"
                    required
                    maxLength={40}
                    defaultValue={editingPocket.name}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Tipe kantong</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!canEditPocketStructure}
                      onClick={() => setEditPocketType("flexible")}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        editPocketType === "flexible"
                          ? "border-violet-500 bg-violet-50 font-semibold ring-1 ring-violet-500/20"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="block font-bold">Akumulatif</span>
                      <span className="text-muted-foreground">Banyak setoran</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canEditPocketStructure}
                      onClick={() => setEditPocketType("term")}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        editPocketType === "term"
                          ? "border-amber-500 bg-amber-50 font-semibold ring-1 ring-amber-500/20"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="block font-bold">Deposito</span>
                      <span className="text-muted-foreground">Satu setoran + kunci</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-pocket-emoji" className="text-xs font-bold">
                    Emoji kantong
                  </Label>
                  <SavingsPocketEmojiPicker
                    id="edit-pocket-emoji"
                    name="emoji"
                    value={editPocketEmoji}
                    onChange={setEditPocketEmoji}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-pocket-target" className="text-xs font-bold">
                    Target (opsional)
                  </Label>
                  <Input
                    id="edit-pocket-target"
                    name="targetAmount"
                    type="number"
                    min={1}
                    defaultValue={editingPocket.target_amount ?? ""}
                    placeholder="100"
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-monthly-interest" className="text-xs font-bold">
                      Bunga (%/bulan)
                    </Label>
                    <Input
                      id="edit-monthly-interest"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={editInterestPct}
                      onChange={(e) =>
                        setEditInterestPct((prev) =>
                          sanitizeInterestPercentInput(e.target.value, prev),
                        )
                      }
                      disabled={false}
                      className="h-10 tabular-nums"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Min. 0% · maks. {MONTHLY_INTEREST_ABS_MAX_BPS / 100}% · 2 desimal
                      {canCorrectInterest ? " · bunga lama tidak berubah" : ""}
                    </p>
                  </div>
                  {editPocketType === "term" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-lock-months" className="text-xs font-bold">
                        Kunci (bulan)
                      </Label>
                      <Input
                        id="edit-lock-months"
                        name="lockMonths"
                        type="number"
                        min={1}
                        max={36}
                        defaultValue={editingPocket.lock_months ?? 3}
                        required
                        className="h-10"
                      />
                      {canCorrectInterest ? (
                        <p className="text-[10px] text-muted-foreground text-pretty">
                          Jatuh tempo dihitung ulang dari tanggal setoran awal.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {editPocketType === "term" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-lock-coefficient" className="text-xs font-bold">
                      Koefisien bonus kunci
                    </Label>
                    <Input
                      id="edit-lock-coefficient"
                      name="lockBonusCoefficient"
                      type="number"
                      min={0.1}
                      max={5}
                      step={0.1}
                      defaultValue={editingPocket.lock_bonus_coefficient}
                      className="h-10"
                    />
                    <p className="text-[10px] text-muted-foreground text-pretty">
                      {canCorrectInterest
                        ? "Koreksi berlaku untuk akrual bunga berikutnya."
                        : "Semakin tinggi, bunga efektif lebih besar selama masa kunci."}
                    </p>
                  </div>
                ) : (
                  <input type="hidden" name="lockBonusCoefficient" value="1" />
                )}

                <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                  <input
                    type="checkbox"
                    name="defaultForGoalSave"
                    defaultChecked={editingPocket.default_for_goal_save}
                    className="rounded border-input"
                  />
                  Kantong default saat anak menabung dari target hadiah
                </label>

                <input type="hidden" name="accentColor" value={editingPocket.accent_color} />
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  {canDeletePocket(editingPocket) ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        setDeletePocketTarget(editingPocket);
                        setEditingPocket(null);
                      }}
                      className="h-10 w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Hapus kantong
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-11 w-full rounded-xl bg-violet-700 font-bold hover:bg-violet-800"
                  >
                    Simpan perubahan
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletePocketTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePocketTarget(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Hapus kantong?</DialogTitle>
            <DialogDescription className="text-xs text-pretty">
              {deletePocketTarget ? (
                <>
                  Kantong <strong>{deletePocketTarget.emoji} {deletePocketTarget.name}</strong>{" "}
                  ({deletePocketTarget.pocket_type === "term" ? "deposito" : "akumulatif"}) akan
                  dihapus permanen. Hanya kantong kosong tanpa penarikan tertunda yang bisa
                  dihapus.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeletePocketTarget(null)}
              className="h-10 w-full rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleDeletePocket}
              className="h-10 w-full rounded-xl bg-red-600 font-bold hover:bg-red-700"
            >
              {isPending ? "Menghapus…" : "Ya, hapus kantong"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {approvalRejectDialogs}
    </div>
  );
}
