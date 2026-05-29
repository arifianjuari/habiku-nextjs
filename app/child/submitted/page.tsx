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
  title: "Menunggu ortu",
};

export default function ChildSubmittedPage() {
  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Misi terkirim!</CardTitle>
        <CardDescription>
          Orang tua akan memeriksa misi Anda. Semangat!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/child/home" className={cn(buttonVariants(), "w-full")}>
          Kembali ke beranda
        </Link>
      </CardContent>
    </Card>
  );
}
