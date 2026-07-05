"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CHILD_MODE_COOKIE,
  CHILD_PROFILE_COOKIE,
  PARENT_HOME,
  isChildModeCookieValue,
} from "@/lib/child/child-mode-session";

const CHILD_MODE_STORAGE_KEY = "habiku-child-mode";
const CHILD_MODE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const HYDRATION_FALLBACK_MS = 150;

export function setChildModeCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${CHILD_MODE_COOKIE}=1; path=/; max-age=${CHILD_MODE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } else {
    document.cookie = `${CHILD_MODE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax`;
    setChildProfileCookie(null);
  }
}

export function setChildProfileCookie(profileId: string | null) {
  if (typeof document === "undefined") return;
  if (profileId) {
    document.cookie = `${CHILD_PROFILE_COOKIE}=${profileId}; path=/; max-age=${CHILD_MODE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } else {
    document.cookie = `${CHILD_PROFILE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax`;
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
    setChildProfileCookie(profileId);
  } else if (isChildModeCookieActive()) {
    setChildModeCookie(false);
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

function writePersistedChildMode(state: PersistedChildMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CHILD_MODE_STORAGE_KEY,
      JSON.stringify({ state, version: 0 }),
    );
  } catch {
    /* quota / private mode */
  }
}

function clearPersistedChildMode() {
  writePersistedChildMode({
    isActive: false,
    profileId: null,
    profileName: null,
  });
}

function applyRecoveredChildMode() {
  if (!isChildModeCookieActive()) return false;

  const recovered = recoverChildModeFromStorage();
  if (!recovered?.isActive || !recovered.profileId) return false;
  useChildModeStore.setState({
    isActive: true,
    profileId: recovered.profileId,
    profileName: recovered.profileName ?? null,
  });
  setChildModeCookie(true);
  setChildProfileCookie(recovered.profileId);
  return true;
}

function reconcileRehydratedChildMode(state: PersistedChildMode | undefined) {
  const cookieActive = isChildModeCookieActive();

  if (state?.isActive && state.profileId) {
    if (cookieActive) {
      setChildModeCookie(true);
      setChildProfileCookie(state.profileId);
      return;
    }

    // Cookie sudah dibersihkan (keluar mode anak) — jangan hidupkan lagi dari localStorage basi.
    clearPersistedChildMode();
    useChildModeStore.setState({
      isActive: false,
      profileId: null,
      profileName: null,
    });
    return;
  }

  if (cookieActive) {
    applyRecoveredChildMode();
  }
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
        setChildProfileCookie(profileId);
        set({ isActive: true, profileId, profileName });
      },
      exit: () => {
        setChildModeCookie(false);
        setChildProfileCookie(null);
        clearPersistedChildMode();
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
        reconcileRehydratedChildMode(state);
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
  const [hydrated, setHydrated] = useState(() => {
    if (typeof window === "undefined") return false;
    if (childModeStoreHydrated) return true;
    if (isChildModeCookieActive()) {
      applyRecoveredChildMode();
      return true;
    }
    return false;
  });

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

/** Navigasi penuh ke dasbor ortu setelah keluar mode anak — pastikan middleware melihat cookie bersih. */
export function navigateToParentDashboardAfterChildExit() {
  if (typeof window === "undefined") return;
  window.location.assign(PARENT_HOME);
}
