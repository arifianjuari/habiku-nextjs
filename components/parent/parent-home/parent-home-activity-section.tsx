import { getFamilyRecentActivities } from "@/lib/parent/parent-home-data";
import { ParentActivityFeed } from "@/components/parent/parent-activity-feed";

type ParentHomeActivitySectionProps = {
  familyId: string;
};

export async function ParentHomeActivitySection({ familyId }: ParentHomeActivitySectionProps) {
  const recentActivities = await getFamilyRecentActivities(familyId);

  return <ParentActivityFeed activities={recentActivities} />;
}
