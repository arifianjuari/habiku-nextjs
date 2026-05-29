"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bootstrapOnboarding } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight, ArrowLeft, Check, Lock, Calendar, User, Users } from "lucide-react";

type Step = "family" | "child";

export function OnboardingForm() {
  const [step, setStep] = useState<Step>("family");
  const [familyName, setFamilyName] = useState("");
  
  // Child Profile States
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [childGender, setChildGender] = useState<"male" | "female" | "other">("other");
  const [childPin, setChildPin] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      // Append client states not easily captured by standard native forms
      formData.set("familyName", familyName);
      formData.set("childName", childName);
      formData.set("childDob", childDob);
      formData.set("childGender", childGender);
      formData.set("childPin", childPin);
      
      return bootstrapOnboarding(prevState, formData);
    },
    { error: null }
  );

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!familyName.trim()) {
      alert("Nama keluarga wajib diisi.");
      return;
    }
    setStep("child");
  };

  const handlePrevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep("family");
  };

  return (
    <form action={formAction} className="relative overflow-hidden w-full">
      <AnimatePresence mode="wait">
        {step === "family" ? (
          <motion.div
            key="family"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="font-heading text-2xl font-bold tracking-tight">Profil Keluarga Baru</h2>
              <p className="text-sm text-muted-foreground">
                Mari buat wadah keluarga Anda terlebih dahulu.
              </p>
            </div>

            <Card className="border border-emerald-100/40 bg-emerald-50/10 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="familyName" className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-700" />
                    Nama Keluarga
                  </Label>
                  <Input
                    id="familyName"
                    placeholder="Contoh: Keluarga Arifian"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="border-emerald-200 focus-visible:ring-emerald-700 h-11"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ini akan menjadi identitas dashboard orang tua dan anak-anak Anda.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleNextStep}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium h-11"
            >
              Lanjutkan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="child"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="font-heading text-2xl font-bold tracking-tight">Profil Anak Pertama</h2>
              <p className="text-sm text-muted-foreground">
                Masukkan identitas anak pertama untuk didaftarkan ke misi Habiku.
              </p>
            </div>

            <Card className="border border-violet-100/40 bg-violet-50/10 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                {/* Nama Anak */}
                <div className="space-y-2">
                  <Label htmlFor="childName" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-violet-700" />
                    Nama Anak
                  </Label>
                  <Input
                    id="childName"
                    placeholder="Contoh: Budi"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="border-violet-200 focus-visible:ring-violet-700 h-11"
                    required
                  />
                </div>

                {/* Tanggal Lahir & Gender */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="childDob" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-violet-700" />
                      Tanggal Lahir
                    </Label>
                    <Input
                      id="childDob"
                      type="date"
                      value={childDob}
                      onChange={(e) => setChildDob(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="border-violet-200 focus-visible:ring-violet-700 h-11"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">Jenis Kelamin</Label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg h-11 items-center">
                      {[
                        { value: "male", label: "L" },
                        { value: "female", label: "P" },
                        { value: "other", label: "Lain" },
                      ].map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setChildGender(g.value as any)}
                          className={`text-xs font-semibold py-1.5 rounded-md transition-all ${
                            childGender === g.value
                              ? "bg-white shadow-sm text-violet-950 font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PIN Mode Anak */}
                <div className="space-y-2">
                  <Label htmlFor="childPin" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-700" />
                    PIN Mode Anak (4 Digit Angka)
                  </Label>
                  <Input
                    id="childPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Contoh: 1234"
                    value={childPin}
                    onChange={(e) => setChildPin(e.target.value.replace(/\D/g, ""))}
                    className="border-violet-200 focus-visible:ring-violet-700 h-11 tracking-widest text-center text-lg font-bold"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    PIN rahasia ini digunakan anak untuk masuk/keluar dari Child Mode secara mandiri.
                  </p>
                </div>
              </CardContent>
            </Card>

            {state?.error && (
              <p className="text-sm font-semibold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                {state.error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={isPending}
                className="h-11 border-violet-200 hover:bg-violet-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-violet-700 hover:bg-violet-800 text-white font-medium h-11"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  <>
                    Selesaikan Onboarding
                    <Sparkles className="ml-2 h-4 w-4 fill-white" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
