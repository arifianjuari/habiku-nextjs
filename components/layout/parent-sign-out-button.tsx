"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Button } from "@/components/ui/button";

export function ParentSignOutButton() {
  const exitChildMode = useChildModeStore((s) => s.exit);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={signOut}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          exitChildMode();
          void signOut();
        });
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        type="submit"
        disabled={isPending}
        aria-label="Keluar"
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <LogOut className="size-5" />
        )}
      </Button>
    </form>
  );
}
