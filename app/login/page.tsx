import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { HabikuLogo } from "@/components/shared/habiku-logo";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false },
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 p-4">
      <Link href="/">
        <HabikuLogo />
      </Link>
      <LoginForm next={next ?? "/parent"} />
    </div>
  );
}
