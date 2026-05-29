"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function ParentSignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="ghost" size="icon" type="submit" aria-label="Keluar">
        <LogOut className="size-5" />
      </Button>
    </form>
  );
}
