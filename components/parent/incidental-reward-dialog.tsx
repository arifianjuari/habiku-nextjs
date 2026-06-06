"use client";

import { Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IncidentalRewardForm } from "@/components/parent/incidental-reward-form";
import type { ChildProfile, Goal } from "@/types/database";

type IncidentalRewardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ChildProfile[];
  goalsByProfile: Record<string, Goal[]>;
  activeChildId: string;
  onActiveChildIdChange?: (childId: string) => void;
  onSuccess?: (result: { goal?: Goal }) => void;
};

export function IncidentalRewardDialog({
  open,
  onOpenChange,
  children,
  goalsByProfile,
  activeChildId,
  onActiveChildIdChange,
  onSuccess,
}: IncidentalRewardDialogProps) {
  const activeChild = children.find((c) => c.id === activeChildId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border border-amber-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            <Gift className="h-5 w-5 text-amber-600" aria-hidden />
            Reward Insidental
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            Beri energi atau HP di luar misi rutin
            {activeChild ? ` untuk ${activeChild.name}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <IncidentalRewardForm
          variant="plain"
          children={children}
          goalsByProfile={goalsByProfile}
          profileId={activeChildId}
          onProfileIdChange={onActiveChildIdChange}
          onSuccess={(result) => {
            onSuccess?.(result);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
