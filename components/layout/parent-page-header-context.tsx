"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ParentPageHeaderState = {
  title: string;
  description?: string;
  /** Label waktu beranda (Selamat pagi, dll.) — tampil di sticky header. */
  timeGreeting?: string;
  /** Tampilkan tombol kembali di header (mis. sub-halaman dari pengaturan). */
  backHref?: string;
  backLabel?: string;
};

type ParentPageHeaderContextValue = {
  pageHeader: ParentPageHeaderState | null;
  setPageHeader: (header: ParentPageHeaderState | null) => void;
};

const ParentPageHeaderContext = createContext<ParentPageHeaderContextValue | null>(
  null
);

export function ParentPageHeaderProvider({ children }: { children: ReactNode }) {
  const [pageHeader, setPageHeaderState] = useState<ParentPageHeaderState | null>(
    null
  );

  const setPageHeader = useCallback((header: ParentPageHeaderState | null) => {
    setPageHeaderState(header);
  }, []);

  const value = useMemo(
    () => ({ pageHeader, setPageHeader }),
    [pageHeader, setPageHeader]
  );

  return (
    <ParentPageHeaderContext.Provider value={value}>
      {children}
    </ParentPageHeaderContext.Provider>
  );
}

function useParentPageHeaderContext() {
  const ctx = useContext(ParentPageHeaderContext);
  if (!ctx) {
    throw new Error(
      "useParentPageHeader must be used within ParentPageHeaderProvider"
    );
  }
  return ctx;
}

/** Sinkronkan judul halaman ke sticky header parent (reset saat unmount). */
export function ParentPageHeaderSync({
  title,
  description,
  timeGreeting,
  backHref,
  backLabel,
}: ParentPageHeaderState) {
  const { setPageHeader } = useParentPageHeaderContext();

  useLayoutEffect(() => {
    setPageHeader({ title, description, timeGreeting, backHref, backLabel });
    return () => setPageHeader(null);
  }, [title, description, timeGreeting, backHref, backLabel, setPageHeader]);

  return null;
}

export function useParentPageHeader() {
  return useParentPageHeaderContext();
}
