/** Palet indeks 0–3 (sesuai kolom `home_card_accent` di DB). */
export const HOME_CARD_ACCENT_PALETTE = [
  "#8B5CF6", // ungu
  "#10B981", // hijau
  "#F59E0B", // amber
  "#F43F5E", // rose
] as const;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

type AccentInput = string | number | null | undefined;

function autoAccentFromGender(gender?: string | null): string {
  if (gender === "female") return HOME_CARD_ACCENT_PALETTE[2];
  if (gender === "male") return HOME_CARD_ACCENT_PALETTE[1];
  return HOME_CARD_ACCENT_PALETTE[0];
}

/** Ubah nilai DB (indeks 0–3, hex, atau null) menjadi warna hex yang valid untuk CSS. */
export function resolveHomeCardAccent(
  raw: AccentInput,
  options?: { gender?: string | null; fallback?: string },
): string {
  const fallback = options?.fallback ?? HOME_CARD_ACCENT_PALETTE[1];

  if (raw === null || raw === undefined || raw === "") {
    return autoAccentFromGender(options?.gender) ?? fallback;
  }

  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim()))) {
    const index = Number(raw);
    if (index >= 0 && index < HOME_CARD_ACCENT_PALETTE.length) {
      return HOME_CARD_ACCENT_PALETTE[index];
    }
    return fallback;
  }

  if (typeof raw === "string" && HEX_COLOR_RE.test(raw.trim())) {
    return raw.trim();
  }

  return fallback;
}

/** Gradien hero beranda anak — hanya memakai hex yang sudah divalidasi. */
export function buildChildHeroGradient(accent: string): string {
  return `linear-gradient(135deg, ${accent} 0%, #0ea5e9 52%, #7c3aed 100%)`;
}
