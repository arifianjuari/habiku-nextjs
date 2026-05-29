import Link from "next/link";
import { HabikuLogo } from "@/components/shared/habiku-logo";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <HabikuLogo />
        <div className="flex gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Masuk
          </Link>
          <Link href="/sign-up" className={buttonVariants()}>
            Mulai gratis
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-6">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium text-emerald-700">Untuk keluarga Indonesia</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Kebiasaan baik anak,{" "}
            <span className="text-emerald-700">dengan semangat bermain</span>
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            Habiku membantu orang tua merancang misi harian, menyetujui pencapaian, dan
            menumbuhkan target hadiah — semua dalam satu aplikasi web yang ramah anak.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
              Buat akun keluarga
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Sudah punya akun
            </Link>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Mode Anak",
              body: "Antarmuka khusus anak, dikunci PIN orang tua.",
            },
            {
              title: "Buku besar poin",
              body: "Setiap poin tercatat — transparan dan konsisten.",
            },
            {
              title: "Banyak target",
              body: "Beberapa hadiah aktif dengan progres HP yang jelas.",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border bg-card p-5 shadow-sm"
            >
              <h2 className="font-heading font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Habiku
      </footer>
    </div>
  );
}
