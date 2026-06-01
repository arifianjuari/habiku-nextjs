/** Tanggal hari ini zona Asia/Jakarta (YYYY-MM-DD) untuk filter misi/check-in. */
export function getJakartaTodayString(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  )
    .toISOString()
    .split("T")[0];
}
