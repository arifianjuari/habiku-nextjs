# Pola Kode Performa Habiku

## Parent tab — auth-only page + client fetch

```tsx
// app/parent/tasks/page.tsx
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentTasksPageClient } from "@/components/parent/parent-tasks-page-client";

export default async function ParentTasksPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentTasksPageClient familyId={context.family.id} />;
}
```

```tsx
// components/parent/parent-tasks-page-client.tsx
"use client";

export function ParentTasksPageClient({ familyId }: { familyId: string }) {
  const { data, isLoading } = useParentTasksData(familyId);
  if (isLoading && !data) return <PageLoadingSkeleton variant="parent" />;
  return <DynamicTasksClientView {...data} />;
}
```

## Shared fetch + hook + prefetch

```typescript
// lib/parent/fetch-parent-tab-page-data.ts — server & client safe fetchers
export async function fetchParentTasksPageData(familyId: string) { ... }

// lib/hooks/use-parent-tasks-data.ts
export function parentTasksPageQueryKey(familyId: string) {
  return [...parentQueryKeys.tasks(familyId), "page"] as const;
}

// lib/parent/prefetch-parent-queries.ts
queryClient.prefetchQuery({
  queryKey: parentTasksPageQueryKey(familyId),
  queryFn: () => fetchParentTasksPageData(familyId),
});
```

## Dynamic import view berat

```tsx
// components/parent/parent-dynamic-views.tsx
export const DynamicTasksClientView = dynamic(
  () => import("./tasks-client-view").then((m) => m.TasksClientView),
  { loading: () => <PageLoadingSkeleton variant="parent" /> },
);
```

## Optimistic submit + rollback (bukan refresh)

```tsx
const previous = items;
setItems((prev) => prev.filter((i) => i.id !== itemId));

startTransition(async () => {
  const res = await approveTaskHistoryAction(itemId, goalId);
  if (res?.error) {
    toast.error(res.error);
    setItems(previous); // rollback — JANGAN router.refresh()
  }
});
```

## Child home — SSR seed + client cache

```tsx
// app/child/home/page.tsx — optional SSR initialData
const profileId = await getServerChildProfileId();
const initialData = profileId
  ? await fetchChildHomeData(profileId, await createClient())
  : undefined;
return <ChildHomeView initialData={initialData} />;
```

## next.config.ts — router cache client

```typescript
experimental: {
  optimizePackageImports: ["lucide-react", "framer-motion"],
  staleTimes: { dynamic: 60, static: 300 },
},
```

## Konstanta stale time

```typescript
// lib/query/constants.ts
export const PARENT_STALE_MS = 60_000;
export const CHILD_STALE_MS = 60_000;
```

Jangan ubah tanpa mempertimbangkan UX stale data vs responsivitas.
