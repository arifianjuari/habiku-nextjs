"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import type { ParentSavingsData, SavingsPocketWithBalance } from "@/lib/savings/types";
import { ChildTabSelector } from "@/components/parent/child-tab-selector";
import { SavingsPocketEmojiPicker } from "@/components/parent/savings-pocket-emoji-picker";
import { DEFAULT_SAVINGS_POCKET_EMOJI } from "@/lib/savings/pocket-emoji";
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
  approveSavingsWithdrawAction,
  rejectSavingsWithdrawAction,
  approveGoalClaimAction,
  rejectGoalClaimAction,
} from "@/app/parent/savings/actions";
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
    <div className="min-w-0 rounded-xl border border-border/60 bg-card px-2.5 py-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60">
          {icon}
        </span>
        <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-1 font-heading text-lg font-black tabular-nums leading-none", valueTone)}>
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
}: {
  pocket: SavingsPocketWithBalance;
  onEdit: () => void;
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
    <article className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="space-y-1.5 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            {pocket.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-heading text-xs font-bold text-foreground">
                {pocket.name}
              </h3>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
                  pocket.pocket_type === "term"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {pocket.pocket_type === "term" ? "Deposito" : "Akumulatif"}
              </span>
              {pocket.default_for_goal_save ? (
                <span className="shrink-0 rounded bg-violet-100 px-1.5 py-px text-[9px] font-bold text-violet-700">
                  Default
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {progress !== null ? (
              <span className="text-[10px] font-black tabular-nums text-violet-600">
                {progress}%
              </span>
            ) : null}
            <span className="flex items-center gap-0.5 font-heading text-base font-black tabular-nums text-violet-700">
              {pocket.balance}
              <Zap className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
            </span>
            <button
              type="button"
              data-compact
              onClick={onEdit}
              aria-label={`Ubah kantong ${pocket.name}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {metaParts.length > 0 ? (
          <p className="truncate pl-[calc(1.125rem+0.5rem)] text-[10px] leading-tight text-muted-foreground">
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
  pocketsByProfile,
  savableByProfile,
  pendingWithdrawals,
  pendingGoalClaims,
  savingsEnabled,
}: ParentSavingsViewProps) {
  const router = useRouter();
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [rejectWithdrawId, setRejectWithdrawId] = useState<string | null>(null);
  const [rejectClaimId, setRejectClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createPocketOpen, setCreatePocketOpen] = useState(false);
  const [pocketType, setPocketType] = useState<"flexible" | "term">("flexible");
  const [editingPocket, setEditingPocket] = useState<SavingsPocketWithBalance | null>(null);
  const [editPocketType, setEditPocketType] = useState<"flexible" | "term">("flexible");
  const [createInterestPct, setCreateInterestPct] = useState("");
  const [editInterestPct, setEditInterestPct] = useState("");
  const [createPocketEmoji, setCreatePocketEmoji] = useState(DEFAULT_SAVINGS_POCKET_EMOJI);
  const [editPocketEmoji, setEditPocketEmoji] = useState(DEFAULT_SAVINGS_POCKET_EMOJI);

  const activeChild = children.find((c) => c.id === activeChildId);
  const pockets = pocketsByProfile[activeChildId] ?? [];
  const savable = savableByProfile[activeChildId] ?? 0;
  const totalPocketBalance = pockets.reduce((sum, pocket) => sum + pocket.balance, 0);
  const pendingCount = pendingGoalClaims.length + pendingWithdrawals.length;

  const canEditPocketStructure = (editingPocket?.balance ?? 0) === 0;

  const openEditPocket = (pocket: SavingsPocketWithBalance) => {
    setEditingPocket(pocket);
    setEditPocketType(pocket.pocket_type);
    setEditInterestPct(bpsToPercentInputValue(pocket.monthly_interest_bps));
    setEditPocketEmoji(pocket.emoji || DEFAULT_SAVINGS_POCKET_EMOJI);
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
    startTransition(async () => {
      const res = await updateSavingsPocketAction(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kantong tabungan diperbarui.");
        setEditingPocket(null);
        router.refresh();
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
    startTransition(async () => {
      const res = await createSavingsPocketAction(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kantong tabungan dibuat.");
        setCreatePocketOpen(false);
        setPocketType("flexible");
        setCreateInterestPct("");
        setCreatePocketEmoji(DEFAULT_SAVINGS_POCKET_EMOJI);
        router.refresh();
      }
    });
  };

  const handleApproveWithdraw = (txId: string) => {
    startTransition(async () => {
      const res = await approveSavingsWithdrawAction(txId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penarikan disetujui.");
        router.refresh();
      }
    });
  };

  const handleRejectWithdraw = () => {
    if (!rejectWithdrawId) return;
    startTransition(async () => {
      const res = await rejectSavingsWithdrawAction(rejectWithdrawId, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penarikan ditolak.");
        setRejectWithdrawId(null);
        setRejectReason("");
        router.refresh();
      }
    });
  };

  const handleApproveClaim = (requestId: string) => {
    startTransition(async () => {
      const res = await approveGoalClaimAction(requestId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Hadiah disetujui untuk dicairkan.");
        router.refresh();
      }
    });
  };

  const handleRejectClaim = () => {
    if (!rejectClaimId) return;
    startTransition(async () => {
      const res = await rejectGoalClaimAction(rejectClaimId, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Permintaan hadiah ditolak.");
        setRejectClaimId(null);
        setRejectReason("");
        router.refresh();
      }
    });
  };

  if (!savingsEnabled) {
    return (
      <Card className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
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
    );
  }

  if (children.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Tambahkan profil anak terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-20">
      {pendingCount > 0 ? (
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
            {pendingGoalClaims.map((claim) => (
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
                  disabled={isPending}
                  onApprove={() => handleApproveClaim(claim.id)}
                  onReject={() => setRejectClaimId(claim.id)}
                />
              </div>
            ))}

            {pendingWithdrawals.map((withdrawal) => (
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
                  disabled={isPending}
                  onApprove={() => handleApproveWithdraw(withdrawal.id)}
                  onReject={() => setRejectWithdrawId(withdrawal.id)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ChildTabSelector
        profiles={children}
        activeChildId={activeChildId}
        onActiveChildIdChange={setActiveChildId}
      />

      {activeChild ? (
        <section
          className="grid grid-cols-3 gap-2"
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
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-bold text-muted-foreground">Kantong tabungan</h2>
          {activeChild ? (
            <p className="text-[10px] text-muted-foreground">
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
              />
            ))}
          </div>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.5rem)] z-50">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-center gap-2 px-4">
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
                    : "Kantong sudah berisi saldo — hanya nama, emoji, target, dan default yang bisa diubah."}
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
                      disabled={!canEditPocketStructure}
                      className="h-10 tabular-nums disabled:opacity-50"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Min. 0% · maks. {MONTHLY_INTEREST_ABS_MAX_BPS / 100}% · 2 desimal
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
                        required={canEditPocketStructure}
                        disabled={!canEditPocketStructure}
                        className="h-10 disabled:opacity-50"
                      />
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
                      disabled={!canEditPocketStructure}
                      className="h-10 disabled:opacity-50"
                    />
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
                <DialogFooter>
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
    </div>
  );
}
