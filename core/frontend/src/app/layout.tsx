import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";
import { ThemeProvider } from "@/lib/theme-context";
import { GuideProvider } from "@/lib/guide-context";
import { BackendStatusProvider } from "@/lib/backend-status-context";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Integrated Smart Hauling System — Konsol Pusat",
  description: "High-fidelity mining operations and vehicle tracking dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("sg_theme");if(t==="light"){document.documentElement.classList.add("light");document.documentElement.classList.remove("dark")}else{document.documentElement.classList.add("dark");document.documentElement.classList.remove("light")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full text-[var(--text-primary)] flex flex-col overflow-hidden">
        <AuthProvider>
          <ThemeProvider>
            <GuideProvider>
              <BackendStatusProvider>
                <AppShell>{children}</AppShell>
              </BackendStatusProvider>
            </GuideProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
