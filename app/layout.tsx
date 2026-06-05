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
      { url: "/icon", sizes: "32x32", type: "image/png" },
      { url: "/icons/192", sizes: "192x192", type: "image/png" },
      { url: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Habiku",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  colorScheme: "light",
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
    <html
      lang="id"
      className={`${dmSans.variable} ${poppins.variable} light h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased">
        <PwaProvider>
          <AppProviders>{children}</AppProviders>
        </PwaProvider>
      </body>
    </html>
  );
}
