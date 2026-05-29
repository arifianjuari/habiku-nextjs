import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HabikuLogo } from "@/components/shared/habiku-logo";

export const metadata: Metadata = {
  title: "Profil Keluarga — Habiku",
  robots: { index: false },
};

export default function OnboardingFamilyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex justify-center mb-2">
        <HabikuLogo />
      </div>

      <Card className="border border-emerald-100 shadow-xl shadow-emerald-950/5 bg-white/80 backdrop-blur-md">
        <CardHeader className="pb-4">
          <CardTitle className="font-heading text-3xl font-extrabold text-center tracking-tight text-emerald-950">
            Langkah Terakhir ✨
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground text-pretty">
            Lengkapi nama keluarga dan profil anak pertama Anda untuk memulai petualangan habit-building yang seru!
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
