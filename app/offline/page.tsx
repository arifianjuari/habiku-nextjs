"use client";

import type { Metadata } from "next";
import { WifiOff, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OfflineFallbackPage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-background p-4 text-center">
      <Card className="max-w-md w-full border border-emerald-100 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-6 space-y-6 relative overflow-hidden">
        {/* Glowing background shine */}
        <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-emerald-400/10 blur-xl pointer-events-none" />
        
        <CardContent className="pt-6 space-y-6 flex flex-col items-center">
          {/* Playful Offline Icon Wrapper */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 border border-rose-100 text-rose-600 shadow-md">
              <WifiOff className="h-8 w-8 animate-pulse" />
            </div>
            {/* Sparkle badge */}
            <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 rounded-full p-1 shadow-sm border border-white">
              <Sparkles className="h-3 w-3 fill-amber-950" />
            </div>
          </div>

          {/* Texts */}
          <div className="space-y-2">
            <h1 className="font-heading text-lg font-black text-slate-900 tracking-tight leading-none">
              Ups, Koneksi Terputus! 🔌
            </h1>
            <p className="text-xs font-semibold text-slate-500 leading-relaxed max-w-[280px]">
              Habiku saat ini sedang berjalan luring (offline). Jangan khawatir, data misimu aman dan aplikasi tetap dapat diakses!
            </p>
          </div>

          {/* Friendly Guidance Card */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3.5 text-left flex gap-2.5 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-bold text-amber-900 leading-none">Tips Menghubungkan Kembali:</h4>
              <p className="text-[9px] text-amber-800 leading-relaxed font-semibold">
                Periksa Wi-Fi atau paket data seluler perangkatmu, lalu ketuk tombol di bawah untuk menyegarkan koneksi.
              </p>
            </div>
          </div>

          {/* Reload Action Button */}
          <Button
            onClick={handleReload}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11 rounded-2xl shadow-md shadow-emerald-700/10 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Hubungkan Lagi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
