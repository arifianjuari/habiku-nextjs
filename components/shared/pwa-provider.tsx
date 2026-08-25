"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { syncChildModeCookieFromStore } from "@/lib/stores/child-mode-store";

const PwaInstallPrompt = dynamic(
  () =>
    import("@/components/shared/pwa-install-prompt").then((m) => m.PwaInstallPrompt),
  { ssr: false },
);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let removeFocusListener: (() => void) | undefined;
    let removeVisibilityListener: (() => void) | undefined;

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
                void import("sonner").then(({ toast }) => {
                  toast.info("Versi baru Habiku tersedia.", {
                    duration: 8000,
                    action: {
                      label: "Muat ulang",
                      onClick: () => {
                        syncChildModeCookieFromStore();
                        void navigator.serviceWorker.getRegistration().then((reg) => {
                          reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
                          window.location.reload();
                        });
                      },
                    },
                  });
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

    const scheduleRegister = () => {
      const schedule =
        typeof requestIdleCallback === "function"
          ? requestIdleCallback
          : (cb: () => void) => window.setTimeout(cb, 1500);

      schedule(handleRegister);
    };

    const syncBeforeHide = () => {
      syncChildModeCookieFromStore();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") syncBeforeHide();
    };

    window.addEventListener("pagehide", syncBeforeHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    removeVisibilityListener = () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);

    if (document.readyState === "complete") {
      scheduleRegister();
    } else {
      window.addEventListener("load", scheduleRegister);
    }

    return () => {
      window.removeEventListener("pagehide", syncBeforeHide);
      window.removeEventListener("load", scheduleRegister);
      removeFocusListener?.();
      removeVisibilityListener?.();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let disposed = false;
    let removeListeners: (() => void) | undefined;

    void import("sonner").then(({ toast }) => {
      if (disposed) return;

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

      removeListeners = () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    });

    return () => {
      disposed = true;
      removeListeners?.();
    };
  }, []);

  return (
    <>
      {children}
      <PwaInstallPrompt />
    </>
  );
}
