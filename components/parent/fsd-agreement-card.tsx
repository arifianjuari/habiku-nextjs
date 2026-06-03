import { Card, CardContent } from "@/components/ui/card";
import { Droplets, Heart, Sun } from "lucide-react";

export function FsdAgreementCard() {
  return (
    <Card className="border border-amber-100 bg-amber-50/20 rounded-2xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-rose-500" />
          Perjanjian Keluarga (FSD)
        </h4>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Bukan hukuman — target hadiah bisa tampil <strong>layu</strong> jika misi
          harian terlewat. Sistem mengecek otomatis setiap jam (timezone keluarga).
        </p>
        <ul className="space-y-2 text-[10px]">
          <li className="flex items-start gap-2">
            <Sun className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Segar</strong> — anak konsisten menyelesaikan misi.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Droplets className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Sedikit layu</strong> — 1 hari tanpa misi selesai; ajak kembali
              ke rutinitas dengan dukungan.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Droplets className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
            <span>
              <strong>Layu</strong> — 2+ hari berturut-turut; bicarakan bersama tanpa
              menyalahkan.
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
