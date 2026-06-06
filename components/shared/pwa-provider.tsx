"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt";
import { syncChildModeCookieFromStore } from "@/lib/stores/child-mode-store";

const SW_RELOAD_FLAG = "habiku-sw-reload-pending";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const preserveSessionAndReload = () => {
      if (sessionStorage.getItem(SW_RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(SW_RELOAD_FLAG, "1");
      syncChildModeCookieFromStore();
      window.location.reload();
    };

    const onControllerChange = () => {
      preserveSessionAndReload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let removeFocusListener: (() => void) | undefined;

    const handleRegister = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker terdaftar dengan scope:", registration.scope);

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;

            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                toast.info("Pembaruan Habiku tersedia. Memuat versi terbaru…", {
                  duration: 3000,
                });
              }
            });
          });

          const checkForUpdates = () => {
            void registration.update().catch(() => {
              /* offline / update check gagal — abaikan */
            });
          };

          window.addEventListener("focus", checkForUpdates);
          removeFocusListener = () => window.removeEventListener("focus", checkForUpdates);
        })
        .catch((error) => {
          console.error("[PWA] Pendaftaran Service Worker gagal:", error);
        });
    };

    sessionStorage.removeItem(SW_RELOAD_FLAG);

    const syncBeforeHide = () => {
      syncChildModeCookieFromStore();
    };
    window.addEventListener("pagehide", syncBeforeHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") syncBeforeHide();
    });

    if (document.readyState === "complete") {
      handleRegister();
    } else {
      window.addEventListener("load", handleRegister);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("pagehide", syncBeforeHide);
      window.removeEventListener("load", handleRegister);
      removeFocusListener?.();
    };
  }, []);

  useEffect(() => {
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
