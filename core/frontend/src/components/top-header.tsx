"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Sun, Moon, Search, WifiOff, BookOpen, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useGuide } from "@/lib/guide-context";
import { useBackendStatus } from "@/lib/backend-status-context";
import { NotificationBell } from "@/components/notification-bell";
import { HEADINGS } from "./navigation-data";
import { useAuth } from "@/lib/auth-context";

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
}

function BackendStatusPill() {
  const { status } = useBackendStatus();
  if (status !== "offline") return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-500"
      title="Server pusat tidak terjangkau — data live belum tersedia sampai koneksi terhubung kembali."
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden sm:inline">Koneksi Server Terputus</span>
    </div>
  );
}

export function TopHeader({ onOpenMobileMenu }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { guideMode, toggleGuide } = useGuide();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const headingKey =
    Object.keys(HEADINGS)
      .filter((k) => (k === "/" ? pathname === "/" : pathname.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0] ?? "/";
  const headingText = HEADINGS[headingKey] ?? "Integrated Smart Hauling System";

  return (
    <header
      data-print="hide"
      className="h-[56px] shrink-0 border-b border-[var(--border)] glass-panel px-4 md:px-6 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-[var(--text-primary)] tracking-normal truncate">
          {headingText}
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <BackendStatusPill />

        <button
          onClick={toggleGuide}
          aria-label="Mode panduan"
          aria-pressed={guideMode}
          title={guideMode ? "Mode panduan aktif — matikan" : "Nyalakan mode panduan (tiap kartu menjelaskan dirinya sendiri)"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
            guideMode
              ? "bg-amber-500/15 text-amber-500"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          }`}
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <span className="w-px h-5 bg-[var(--border)] mx-0.5" />
        <NotificationBell />

        {/* User Account Info & Logout */}
        {user ? (
          <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--border)]">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{user.name}</span>
              <span className="text-[10px] text-amber-400 font-mono leading-tight">{user.roleTitle}</span>
            </div>
            <div
              title={`${user.name} (${user.roleTitle})`}
              className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-[11px] font-bold text-amber-400"
            >
              {user.avatarText}
            </div>
            <button
              onClick={handleLogout}
              title="Keluar / Switch Akun"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

