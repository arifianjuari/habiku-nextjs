export const parentQueryKeys = {
  all: ["parent"] as const,
  tasks: (familyId: string) => [...parentQueryKeys.all, "tasks", familyId] as const,
  savings: (familyId: string) => [...parentQueryKeys.all, "savings", familyId] as const,
  targets: (familyId: string) => [...parentQueryKeys.all, "targets", familyId] as const,
  queue: (familyId: string) => [...parentQueryKeys.all, "queue", familyId] as const,
  profiles: (familyId: string) => [...parentQueryKeys.all, "profiles", familyId] as const,
  ledger: (familyId: string) => [...parentQueryKeys.all, "ledger", familyId] as const,
  incidental: (familyId: string) => [...parentQueryKeys.all, "incidental", familyId] as const,
};
