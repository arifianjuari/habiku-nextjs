"use client";

import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SupabaseAuthListener } from "@/components/providers/supabase-auth-listener";
import { makeQueryClient } from "@/lib/providers/query-client";

const Toaster = dynamic(
  () => import("@/components/ui/sonner").then((m) => m.Toaster),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthListener />
      {children}
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
