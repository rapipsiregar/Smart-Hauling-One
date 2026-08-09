import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Integrated Smart Hauling System — Perangkat Gate",
  description:
    "Konsol lokal satu gate: status perangkat, uji pembacaan nomor lambung, dan riwayat lintasan yang tersimpan di perangkat itu sendiri.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
