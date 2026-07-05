import dynamic from "next/dynamic";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

function ParentViewLoading() {
  return <PageLoadingSkeleton variant="parent" />;
}

export const DynamicTasksClientView = dynamic(
  () => import("./tasks-client-view").then((m) => m.TasksClientView),
  { loading: ParentViewLoading },
);

export const DynamicTargetsClientView = dynamic(
  () => import("./targets-client-view").then((m) => m.TargetsClientView),
  { loading: ParentViewLoading },
);

export const DynamicParentSavingsView = dynamic(
  () => import("./parent-savings-view").then((m) => m.ParentSavingsView),
  { loading: ParentViewLoading },
);

export const DynamicQueueClientView = dynamic(
  () => import("./queue-client-view").then((m) => m.QueueClientView),
  { loading: ParentViewLoading },
);

export const DynamicChildProfilesList = dynamic(
  () => import("./child-profiles-list").then((m) => m.ChildProfilesList),
  { loading: ParentViewLoading },
);
