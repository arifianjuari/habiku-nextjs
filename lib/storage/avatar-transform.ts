/** Thumbnail transform untuk avatar anak — dipakai ChildAvatar + prefetch. */
export const CHILD_AVATAR_TRANSFORM = {
  width: 128,
  height: 128,
  resize: "cover" as const,
};

export function childAvatarSignedCacheKey(storagePath: string, bucket: string): string {
  return `${bucket}:${storagePath}:thumb`;
}
