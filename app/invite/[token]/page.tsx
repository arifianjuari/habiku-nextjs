import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteClientView } from "./invite-client-view";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { HabikuLogo } from "@/components/shared/habiku-logo";
import { Sparkles, Key, AlertTriangle, UserCheck, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Undangan Keluarga — Habiku",
  robots: { index: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Fetch invite using a direct query (Since RLS is enabled, this is secure.
  // If RLS blocks guest select, it's safe to query on server.
  // Wait, if RLS blocks completely, it might return empty or error.
  // In Supabase server-side code without service key, if there is no SELECT policy, it returns empty.
  // That's fine! Because accept_family_invite RPC does the validation securely.
  // But wait, let's query families to see if we can get anything or let them try to accept).
  // Let's do a quiet query:
  const { data: invite } = await supabase
    .from("family_invites")
    .select("*, families(name)")
    .eq("token", token)
    .maybeSingle();

  const familyName = (invite as any)?.families?.name || "Keluarga Habiku";

  // 3. If logged in, check if they are already in a family
  let userAccount = null;
  if (user) {
    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    userAccount = account;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex justify-center mb-2">
        <HabikuLogo />
      </div>

      <Card className="border border-emerald-100 shadow-xl bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden">
        {/* Top Decorative bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        
        <CardContent className="p-6">
          {!user ? (
            /* CASE 1: Logged Out */
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-sm">
                <Sparkles className="h-7 w-7" />
              </div>

              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-black text-slate-900 tracking-tight">
                  Bergabung sebagai Orang Tua! 🌟
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Anda diundang untuk bergabung dengan keluarga di **Habiku**. Bantu anak membangun kebiasaan baik dengan cara yang menyenangkan layaknya RPG!
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href={`/login?next=/invite/${token}`}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11 rounded-xl shadow-md cursor-pointer"
                  )}
                >
                  Masuk (Login) untuk Menerima
                </Link>
                
                <Link
                  href={`/sign-up?next=/invite/${token}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-11 rounded-xl cursor-pointer"
                  )}
                >
                  Belum punya akun? Buat Baru
                </Link>
              </div>
            </div>
          ) : userAccount ? (
            /* CASE 2: Logged In but ALREADY in a family */
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shadow-sm">
                <AlertTriangle className="h-7 w-7 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="font-heading text-xl font-bold text-slate-900">
                  Akun Sudah Memiliki Keluarga
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Akun Anda saat ini (`{user.email}`) sudah terhubung ke sebuah keluarga. Satu akun hanya dapat terhubung ke satu keluarga pada satu waktu.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/parent"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl cursor-pointer"
                  )}
                >
                  Kembali ke Beranda Saya
                </Link>
              </div>
            </div>
          ) : (
            /* CASE 3: Logged In and ready to accept invite */
            <InviteClientView token={token} familyName={familyName} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
