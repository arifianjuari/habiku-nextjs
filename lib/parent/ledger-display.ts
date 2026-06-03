import type { LedgerType } from "@/lib/database/enums";

export type LedgerEntryRow = {
  id: string;
  profile_id: string;
  amount: number;
  type: LedgerType | string;
  created_at: string;
  task_history?: {
    notes: string | null;
    task?: {
      title: string;
      category: string;
    };
  } | null;
};

export type LedgerDisplayDetail = {
  title: string;
  desc: string;
  amountSign: "+" | "-";
  color: string;
  pointsColor: string;
};

export function getLedgerDisplayDetail(entry: LedgerEntryRow): LedgerDisplayDetail {
  if (entry.type === "earn") {
    const taskTitle = entry.task_history?.task?.title || "Misi Selesai";
    return {
      title: taskTitle,
      desc: "Misi disetujui orang tua",
      amountSign: "+",
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      pointsColor: "text-emerald-700",
    };
  }
  if (entry.type === "spend") {
    return {
      title: "Penebusan Hadiah",
      desc: "Poin energi dibelanjakan untuk target",
      amountSign: "-",
      color: "text-rose-600 bg-rose-50 border-rose-100",
      pointsColor: "text-rose-700",
    };
  }
  if (entry.type === "bonus_checkin") {
    return {
      title: "Bonus Check-in Harian",
      desc: "Kehadiran harian anak",
      amountSign: "+",
      color: "text-amber-600 bg-amber-50 border-amber-100",
      pointsColor: "text-amber-700",
    };
  }
  return {
    title: "Penyesuaian Manual Ortu",
    desc: "Penyesuaian saldo poin",
    amountSign: entry.amount >= 0 ? "+" : "-",
    color: "text-slate-600 bg-slate-50 border-slate-200",
    pointsColor: entry.amount >= 0 ? "text-slate-700" : "text-rose-700",
  };
}

export function formatLedgerDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  } catch {
    return "Tanggal tidak valid";
  }
}
