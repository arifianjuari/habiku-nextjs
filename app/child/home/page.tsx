import { Suspense } from "react";
import type { Metadata } from "next";
import { DynamicChildHomeView } from "@/components/child/child-dynamic-views";
import { fetchChildHomeData } from "@/lib/child/fetch-child-data";
import { getServerChildProfileId } from "@/lib/child/get-server-child-profile-id";
import { createClient } from "@/lib/supabase/server";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

export const metadata: Metadata = {
  title: "Beranda anak",
};

export default function ChildHomePage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="child" className="min-h-[50vh]" />}>
      <ChildHomePageContent />
    </Suspense>
  );
}

async function ChildHomePageContent() {
  const profileId = await getServerChildProfileId();
  if (!profileId) {
    return <DynamicChildHomeView />;
  }

  const supabase = await createClient();
  const initialData = await fetchChildHomeData(profileId, supabase);

  return <DynamicChildHomeView initialData={initialData} />;
}
