"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Bell, BellOff, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { savePushSubscriptionAction } from "@/app/parent/settings/engagement/actions";

// Helper helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Generate a default mock client-side VAPID public key if env is not defined
// (User can configure it in env under process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)
const DEFAULT_VAPID_PUBLIC_KEY = "BIlG2wA1uC0J4w_q5oWJpM6zK9Fk8m0B1y5U2o3a4t5e6r7i8o9n1m2a3r4s5e6t7i8o9n1m2a3r4s5e6t7i8o";

export function WebPushSubscriber() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const handleSubscribe = () => {
    if (!isSupported) {
      toast.error("Browser Anda tidak mendukung notifikasi push.");
      return;
    }

    startTransition(async () => {
      try {
        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);

        if (permissionResult !== "granted") {
          toast.error("Izin notifikasi ditolak.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        // Load VAPID public key from env or default mock
        const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        // The endpoint URL represents the unique registration token in Web Push
        const token = JSON.stringify(subscription);
        const res = await savePushSubscriptionAction(token);

        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("Notifikasi Web Push berhasil diaktifkan! 🔔");
        }
      } catch (err) {
        console.error("Web push subscription error:", err);
        toast.error("Gagal mengaktifkan notifikasi push browser.");
      }
    });
  };

  if (!isSupported) {
    return (
      <Card className="border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Browser ini tidak mendukung notifikasi Web Push. Silakan gunakan Chrome, Edge, atau Safari versi terbaru.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border rounded-2xl overflow-hidden ${
      permission === "granted" ? "border-emerald-100 bg-emerald-50/10" : "border-violet-100 bg-violet-50/10"
    }`}>
      <CardContent className="p-4 space-y-3.5">
        <div className="flex gap-3 items-start">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner ${
            permission === "granted" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"
          }`}>
            {permission === "granted" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900 leading-none">
              {permission === "granted" ? "Notifikasi PWA Aktif" : "Aktifkan Notifikasi Web"}
            </h4>
            <p className="text-[9px] text-slate-550 leading-relaxed font-semibold">
              {permission === "granted"
                ? "Browser Anda siap menerima pemberitahuan instan tentang pengerjaan misi anak."
                : "Dapatkan pemberitahuan langsung di layar saat anak menyerahkan misi harian mereka."}
            </p>
          </div>
        </div>

        {permission !== "granted" ? (
          <Button
            onClick={handleSubscribe}
            disabled={isPending}
            className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold h-9 rounded-xl text-xs cursor-pointer"
          >
            {isPending ? "Mengaktifkan..." : "Izinkan Notifikasi 🔔"}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/30 p-2 text-[10px] text-emerald-800 font-extrabold text-center">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Terhubung dengan sukses ke PWA Push Server!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
