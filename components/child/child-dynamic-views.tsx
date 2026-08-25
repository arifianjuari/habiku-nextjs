import dynamic from "next/dynamic";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

function ChildViewLoading() {
  return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
}

export const DynamicChildHomeView = dynamic(
  () => import("./child-home-view").then((m) => m.ChildHomeView),
  { loading: ChildViewLoading },
);

export const DynamicChildMissionsView = dynamic(
  () => import("./child-missions-view").then((m) => m.ChildMissionsView),
  { loading: ChildViewLoading },
);

export const DynamicChildSavingsView = dynamic(
  () => import("./child-savings-view").then((m) => m.ChildSavingsView),
  { loading: ChildViewLoading },
);

export const DynamicChildTargetsView = dynamic(
  () => import("./child-targets-view").then((m) => m.ChildTargetsView),
  { loading: ChildViewLoading },
);

export const DynamicChildBadgeShelf = dynamic(
  () => import("./child-badge-shelf").then((m) => m.ChildBadgeShelf),
  { loading: ChildViewLoading },
);

export const DynamicChildReflectionView = dynamic(
  () => import("./child-reflection-view").then((m) => m.ChildReflectionView),
  { loading: ChildViewLoading },
);

export const DynamicChildMissionCompleteView = dynamic(
  () => import("./child-mission-complete-view").then((m) => m.ChildMissionCompleteView),
  { loading: ChildViewLoading },
);
