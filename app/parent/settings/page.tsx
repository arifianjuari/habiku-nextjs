import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { InviteCreator } from "@/components/parent/invite-creator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  Compass,
  ChevronRight,
  Shield,
  LogOut,
  PiggyBank,
  BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Pengaturan Orang Tua — Habiku",
  robots: { index: false },
};

export default async function ParentSettingsPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { account, family } = context;
  const isPrimary = account.role === "primary_parent";

  return (
    <div className="space-y-4">
      {/* 1. Header Pengaturan */}
      <div className="mb-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Pengaturan Ortu
        </h2>
        <p className="text-xs text-muted-foreground">
          Kelola profil akun, anggota keluarga, dan preferensi aplikasi.
        </p>
      </div>

      {/* 2. Ringkasan Profil & Keluarga */}
      <Card className="border border-slate-150 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Ortu Profile */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-inner">
              <User className="h-5.5 w-5.5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-slate-900 leading-none">
                {account.display_name || "Orang Tua Habiku"}
              </h4>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Shield className="h-3 w-3 text-slate-400" />
                {isPrimary ? "Orang Tua Utama (Kepala Keluarga)" : "Orang Tua Kedua"}
              </p>
            </div>
          </div>

          {/* Keluarga Info */}
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 shadow-inner">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block leading-none">Grup Keluarga</span>
                <span className="font-semibold text-xs text-slate-800">{family.name}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Undang Pasangan / Ortu Kedua (InviteCreator) */}
      <InviteCreator isPrimary={isPrimary} />

      {/* 4. Dompet & tabungan */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
          Dompet & energi
        </h3>

        <Link
          href="/parent/savings"
          className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl shadow-sm transition-all text-left w-full cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <PiggyBank className="h-4.5 w-4.5" aria-hidden />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block leading-none mb-1">
                Tabungan digital
              </span>
              <span className="text-[10px] text-slate-500">
                Kantong tabungan per anak dan persetujuan penarikan.
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/parent/ledger"
          className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl shadow-sm transition-all text-left w-full cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <BookOpen className="h-4.5 w-4.5" aria-hidden />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block leading-none mb-1">
                Buku besar poin
              </span>
              <span className="text-[10px] text-slate-500">
                Riwayat earn, spend, tabungan, dan penyesuaian energi.
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 5. Engagement */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
          Aplikasi & gamifikasi
        </h3>

        <Link
          href="/parent/settings/engagement"
          className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl shadow-sm transition-all text-left w-full cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Compass className="h-4.5 w-4.5 animate-spin-slow" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block leading-none mb-1">
                Fitur Engagement Keluarga
              </span>
              <span className="text-[10px] text-slate-500">
                Atur pengingat harian, garden bonus, dan tip parenting.
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 6. Logout Button */}
      <div className="pt-2">
        <form action="/auth/sign-out" method="POST" className="w-full">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-100 hover:bg-red-50 text-red-600 text-xs font-bold h-11 transition-colors cursor-pointer shadow-sm bg-white"
          >
            <LogOut className="h-4 w-4" />
            Keluar dari Akun
          </button>
        </form>
      </div>
    </div>
  );
}
