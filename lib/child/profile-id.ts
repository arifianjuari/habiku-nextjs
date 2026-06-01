const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidChildProfileId(profileId: string | null | undefined): profileId is string {
  return typeof profileId === "string" && UUID_REGEX.test(profileId);
}
