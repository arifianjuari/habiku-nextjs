"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Demo Child Mode — produksi memakai RPC `verify_child_profile_pin` (lihat database-architecture.md §6). */
export function EnterChildModeCard() {
  const router = useRouter();
  const enter = useChildModeStore((s) => s.enter);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleEnter() {
    if (pin.length < 4) {
      setError("PIN minimal 4 digit (demo).");
      return;
    }
    setError(null);
    enter("demo-profile-id", "Anak Demo");
    router.push("/child/home");
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Mode Anak</CardTitle>
        <CardDescription>
          Masuk ke sesi anak di perangkat ini. Produksi: verifikasi PIN via Supabase RPC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="child-pin">PIN orang tua</Label>
          <Input
            id="child-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full" onClick={handleEnter}>
          Buka Mode Anak
        </Button>
      </CardContent>
    </Card>
  );
}
