import type { ChildProfile } from "@/types/database";

/** Hanya profil anak yang belum diarsipkan. */
export function isActiveChildProfile(
  child: Pick<ChildProfile, "archived_at">,
): boolean {
  return child.archived_at == null;
}
