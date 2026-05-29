import type { Metadata, Viewport } from "next";
import { DM_Sans, Poppins } from "next/font/google";
import { AppProviders } from "@/lib/providers/app-providers";
import { PwaProvider } from "@/components/shared/pwa-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Habiku — Kebiasaan baik, bersama keluarga",
    template: "%s · Habiku",
  },
  description:
    "Aplikasi pembentukan karakter anak: misi harian, target hadiah, dan semangat bersama orang tua.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Habiku",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${dmSans.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <PwaProvider>
          <AppProviders>{children}</AppProviders>
        </PwaProvider>
      </body>
    </html>
  );
}
