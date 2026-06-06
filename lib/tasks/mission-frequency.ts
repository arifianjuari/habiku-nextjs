import type { FrequencyType } from "@/lib/database/enums";

/** Frekuensi yang bisa dipilih ortu di form (custom disembunyikan sampai jadwal hari didukung). */
export type ParentFrequencyType = "daily" | "weekly";

export const PARENT_FREQUENCY_OPTIONS: {
  value: ParentFrequencyType;
  label: string;
}[] = [
  { value: "daily", label: "Setiap Hari" },
  { value: "weekly", label: "Setiap Minggu" },
];

/** Normalisasi nilai DB ke pilihan form ortu (`custom` diperlakukan seperti harian). */
export function normalizeFrequencyForParentForm(
  frequencyType: FrequencyType | string,
): ParentFrequencyType {
  return frequencyType === "weekly" ? "weekly" : "daily";
}

/** Label tampilan frekuensi di daftar misi. */
export function getFrequencyDisplayLabel(frequencyType: FrequencyType | string): string {
  if (frequencyType === "weekly") return "Setiap Minggu";
  return "Setiap Hari";
}

/** Label satuan periode untuk UI (sesuai `frequency_type`). */
export const FREQUENCY_PERIOD_UNIT: Record<FrequencyType, string> = {
  daily: "hari",
  weekly: "minggu",
  custom: "periode",
};

export function getFrequencyPeriodUnit(frequencyType: FrequencyType | string): string {
  if (frequencyType in FREQUENCY_PERIOD_UNIT) {
    return FREQUENCY_PERIOD_UNIT[frequencyType as FrequencyType];
  }
  return "periode";
}

/** Contoh: "Maksimal: 2x / hari" */
export function formatMaxSubmissionsLabel(
  maxSubmissions: number,
  frequencyType: FrequencyType | string,
): string {
  const unit = getFrequencyPeriodUnit(frequencyType);
  return `Maksimal: ${maxSubmissions}x / ${unit}`;
}

/** Label field form ortu — contoh: "Maksimal per hari" */
export function formatMaxSubmissionsFieldLabel(
  frequencyType: FrequencyType | string,
): string {
  return `Maksimal per ${getFrequencyPeriodUnit(frequencyType)}`;
}

export function parseMaxSubmissionsPerPeriod(raw: FormDataEntryValue | null): number | null {
  const value = Math.floor(Number(raw ?? "1"));
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return Math.min(value, 20);
}
