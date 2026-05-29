"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { toast } from "sonner";

export function ChildModeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isActive = useChildModeStore((s) => s.isActive);
  const profileId = useChildModeStore((s) => s.profileId);
  const exit = useChildModeStore((s) => s.exit);

  useEffect(() => {
    if (!isActive) {
      router.replace("/parent/profil-anak");
      return;
    }

    // Guard UUID global di level layout untuk membersihkan sesi demo/stale lama
    if (profileId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(profileId)) {
        console.warn("⚠️ Invalid child profileId UUID in Guard, exiting...", profileId);
        // Hapus cookie
        document.cookie = "habiku_child_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        // Clear store
        exit();
        toast.error("Sesi anak tidak valid. Silakan masuk kembali dari dasbor orang tua.");
        router.replace("/parent/profil-anak");
      }
    }
  }, [isActive, profileId, exit, router]);

  const isValidUuid = profileId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId) : false;

  if (!isActive || !isValidUuid) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-center text-slate-500 font-semibold">
        Memuat mode anak…
      </div>
    );
  }

  return <>{children}</>;
}
