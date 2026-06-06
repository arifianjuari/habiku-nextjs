import { STORAGE_BUCKETS } from "@/lib/database/enums";

export const CHILD_AVATAR_FILE = "avatar.webp";

export function childAvatarStoragePath(profileId: string): string {
  return `${profileId}/${CHILD_AVATAR_FILE}`;
}

export function isChildAvatarStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("data:");
}

export { STORAGE_BUCKETS };
