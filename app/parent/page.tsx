import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { ChildCard } from "@/components/parent/child-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HabikuLogo } from "@/components/shared/habiku-logo";
import {
  Zap,
  Users,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ChevronRight,
  History,
  AlertTriangle,
  UserPlus,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard Orang Tua — Habiku",
  robots: { index: false },
};

export default async function ParentHomePage() {
  const context = await getSessionContext();
  
  if (!context) {
    redirect("/login");
  }

  const { account, family } = context;
  const supabase = await createClient();

  // Fetch all child profiles
  const { data: childrenRaw, error: childrenError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", family.id)
    .order("created_at", { ascending: true });

  const children = childrenRaw || [];

  // Fetch active goals & sum point ledger for each child
  const childrenWithData = await Promise.all(
    children.map(async (child) => {
      // Fetch active goal
      const { data: activeGoal } = await supabase
        .from("goals")
        .select("*")
        .eq("profile_id", child.id)
        .eq("status", "active")
        .maybeSingle();

      // Fetch sum of points from point_ledger
      const { data: ledger } = await supabase
        .from("point_ledger")
        .select("amount")
        .eq("profile_id", child.id);
      
      const points = ledger?.reduce((sum, entry) => sum + entry.amount, 0) || 0;

      return {
        child,
        activeGoal: activeGoal || null,
        points,
      };
    })
  );

  const childIds = children.map((c) => c.id);
  
  // Fetch pending review count
  let pendingCount = 0;
  if (childIds.length > 0) {
    const { count } = await supabase
      .from("task_history")
      .select("*", { count: "exact", head: true })
      .in("profile_id", childIds)
      .eq("status", "pending");
    pendingCount = count || 0;
  }

  // Fetch recent activities
  let recentActivities: any[] = [];
  if (childIds.length > 0) {
    const { data } = await supabase
      .from("task_history")
      .select(`
        id,
        status,
        completed_at,
        notes,
        task_id,
        tasks (title, reward_points, category),
        profile_id,
        child_profiles (name)
      `)
      .in("profile_id", childIds)
      .order("completed_at", { ascending: false })
      .limit(4);
    
    recentActivities = data || [];
  }

  // Calculate Family Total Energy
  const familyEnergy = childrenWithData.reduce((sum, item) => sum + item.points, 0);

  return (
    <div className="space-y-6">
      {/* Header Ortu */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="font-heading text-2xl font-black text-slate-900 tracking-tight">
            Halo, {account.display_name || "Orang Tua"}! 👋
          </h1>
          <p className="text-xs text-muted-foreground">
            Pantau dan kelola karakter buah hati Anda hari ini.
          </p>
        </div>
        <HabikuLogo className="h-6 w-auto" />
      </div>

      {/* Hero Family Energy Card */}
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-800 to-emerald-950 text-white shadow-xl shadow-emerald-950/20 rounded-3xl">
        {/* Subtle Decorative Circle */}
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-700/20 blur-xl" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200/80 flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {family.name || "Keluarga Kami"}
            </span>
            <Badge className="bg-emerald-700/60 hover:bg-emerald-700/60 text-emerald-100 border-none font-bold">
              Parent Mode
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-5xl font-black tracking-tight">{familyEnergy}</span>
            <span className="text-sm font-semibold text-emerald-200">Total Energi Keluarga (E)</span>
          </div>
          <p className="text-xs text-emerald-100/70 text-pretty">
            Akumulasi energi dari seluruh anak yang dapat dialokasikan untuk menebus target hadiah aktif.
          </p>
        </CardContent>
      </Card>

      {/* Pending Approval Notification Banner */}
      {pendingCount > 0 && (
        <Link href="/parent/queue" className="block">
          <Card className="border border-amber-200 bg-amber-50/70 backdrop-blur-sm hover:bg-amber-50 transition-all rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">Misi Menunggu Persetujuan!</h4>
                  <p className="text-xs text-amber-900/80">
                    Ada <span className="font-bold">{pendingCount} misi baru</span> anak yang memerlukan review Anda.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-700" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Child Profiles Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-extrabold text-slate-900">Buah Hati Anda</h2>
          <Link
            href="/parent/profil-anak"
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
          >
            <PlusCircle className="h-4 w-4" />
            Tambah Profil
          </Link>
        </div>

        {childrenWithData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {childrenWithData.map((item) => (
              <ChildCard
                key={item.child.id}
                child={item.child}
                activeGoal={item.activeGoal}
                points={item.points}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <UserPlus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Belum Ada Profil Anak</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Tambahkan profil anak pertama Anda untuk mulai menugaskan misi harian dan target hadiah.
                </p>
              </div>
              <Link
                href="/parent/profil-anak"
                className={cn(buttonVariants({ size: "sm" }), "bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl")}
              >
                Buat Profil Anak
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity Timeline */}
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <History className="h-5 w-5 text-slate-500" />
          Aktivitas Terkini
        </h2>

        <Card className="border border-slate-100 bg-white/70 backdrop-blur-md rounded-3xl p-5 shadow-sm">
          <CardContent className="p-0">
            {recentActivities.length > 0 ? (
              <div className="relative border-l border-slate-200 pl-4 space-y-6">
                {recentActivities.map((act) => {
                  const task = act.tasks as any;
                  const child = act.child_profiles as any;
                  const isApproved = act.status === "approved";
                  const isRejected = act.status === "rejected";
                  const isPendingReview = act.status === "pending";

                  return (
                    <div key={act.id} className="relative">
                      {/* Timeline Dot Icon */}
                      <span className="absolute -left-[25px] flex h-5 w-5 items-center justify-center rounded-full bg-white border shadow-sm">
                        {isApproved ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 fill-emerald-50" />
                        ) : isRejected ? (
                          <AlertCircle className="h-3 w-3 text-red-600 fill-red-50" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-500 fill-amber-50" />
                        )}
                      </span>

                      {/* Content details */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800">
                            {child?.name || "Anak"} menyelesaikan{" "}
                            <span className="text-slate-950 font-black">"{task?.title || "Misi"}"</span>
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(act.completed_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {act.notes || "Tanpa catatan tambahan"}
                          </p>
                          <Badge
                            className={cn(
                              "text-[9px] px-1.5 py-0.2 border-none font-extrabold rounded-full",
                              isApproved
                                ? "bg-emerald-50 text-emerald-700"
                                : isRejected
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            {isApproved ? `+${task?.reward_points || 0} E` : isRejected ? "Ditolak" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <Sparkles className="h-6 w-6 text-slate-300 animate-pulse" />
                <p className="text-xs font-semibold text-slate-500">Belum ada riwayat aktivitas</p>
                <p className="text-[10px] text-muted-foreground max-w-xs">
                  Semua bukti tugas yang diselesaikan anak akan muncul dalam lini masa realtime ini.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
