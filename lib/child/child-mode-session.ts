/** Cookie hint untuk middleware — otoritas penuh tetap di Zustand + PIN RPC. */
export const CHILD_MODE_COOKIE = "habiku_child_mode";

/** UUID profil anak aktif — untuk prefetch RSC + React Query dehydrate. */
export const CHILD_PROFILE_COOKIE = "habiku_child_profile";

export const CHILD_MODE_HOME = "/child/home";
export const PARENT_HOME = "/parent";

export function isChildModeCookieValue(value: string | undefined | null): boolean {
  return value === "1";
}

/** Destinasi default setelah auth / root redirect, hormati sesi mode anak aktif. */
export function getAuthenticatedHomePath(childModeCookieActive: boolean): string {
  return childModeCookieActive ? CHILD_MODE_HOME : PARENT_HOME;
}
