"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/env";

export function SupabaseAuthListener() {
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Jangan refresh pada TOKEN_REFRESHED — setelah deploy/update cukup perbarui cookie
      // tanpa memicu navigasi ulang yang bisa mengganggu sesi mode anak.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
