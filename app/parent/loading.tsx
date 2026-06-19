import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

/** Skeleton ringan agar transisi tab ortu terasa responsif. */
export default function ParentLoading() {
  return <PageLoadingSkeleton variant="parent" className="min-h-[40vh]" />;
}
