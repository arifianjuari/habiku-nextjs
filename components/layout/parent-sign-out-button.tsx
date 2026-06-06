"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Button } from "@/components/ui/button";

export function ParentSignOutButton() {
  const exitChildMode = useChildModeStore((s) => s.exit);

  return (
    <form
      action={signOut}
      onSubmit={() => {
        exitChildMode();
      }}
    >
      <Button variant="ghost" size="icon" type="submit" aria-label="Keluar">
        <LogOut className="size-5" />
      </Button>
    </form>
  );
}
