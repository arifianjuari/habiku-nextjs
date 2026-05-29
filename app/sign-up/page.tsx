import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { HabikuLogo } from "@/components/shared/habiku-logo";

export const metadata: Metadata = {
  title: "Daftar",
  robots: { index: false },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 p-4">
      <Link href="/">
        <HabikuLogo />
      </Link>
      <SignUpForm />
    </div>
  );
}
