"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CHILD_MODE_COOKIE,
  isChildModeCookieValue,
} from "@/lib/child/child-mode-session";

const CHILD_MODE_STORAGE_KEY = "habiku-child-mode";
const CHILD_MODE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const HYDRATION_FALLBACK_MS = 400;

export function setChildModeCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${CHILD_MODE_COOKIE}=1; path=/; max-age=${CHILD_MODE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } else {
    document.cookie = `${CHILD_MODE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax`;
  }
}

export function isChildModeCookieActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((part) => {
      const [name, value] = part.split("=");
      return name === CHILD_MODE_COOKIE && isChildModeCookieValue(value);
    });
}

/** Sinkronkan cookie sebelum tab ditutup agar middleware tetap mengenali mode anak. */
export function syncChildModeCookieFromStore() {
  const { isActive, profileId } = useChildModeStore.getState();
  if (isActive && profileId) {
    setChildModeCookie(true);
  }
}

type PersistedChildMode = {
  isActive?: boolean;
  profileId?: string | null;
  profileName?: string | null;
};

function recoverChildModeFromStorage(): PersistedChildMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHILD_MODE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: PersistedChildMode };
    const state = parsed.state;
    if (state?.isActive && state.profileId) return state;
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

function applyRecoveredChildMode() {
  const recovered = recoverChildModeFromStorage();
  if (!recovered?.isActive || !recovered.profileId) return false;
  useChildModeStore.setState({
    isActive: true,
    profileId: recovered.profileId,
    profileName: recovered.profileName ?? null,
  });
  setChildModeCookie(true);
  return true;
}

type ChildModeState = {
  isActive: boolean;
  profileId: string | null;
  profileName: string | null;
  enter: (profileId: string, profileName: string) => void;
  exit: () => void;
};

let childModeStoreHydrated = false;
const childModeHydrationListeners = new Set<() => void>();

export function markChildModeStoreHydrated() {
  if (childModeStoreHydrated) return;
  childModeStoreHydrated = true;
  for (const listener of childModeHydrationListeners) {
    listener();
  }
  childModeHydrationListeners.clear();
}

export const useChildModeStore = create<ChildModeState>()(
  persist(
    (set) => ({
      isActive: false,
      profileId: null,
      profileName: null,
      enter: (profileId, profileName) => {
        setChildModeCookie(true);
        set({ isActive: true, profileId, profileName });
      },
      exit: () => {
        setChildModeCookie(false);
        set({ isActive: false, profileId: null, profileName: null });
      },
    }),
    {
      name: CHILD_MODE_STORAGE_KEY,
      partialize: (state) => ({
        isActive: state.isActive,
        profileId: state.profileId,
        profileName: state.profileName,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isActive && state.profileId) {
          setChildModeCookie(true);
        } else if (isChildModeCookieActive()) {
          applyRecoveredChildMode();
        }
        markChildModeStoreHydrated();
      },
    },
  ),
);

/**
 * Tunggu localStorage selesai dibaca sebelum guard/redirect mode anak.
 * Ada fallback timeout agar tidak hang selamanya di layar loading.
 */
export function useChildModeHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (childModeStoreHydrated) {
      setHydrated(true);
      return;
    }

    const listener = () => setHydrated(true);
    childModeHydrationListeners.add(listener);

    void Promise.resolve(useChildModeStore.persist.rehydrate()).finally(() => {
      if (!childModeStoreHydrated) {
        if (isChildModeCookieActive()) {
          applyRecoveredChildMode();
        }
        markChildModeStoreHydrated();
      }
    });

    const fallback = window.setTimeout(() => {
      if (!childModeStoreHydrated) {
        if (isChildModeCookieActive()) {
          applyRecoveredChildMode();
        }
        markChildModeStoreHydrated();
      }
    }, HYDRATION_FALLBACK_MS);

    return () => {
      childModeHydrationListeners.delete(listener);
      window.clearTimeout(fallback);
    };
  }, []);

  return hydrated;
}
