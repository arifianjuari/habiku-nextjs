"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ChildModeState = {
  isActive: boolean;
  profileId: string | null;
  profileName: string | null;
  enter: (profileId: string, profileName: string) => void;
  exit: () => void;
};

export const useChildModeStore = create<ChildModeState>()(
  persist(
    (set) => ({
      isActive: false,
      profileId: null,
      profileName: null,
      enter: (profileId, profileName) =>
        set({ isActive: true, profileId, profileName }),
      exit: () =>
        set({ isActive: false, profileId: null, profileName: null }),
    }),
    { name: "habiku-child-mode" },
  ),
);
