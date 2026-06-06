export const childQueryKeys = {
  all: ["child"] as const,
  home: (profileId: string) => [...childQueryKeys.all, "home", "v2", profileId] as const,
  missions: (profileId: string) => [...childQueryKeys.all, "missions", profileId] as const,
  targets: (profileId: string) => [...childQueryKeys.all, "targets", profileId] as const,
  points: (profileId: string) => [...childQueryKeys.all, "points", profileId] as const,
};
