import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Selamat datang",
  robots: { index: false },
};

export default function OnboardingIntroPage() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Selamat datang di Habiku</CardTitle>
          <CardDescription>
            Langkah berikutnya: buat profil keluarga dan tambahkan anak pertama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/onboarding/family"
            className={cn(buttonVariants(), "w-full")}
          >
            Lanjutkan
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
