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

function hexToRgbComponents(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace(/^#/, "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/** rgb() untuk inline style — menghindari # yang rusak saat diserialisasi ke atribut HTML. */
export function hexToRgbString(hex: string): string {
  const { r, g, b } = hexToRgbComponents(hex);
  return `rgb(${r} ${g} ${b})`;
}

/** Gradien hero beranda anak — hanya memakai hex yang sudah divalidasi. */
export function buildChildHeroGradient(accent: string): string {
  const rgb = hexToRgbString(accent);
  return `linear-gradient(135deg, ${rgb} 0%, rgb(14 165 233) 52%, rgb(124 58 237) 100%)`;
}

/** Wash header kartu profil anak di dashboard orang tua. */
export function buildParentChildCardHeaderWash(accent: string): string {
  const rgb = hexToRgbString(accent);
  return `linear-gradient(160deg, color-mix(in srgb, ${rgb} 22%, transparent) 0%, transparent 72%)`;
}

/** Gradien progress target pada kartu anak. */
export function buildParentChildCardProgressGradient(accent: string): string {
  const rgb = hexToRgbString(accent);
  return `linear-gradient(90deg, ${rgb}, color-mix(in srgb, ${rgb} 65%, rgb(244 114 182)))`;
}
