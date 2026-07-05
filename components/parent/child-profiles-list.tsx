"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Plus,
  Edit2,
  Archive,
  ArchiveRestore,
  Lock,
  Calendar,
  Sparkles,
  Smile,
  Image as ImageIcon,
  UserPlus,
  HelpCircle,
  TrendingUp,
  Camera,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImageToWebp } from "@/lib/images/compress-image";
import {
  childAvatarStoragePath,
  isChildAvatarStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/storage/child-avatar";
import { getCachedSignedUrl } from "@/lib/storage/signed-url-cache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { usePrefetchChildAvatarUrls } from "@/lib/hooks/use-prefetch-child-avatar-urls";
import { ChildStickyEditor } from "@/components/parent/child-sticky-editor";
import { ChildModeEnterDialog } from "@/components/parent/child-mode-enter-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  archiveChildProfileAction,
  createChildProfileAction,
  restoreChildProfileAction,
  setChildProfileAvatarPathAction,
  updateChildProfileAction,
} from "@/app/parent/profil-anak/actions";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import type { ChildProfile } from "@/types/database";

const EMOJI_OPTIONS = ["🦁", "🐼", "🦊", "🐯", "🐨", "🐸", "🐙", "🦄", "🐉", "🧙", "🥷", "🧑‍🚀", "🦸", "🧚"];
const ACCENT_OPTIONS = ["#8B5CF6", "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899"];

interface ChildProfilesListProps {
  initialChildren: ChildProfile[];
  initialArchivedChildren?: ChildProfile[];
}

export function ChildProfilesList({
  initialChildren,
  initialArchivedChildren = [],
}: ChildProfilesListProps) {
  const [childrenList, setChildrenList] = useState<ChildProfile[]>(initialChildren);
  const [archivedList, setArchivedList] = useState<ChildProfile[]>(initialArchivedChildren);
  const [isPending, startTransition] = useTransition();

  const avatarPaths = useMemo(
    () => [...childrenList, ...archivedList].map((child) => child.avatar_url),
    [childrenList, archivedList],
  );
  usePrefetchChildAvatarUrls(avatarPaths);

  // Create Form States
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other">("other");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form States
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editGender, setEditGender] = useState<"female" | "male" | "other">("other");
  const [editAvatarPreference, setEditAvatarPreference] = useState<"photo" | "emoji">("emoji");
  const [editAvatarEmoji, setEditAvatarEmoji] = useState("🦁");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editExistingPhotoPreview, setEditExistingPhotoPreview] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Calculate age
  const getAge = (dobString: string | null) => {
    if (!dobString) return null;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleCreateChild = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    startTransition(async () => {
      const res = await createChildProfileAction(name, pin, dob, gender);
      if (res?.error) {
        setCreateError(res.error);
        toast.error(res.error);
      } else if (res?.success) {
        toast.success(`Profil anak ${name} berhasil dibuat! 🧑‍🚀`);
        
        // Optimistically add to state (with basic structure, next reload will fetch actual full profile)
        const mockChild: ChildProfile = {
          id: res.id || String(Math.random()),
          family_id: "",
          name: name.trim(),
          pin_hash: "",
          avatar_url: null,
          avatar_preference: "emoji",
          avatar_emoji: "🦁",
          date_of_birth: dob,
          gender: gender,
          home_card_accent: "#8B5CF6",
          featured_task_id: null,
          attr_discipline: 0,
          attr_responsibility: 0,
          attr_independence: 0,
          attr_care: 0,
          attr_honesty: 0,
          archived_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setChildrenList((prev) => [...prev, mockChild]);
        
        // Reset create inputs
        setName("");
        setPin("");
        setDob("");
        setGender("other");
        setIsCreateOpen(false);
      }
    });
  };

  const clearEditPhotoSelection = () => {
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = "";
    }
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Berkas harus berupa gambar.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 10 MB.");
      return;
    }

    setEditPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setEditPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!editingChild?.avatar_url || !isChildAvatarStoragePath(editingChild.avatar_url)) {
      setEditExistingPhotoPreview(null);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const cacheKey = `${STORAGE_BUCKETS.childAvatars}:${editingChild.avatar_url}`;
    void getCachedSignedUrl(
      cacheKey,
      async () => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.childAvatars)
          .createSignedUrl(editingChild.avatar_url!, 3600);
        return error ? null : data?.signedUrl ?? null;
      },
      3600,
    ).then((url) => {
      if (!cancelled) setEditExistingPhotoPreview(url);
    });

    return () => {
      cancelled = true;
    };
  }, [editingChild?.avatar_url]);

  const handleOpenEdit = (child: ChildProfile) => {
    setEditingChild(child);
    setEditName(child.name);
    setEditPin("");
    setEditDob(child.date_of_birth || "");
    setEditGender((child.gender as "female" | "male" | "other") || "other");
    setEditAvatarPreference((child.avatar_preference as "photo" | "emoji") || "emoji");
    setEditAvatarEmoji(child.avatar_emoji || "🦁");
    clearEditPhotoSelection();
    setEditError(null);
    setIsEditOpen(true);
  };

  const uploadChildAvatarPhoto = async (profileId: string, file: File) => {
    const compressedBlob = await compressImageToWebp(file);
    const compressedFile = new File([compressedBlob], "avatar.webp", {
      type: "image/webp",
    });
    const uploadPath = childAvatarStoragePath(profileId);
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.childAvatars)
      .upload(uploadPath, compressedFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload foto gagal: ${uploadError.message}`);
    }

    const pathRes = await setChildProfileAvatarPathAction(profileId, uploadPath);
    if (pathRes?.error) {
      throw new Error(pathRes.error);
    }

    return uploadPath;
  };

  const handleUpdateChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChild) return;
    setEditError(null);

    if (
      editAvatarPreference === "photo" &&
      !editPhotoFile &&
      !editingChild.avatar_url
    ) {
      const message = "Unggah foto dari galeri terlebih dahulu.";
      setEditError(message);
      toast.error(message);
      return;
    }

    startTransition(async () => {
      try {
        let newAvatarPath = editingChild.avatar_url;

        if (editAvatarPreference === "photo" && editPhotoFile) {
          toast.loading("Mengunggah foto avatar...", { id: "avatar-upload" });
          newAvatarPath = await uploadChildAvatarPhoto(editingChild.id, editPhotoFile);
          toast.dismiss("avatar-upload");
        }

        const res = await updateChildProfileAction(
          editingChild.id,
          editName,
          editPin || undefined,
          editDob || undefined,
          editGender,
          editAvatarPreference,
          editAvatarEmoji
        );

        if (res?.error) {
          setEditError(res.error);
          toast.error(res.error);
        } else if (res?.success) {
          toast.success(`Profil anak ${editName} berhasil diperbarui! 🎉`);

          setChildrenList((prev) =>
            prev.map((c) =>
              c.id === editingChild.id
                ? {
                    ...c,
                    name: editName.trim(),
                    date_of_birth: editDob,
                    gender: editGender,
                    avatar_preference: editAvatarPreference,
                    avatar_emoji: editAvatarEmoji,
                    avatar_url: newAvatarPath,
                  }
                : c
            )
          );

          clearEditPhotoSelection();
          setIsEditOpen(false);
          setEditingChild(null);
        }
      } catch (err) {
        toast.dismiss("avatar-upload");
        const message =
          err instanceof Error ? err.message : "Gagal mengunggah foto avatar.";
        setEditError(message);
        toast.error(message);
      }
    });
  };

  const handleArchiveChild = (child: ChildProfile) => {
    if (
      !confirm(
        `Arsipkan profil ${child.name}? Profil disembunyikan dari beranda, tetapi riwayat misi, poin, dan target tetap tersimpan. Anda bisa memulihkannya dari Arsip.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await archiveChildProfileAction(child.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Profil ${child.name} diarsipkan.`);
        setChildrenList((prev) => prev.filter((c) => c.id !== child.id));
        setArchivedList((prev) => [
          { ...child, archived_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    });
  };

  const handleRestoreChild = (child: ChildProfile) => {
    startTransition(async () => {
      const res = await restoreChildProfileAction(child.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Profil ${child.name} berhasil dipulihkan!`);
        setArchivedList((prev) => prev.filter((c) => c.id !== child.id));
        setChildrenList((prev) =>
          [...prev, { ...child, archived_at: null }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }
    });
  };

  const openCreateDialog = () => {
    setCreateError(null);
    setIsCreateOpen(true);
  };

  return (
    <>
    <div className="space-y-4 pb-12">
      <ParentPageHeaderSync
        title="Kemajuan & Profil Anak"
        description="Kelola profil anak, setel PIN child-lock harian, dan sesuaikan profil petualang mereka."
      />

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); setCreateError(null); }}>
          <DialogContent className="max-w-sm rounded-3xl border border-emerald-100 bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
                <UserPlus className="h-5 w-5 text-emerald-700 animate-pulse" />
                Tambah Profil Anak Baru
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-500">
                Buat profil petualang baru agar anak dapat mulai membangun kebiasaan baik!
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateChild} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-slate-800">Nama Lengkap / Panggilan</Label>
                <Input
                  id="name"
                  placeholder="Misal: Kakak Riri"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-slate-200 focus-visible:ring-emerald-700 h-10 rounded-xl bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pin" className="text-xs font-bold text-slate-800">PIN Child-lock (4 digit angka)</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="border-slate-200 focus-visible:ring-emerald-700 h-10 rounded-xl bg-white tracking-widest text-center text-lg font-bold"
                  required
                />
                <p className="text-[9px] text-muted-foreground leading-snug">
                  PIN ini akan diminta setiap kali anak masuk/keluar dari Child Mode.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-bold text-slate-800">Tanggal Lahir</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="border-slate-200 focus-visible:ring-emerald-700 h-10 rounded-xl bg-white text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-bold text-slate-800">Jenis Kelamin</Label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold h-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="male">Laki-laki 👦</option>
                    <option value="female">Perempuan 👧</option>
                    <option value="other">Lainnya 🌟</option>
                  </select>
                </div>
              </div>

              {createError && (
                <p className="text-xs font-semibold text-red-600 text-center bg-red-50 p-2.5 rounded-lg border border-red-100" role="alert">
                  {createError}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11 rounded-xl shadow-md"
                >
                  {isPending ? "Menyimpan Profil..." : "Buat Profil Anak"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Profiles Grid */}
      {childrenList.length === 0 ? (
        <Card className="border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <User className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Belum Ada Profil Anak</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Tambahkan profil anak pertama Anda untuk mulai menugaskan misi harian dan memantau kemajuan petualangan mereka.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {childrenList.map((child) => {
            const age = getAge(child.date_of_birth);
            const accent = child.home_card_accent || "#8B5CF6";
            
            return (
              <Card
                key={child.id}
                size="sm"
                className="relative gap-0 overflow-hidden rounded-2xl border bg-white py-0 shadow-sm transition-all hover:shadow-md data-[size=sm]:py-0"
                style={{ borderColor: `${accent}20` }}
              >
                <div className="h-1 w-full" style={{ backgroundColor: accent }} />

                <CardContent className="space-y-1.5 p-2">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <ChildAvatar
                        name={child.name}
                        avatarUrl={child.avatar_url}
                        avatarPreference={child.avatar_preference}
                        avatarEmoji={child.avatar_emoji}
                        accentColor={accent}
                        className="h-9 w-9 shrink-0 rounded-lg text-sm font-bold text-white shadow-sm"
                      />

                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-bold leading-tight text-slate-900">
                          {child.name}
                        </h4>
                        <p className="flex flex-wrap items-center gap-1 text-[9px] font-semibold leading-tight text-slate-500">
                          <span>{age !== null ? `${age} Th` : "Belum lahir"}</span>
                          <span>•</span>
                          <span className="capitalize">{child.gender === "female" ? "Perempuan" : child.gender === "male" ? "Laki-laki" : "Lainnya"}</span>
                        </p>

                        <div className="mt-0.5 flex w-fit items-center gap-0.5 rounded border border-slate-100 bg-slate-50 px-1 py-px">
                          <TrendingUp className="h-2.5 w-2.5 text-slate-400" />
                          <span className="text-[8px] font-extrabold leading-none text-slate-600">
                            Level {Math.floor((child.attr_discipline + child.attr_responsibility + child.attr_independence + child.attr_care + child.attr_honesty) / 5) + 1}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        data-compact
                        onClick={() => handleOpenEdit(child)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                        title="Ubah Profil"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        data-compact
                        onClick={() => handleArchiveChild(child)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-amber-100 text-amber-600 transition-colors hover:bg-amber-50"
                        title="Arsipkan Profil"
                      >
                        <Archive className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <ChildStickyEditor
                    profileId={child.id}
                    childName={child.name}
                    initialMessage={
                      (child as ChildProfile & { parent_sticky_message?: string | null })
                        .parent_sticky_message ?? null
                    }
                  />

                  <ChildModeEnterDialog profileId={child.id} childName={child.name} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {archivedList.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-500" aria-hidden />
            <h3 className="text-xs font-bold text-slate-700">Arsip profil anak</h3>
            <span className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-bold text-slate-600">
              {archivedList.length}
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Profil di bawah disembunyikan dari beranda. Pulihkan untuk menampilkan kembali beserta riwayatnya.
          </p>
          <ul className="space-y-2">
            {archivedList.map((child) => (
              <li
                key={child.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChildAvatar
                    name={child.name}
                    avatarUrl={child.avatar_url}
                    avatarPreference={child.avatar_preference}
                    avatarEmoji={child.avatar_emoji}
                    accentColor={child.home_card_accent || "#8B5CF6"}
                    className="h-8 w-8 shrink-0 rounded-lg text-xs font-bold text-white opacity-70"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-700">{child.name}</p>
                    <p className="text-[9px] text-slate-400">
                      Diarsipkan{" "}
                      {child.archived_at
                        ? new Date(child.archived_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleRestoreChild(child)}
                  className="h-8 shrink-0 cursor-pointer rounded-lg border-emerald-200 px-2.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  <ArchiveRestore className="mr-1 h-3 w-3" />
                  Pulihkan
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>

      {/* FAB — mengambang di atas bottom nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.625rem)] z-50">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-end px-4">
          <button
            type="button"
            data-compact
            onClick={openCreateDialog}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-950/25 ring-1 ring-emerald-600/20 transition-colors hover:bg-emerald-800 cursor-pointer select-none outline-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Profil
          </button>
        </div>
      </div>

      {/* Edit Child Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if(!open) setEditingChild(null); }}>
        <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
              <Edit2 className="h-5 w-5 text-violet-700 animate-pulse" />
              Ubah Profil: {editingChild?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              Perbarui biodata dan preferensi penampilan karakter anak.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateChild} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName" className="text-xs font-bold text-slate-800">Nama Anak</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border-slate-200 focus-visible:ring-violet-700 h-10 rounded-xl bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editPin" className="text-xs font-bold text-slate-800">PIN Baru (Kosongkan jika tidak diubah)</Label>
              <Input
                id="editPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="••••"
                value={editPin}
                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))}
                className="border-slate-200 focus-visible:ring-violet-700 h-10 rounded-xl bg-white tracking-widest text-center text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editDob" className="text-xs font-bold text-slate-800">Tanggal Lahir</Label>
                <Input
                  id="editDob"
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="border-slate-200 focus-visible:ring-violet-700 h-10 rounded-xl bg-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editGender" className="text-xs font-bold text-slate-800">Jenis Kelamin</Label>
                <select
                  id="editGender"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as any)}
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold h-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-700"
                >
                  <option value="male">Laki-laki 👦</option>
                  <option value="female">Perempuan 👧</option>
                  <option value="other">Lainnya 🌟</option>
                </select>
              </div>
            </div>

            {/* Avatar Preference */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-800 block">Avatar Tampilan</Label>
              
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditAvatarPreference("emoji")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                    editAvatarPreference === "emoji"
                      ? "bg-violet-55 border-violet-200 text-violet-850 bg-violet-50/40"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Smile className="h-4 w-4" />
                  Emoji Karakter
                </button>
                <button
                  type="button"
                  onClick={() => setEditAvatarPreference("photo")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                    editAvatarPreference === "photo"
                      ? "bg-violet-55 border-violet-200 text-violet-850 bg-violet-50/40"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                  Foto Galeri
                </button>
              </div>

              {/* Emoji Options */}
              {editAvatarPreference === "emoji" && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 block">Pilih Emoji RPG:</span>
                  <div className="grid grid-cols-7 gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 border border-slate-200/50 rounded-xl">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditAvatarEmoji(emoji)}
                        className={`h-8 w-8 text-lg flex items-center justify-center rounded-lg hover:bg-white transition-colors cursor-pointer ${
                          editAvatarEmoji === emoji ? "bg-white border border-violet-300 shadow-sm" : ""
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {editAvatarPreference === "photo" && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 block">
                    Foto profil (disimpan privat di Supabase Storage):
                  </span>
                  <AnimatePresence mode="wait">
                    {editPhotoPreview || editExistingPhotoPreview ? (
                      <motion.div
                        key="avatar-preview"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center max-h-36"
                      >
                        <img
                          src={editPhotoPreview ?? editExistingPhotoPreview ?? ""}
                          alt="Pratinjau foto profil"
                          className="w-full h-full max-h-36 object-contain"
                        />
                        {editPhotoPreview ? (
                          <button
                            type="button"
                            onClick={clearEditPhotoSelection}
                            disabled={isPending}
                            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                            aria-label="Hapus foto yang dipilih"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </motion.div>
                    ) : (
                      <motion.button
                        key="avatar-uploader"
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => editPhotoInputRef.current?.click()}
                        disabled={isPending}
                        className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-400 hover:bg-violet-50/20 transition-colors p-4 text-center cursor-pointer flex flex-col items-center justify-center space-y-1.5 bg-slate-50/30 disabled:opacity-50"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                          <Camera className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-none">
                          Pilih Foto dari Galeri
                        </p>
                        <p className="text-[9px] text-slate-400 leading-normal">
                          JPG, PNG, atau WebP — maks. 10 MB
                        </p>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <input
                    ref={editPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditPhotoChange}
                    className="hidden"
                  />
                  {editExistingPhotoPreview && !editPhotoPreview ? (
                    <button
                      type="button"
                      onClick={() => editPhotoInputRef.current?.click()}
                      disabled={isPending}
                      className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer disabled:opacity-50"
                    >
                      Ganti foto
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {editError && (
              <p className="text-xs font-semibold text-red-600 text-center bg-red-50 p-2.5 rounded-lg border border-red-100" role="alert">
                {editError}
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold h-11 rounded-xl shadow-md"
              >
                {isPending ? "Menyimpan Perubahan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
