"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Upload,
  Zap,
  CheckCircle2,
  Trash2,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitTaskEvidenceAction } from "@/app/child/actions";
import type { Task } from "@/types/database";
import {
  formatMaxSubmissionsLabel,
  getFrequencyDisplayLabel,
} from "@/lib/tasks/mission-frequency";

interface ChildMissionCompleteViewProps {
  taskId: string;
}

export function ChildMissionCompleteView({ taskId }: ChildMissionCompleteViewProps) {
  const router = useRouter();
  const { profileId } = useChildModeStore();
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!taskId) return;

    async function loadTaskDetails() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .maybeSingle();

        if (error) throw error;
        if (data) setTask(data);
      } catch (err) {
        console.error("Error loading task details:", err);
        toast.error("Gagal memuat detail misi.");
      } finally {
        setLoading(false);
      }
    }

    loadTaskDetails();
  }, [taskId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Berkas harus berupa gambar.");
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Berkas harus berupa gambar.");
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Client-side image compression to WebP using HTML5 Canvas
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      setIsCompressing(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              setIsCompressing(false);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Canvas compression failed"));
              }
            },
            "image/webp",
            0.75 // 75% quality is perfect balance of size and clarity
          );
        };
        img.onerror = (err) => {
          setIsCompressing(false);
          reject(err);
        };
      };
      reader.onerror = (err) => {
        setIsCompressing(false);
        reject(err);
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !task) return;

    startTransition(async () => {
      try {
        let evidenceUrl: string | null = null;

        // If there is an image to upload, compress and upload it first
        if (selectedImage) {
          toast.loading("Mengompresi bukti foto...", { id: "submit-task" });
          const compressedBlob = await compressImage(selectedImage);
          const compressedFile = new File([compressedBlob], "evidence.webp", {
            type: "image/webp",
          });

          toast.loading("Mengunggah bukti foto...", { id: "submit-task" });
          const fileExt = "webp";
          const uniqueId = Math.random().toString(36).substring(2, 15);
          const uploadPath = `${task.id}/${uniqueId}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("task-evidence")
            .upload(uploadPath, compressedFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw new Error(`Upload bukti foto gagal: ${uploadError.message}`);
          }

          // Get public URL
          const { data } = supabase.storage
            .from("task-evidence")
            .getPublicUrl(uploadPath);

          evidenceUrl = data.publicUrl;
        }

        toast.loading("Menganalisis dengan AI Gemini & mengirim misi...", { id: "submit-task" });

        // Submit task history record
        const res = await submitTaskEvidenceAction(
          task.id,
          profileId,
          notes,
          evidenceUrl
        );

        if (res?.error) {
          toast.error(res.error, { id: "submit-task" });
        } else {
          toast.success("Misi berhasil dikirim! 🚀", { id: "submit-task" });
          setIsSuccess(true);
          // Wait 2 seconds for the success animation before navigating back
          setTimeout(() => {
            router.push("/child/missions");
          }, 2200);
        }
      } catch (err: any) {
        console.error("Error submitting mission:", err);
        toast.error(err.message || "Terjadi kesalahan saat mengirim misi.", { id: "submit-task" });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <span className="text-xs font-semibold text-emerald-800">Menyiapkan Lembar Misi…</span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl space-y-3">
        <p className="text-sm font-semibold text-slate-700">Misi tidak ditemukan.</p>
        <Button onClick={() => router.back()} className="bg-emerald-700 text-white rounded-xl">
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        disabled={isPending || isSuccess}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Misi
      </button>

      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success-celebration"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 text-center rounded-3xl border border-emerald-100 bg-white shadow-xl space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="rounded-full bg-emerald-50 p-5 border-2 border-emerald-500 text-emerald-600 shadow-md shadow-emerald-500/10"
            >
              <CheckCircle2 className="h-16 w-16 fill-emerald-100" />
            </motion.div>
            
            <div className="space-y-2">
              <h3 className="font-heading text-lg font-black text-slate-900">Misi Terkirim! 🚀</h3>
              <p className="text-xs font-semibold text-slate-500 max-w-[280px]">
                Hebat sekali! Bukti misimu sedang dianalisis oleh AI Gemini dan dikirim ke Papa/Mama.
              </p>
            </div>

            {/* Micro Sparkles */}
            <div className="flex gap-1.5 items-center bg-amber-50 border border-amber-200/50 rounded-full px-3 py-1 text-[10px] font-black text-amber-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-pulse" />
              <span>Dapatkan +{task.reward_points} Energi setelah disetujui!</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="mission-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Mission Info Card */}
            <Card className="overflow-hidden border border-slate-100 bg-white/80 backdrop-blur-md rounded-3xl shadow-sm">
              <CardContent className="p-4 flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                    {task.category}
                  </span>
                  <h3 className="font-heading text-base font-black text-slate-900 leading-tight">
                    {task.title}
                  </h3>
                  {task.frequency_type && (
                    <p className="text-[10px] font-semibold text-slate-400">
                      Rutinitas: {getFrequencyDisplayLabel(task.frequency_type)} •{" "}
                      {formatMaxSubmissionsLabel(
                        task.max_submissions_per_period,
                        task.frequency_type,
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 bg-amber-50 border border-amber-200/50 rounded-2xl p-2 px-3 shadow-inner">
                  <Zap className="h-4.5 w-4.5 text-amber-500 fill-amber-500 animate-bounce" />
                  <span className="text-sm font-black text-amber-950">+{task.reward_points} E</span>
                </div>
              </CardContent>
            </Card>

            {/* Submission Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Evidence Uploader */}
              <Card className="overflow-hidden border border-slate-150 bg-white rounded-3xl shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <label className="text-xs font-bold text-slate-800 block">
                    Unggah Bukti Foto 📸 <span className="text-slate-400 font-medium">(Opsional tapi direkomendasikan)</span>
                  </label>

                  <AnimatePresence mode="wait">
                    {imagePreview ? (
                      <motion.div
                        key="image-preview"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center max-h-60"
                      >
                        <img
                          src={imagePreview}
                          alt="Pratinjau Bukti"
                          className="w-full h-full max-h-60 object-contain"
                        />
                        {/* Remove image button */}
                        <button
                          type="button"
                          onClick={clearImage}
                          disabled={isPending}
                          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="uploader-area"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-colors p-6 text-center cursor-pointer flex flex-col items-center justify-center space-y-2 bg-slate-50/30"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment" // Auto opens back camera on mobile
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Camera className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 leading-none">Ambil Foto atau Upload</p>
                          <p className="text-[9px] text-slate-400 leading-normal">
                            Tap untuk buka Kamera / Drag & drop berkas foto bukti disini
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Child Notes */}
              <Card className="overflow-hidden border border-slate-150 bg-white rounded-3xl shadow-sm">
                <CardContent className="p-5 space-y-2.5">
                  <label htmlFor="notes" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                    <FileText className="h-4.5 w-4.5 text-slate-500" />
                    Kirim Catatan Ke Papa & Mama:
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Aku sudah cuci piring makan siangku ya Pa! / Sudah salat Zuhur tepat waktu Ma."
                    className="w-full text-xs p-3.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/20 text-slate-800 placeholder-slate-400 font-medium leading-relaxed resize-none"
                    disabled={isPending}
                  />
                </CardContent>
              </Card>

              {/* Submit Action */}
              <Button
                type="submit"
                disabled={isPending || isCompressing}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-12 rounded-2xl shadow-md shadow-emerald-700/10 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-85"
              >
                {isPending || isCompressing ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>{isCompressing ? "Mengompresi Foto..." : "Menganalisis & Mengirim Misi..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5 text-amber-300 fill-amber-300" />
                    <span>Kirim Bukti Misi 🚀</span>
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
