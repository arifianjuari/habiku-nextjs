import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ChildHomeView } from "@/components/child/child-home-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";
import { fetchChildHomeData } from "@/lib/child/fetch-child-data";
import { getServerChildProfileId } from "@/lib/child/get-server-child-profile-id";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

export const metadata: Metadata = {
  title: "Beranda anak",
};

export default function ChildHomePage() {
  return (
    <ChildPagePrefetch tab="home">
      <Suspense fallback={<PageLoadingSkeleton variant="child" className="min-h-[50vh]" />}>
        <ChildHomePageContent />
      </Suspense>
    </ChildPagePrefetch>
  );
}

async function ChildHomePageContent() {
  const profileId = await getServerChildProfileId();
  if (!profileId) {
    return <ChildHomeView />;
  }

  const supabase = await createClient();
  const initialData = await fetchChildHomeData(profileId, supabase);

  return <ChildHomeView initialData={initialData} />;
}
