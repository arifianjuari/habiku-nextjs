"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Calendar,
  Sparkles,
  Smile,
  Image as ImageIcon,
  UserPlus,
  Trash,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { ChildStickyEditor } from "@/components/parent/child-sticky-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createChildProfileAction,
  updateChildProfileAction,
  deleteChildProfileAction,
} from "@/app/parent/profil-anak/actions";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import type { ChildProfile } from "@/types/database";

const EMOJI_OPTIONS = ["🦁", "🐼", "🦊", "🐯", "🐨", "🐸", "🐙", "🦄", "🐉", "🧙", "🥷", "🧑‍🚀", "🦸", "🧚"];
const ACCENT_OPTIONS = ["#8B5CF6", "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899"];

interface ChildProfilesListProps {
  initialChildren: ChildProfile[];
}

export function ChildProfilesList({ initialChildren }: ChildProfilesListProps) {
  const [childrenList, setChildrenList] = useState<ChildProfile[]>(initialChildren);
  const [isPending, startTransition] = useTransition();

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleOpenEdit = (child: ChildProfile) => {
    setEditingChild(child);
    setEditName(child.name);
    setEditPin("");
    setEditDob(child.date_of_birth || "");
    setEditGender((child.gender as "female" | "male" | "other") || "other");
    setEditAvatarPreference((child.avatar_preference as "photo" | "emoji") || "emoji");
    setEditAvatarEmoji(child.avatar_emoji || "🦁");
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleUpdateChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChild) return;
    setEditError(null);

    startTransition(async () => {
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
                }
              : c
          )
        );

        setIsEditOpen(false);
        setEditingChild(null);
      }
    });
  };

  const handleDeleteChild = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus profil ${name} secara permanen? Semua riwayat poin ledger dan misi akan ikut terhapus.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteChildProfileAction(id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Profil anak ${name} berhasil dihapus.`);
        setChildrenList((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  return (
    <div className="space-y-4">
      <ParentPageHeaderSync
        title="Kemajuan & Profil Anak"
        description="Kelola profil anak, setel PIN child-lock harian, dan sesuaikan profil petualang mereka."
      />

      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); setCreateError(null); }}>
          <DialogTrigger
            className="group/button inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-9 px-3.5 shadow-md shadow-emerald-950/10 cursor-pointer select-none outline-none text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tambah Profil
          </DialogTrigger>
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
      </div>

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
        <div className="grid gap-4 sm:grid-cols-2">
          {childrenList.map((child) => {
            const age = getAge(child.date_of_birth);
            const accent = child.home_card_accent || "#8B5CF6";
            
            return (
              <Card
                key={child.id}
                className="overflow-hidden border bg-white shadow-sm hover:shadow-md transition-all rounded-2xl relative"
                style={{ borderColor: `${accent}20` }}
              >
                <div className="h-2 w-full" style={{ backgroundColor: accent }} />
                
                <CardContent className="p-4 flex justify-between items-start gap-3">
                  <div className="flex gap-3 items-center min-w-0">
                    <ChildAvatar
                      name={child.name}
                      avatarUrl={child.avatar_url}
                      avatarPreference={child.avatar_preference}
                      avatarEmoji={child.avatar_emoji}
                      accentColor={accent}
                      className="h-12 w-12 shrink-0 rounded-xl shadow-sm text-lg font-bold text-white"
                    />
                    
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 leading-snug truncate">
                        {child.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{age !== null ? `${age} Th` : "Belum lahir"}</span>
                        <span>•</span>
                        <span className="capitalize">{child.gender === "female" ? "Perempuan" : child.gender === "male" ? "Laki-laki" : "Lainnya"}</span>
                      </p>
                      
                      <div className="flex items-center gap-1.5 mt-2 bg-slate-50 border border-slate-100 rounded-lg px-2 py-0.5 w-fit">
                        <TrendingUp className="h-3 w-3 text-slate-400" />
                        <span className="text-[9px] text-slate-600 font-extrabold leading-none">
                          Level {Math.floor((child.attr_discipline + child.attr_responsibility + child.attr_independence + child.attr_care + child.attr_honesty) / 5) + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(child)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                      title="Ubah Profil"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteChild(child.id, child.name)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                      title="Hapus Profil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
                <div className="px-4 pb-4">
                  <ChildStickyEditor
                    profileId={child.id}
                    childName={child.name}
                    initialMessage={
                      (child as ChildProfile & { parent_sticky_message?: string | null })
                        .parent_sticky_message ?? null
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
                <p className="text-[9px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border leading-relaxed">
                  *Untuk mengganti foto galeri privat anak, unggah langsung via **Storage privat** saat anak mengunggah bukti pengerjaan misi.
                </p>
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
    </div>
  );
}
