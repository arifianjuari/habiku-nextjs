import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ChildMissionCompleteView } from "@/components/child/child-mission-complete-view";

interface ChildMissionCompletePageProps {
  params: Promise<{
    taskId: string;
  }>;
}

export const metadata: Metadata = {
  title: "Kerjakan Misi",
};

export default async function ChildMissionCompletePage({ params }: ChildMissionCompletePageProps) {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { taskId } = await params;

  return <ChildMissionCompleteView taskId={taskId} />;
}
