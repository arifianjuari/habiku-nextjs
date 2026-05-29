"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "habiku-pwa-install-dismissed";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [showManualHint, setShowManualHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandaloneDisplay()) return;

    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);

    let canInstall = false;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      canInstall = true;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!wasDismissed) setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSecure =
      window.isSecureContext ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";

    const manualTimer =
      isMobile && isSecure && !wasDismissed
        ? window.setTimeout(() => {
            if (!canInstall) setShowManualHint(true);
          }, 5000)
        : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (manualTimer) window.clearTimeout(manualTimer);
    };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setShowManualHint(false);
    setDeferredPrompt(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    handleDismiss();
  };

  if (dismissed) return null;

  if (deferredPrompt) {
    return (
      <div
        role="region"
        aria-label="Pasang aplikasi Habiku"
        className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-4 shadow-lg sm:bottom-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Download className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">Pasang Habiku di HP</p>
            <p className="mt-0.5 text-sm text-slate-600">
              Akses lebih cepat dari layar utama, seperti aplikasi biasa.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={handleInstall}>
                Pasang aplikasi
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleDismiss}>
                Nanti
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!showManualHint) return null;

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div
      role="region"
      aria-label="Cara menambahkan ke layar utama"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg sm:bottom-6"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Belum muncul &quot;Install app&quot;?</p>
          {isIos ? (
            <p className="mt-1">
              Di Safari: tombol <strong>Share</strong> → <strong>Add to Home Screen</strong>.
              Chrome di iPhone tidak menampilkan install PWA penuh.
            </p>
          ) : (
            <p className="mt-1">
              Pastikan situs dibuka lewat <strong>HTTPS</strong> (bukan IP LAN http).
              Di Chrome: menu ⋮ → <strong>Install app</strong> atau{" "}
              <strong>Tambahkan ke layar utama</strong>.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
