"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Pendaftaran Service Worker secara native & kompatibel Next 16/React 19
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const handleRegister = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker terdaftar dengan scope:", registration.scope);
          })
          .catch((error) => {
            console.error("[PWA] Pendaftaran Service Worker gagal:", error);
          });
      };

      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  useEffect(() => {
    // 2. Monitoring koneksi daring/luring instan untuk pengalaman pengguna premium
    if (typeof window !== "undefined") {
      const handleOnline = () => {
        toast.success("Koneksi kembali! Aplikasi terhubung secara daring. ⚡", {
          duration: 4000,
        });
      };

      const handleOffline = () => {
        toast.error("Koneksi terputus. Habiku berjalan dalam mode luring (offline). 🔌", {
          duration: 6000,
          dismissible: false,
        });
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  return (
    <>
      {children}
      <PwaInstallPrompt />
    </>
  );
}
