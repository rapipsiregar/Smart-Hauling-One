"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mountain, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { TopHeader } from "./top-header";
import { useBackendStatus, BackendStatus } from "@/lib/backend-status-context";
import { useAuth } from "@/lib/auth-context";

const STATUS_META: Record<BackendStatus, { dot: string; label: string; pulse?: boolean }> = {
  online: { dot: "bg-emerald-500", label: "Terhubung" },
  offline: { dot: "bg-rose-500", label: "Terputus" },
  checking: { dot: "bg-amber-500", label: "Menghubungkan…", pulse: true },
};

function ConnectionStatus({ collapsed }: { collapsed?: boolean }) {
  const { status } = useBackendStatus();
  const meta = STATUS_META[status];
  if (collapsed) {
    return <div className={`w-2 h-2 rounded-full ${meta.dot} my-1 ${meta.pulse ? "animate-pulse" : ""}`} title={meta.label} />;
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${meta.dot} shrink-0 ${meta.pulse ? "animate-pulse" : ""}`} />
      <span className="text-[12px] text-[var(--text-secondary)] font-medium">{meta.label}</span>
    </div>
  );
}

const Brand = ({ isCollapsed }: { isCollapsed?: boolean }) => (
  <Link
    href="/"
    className={`h-[56px] flex items-center border-b border-[var(--border)] shrink-0 transition-colors duration-150 cursor-pointer ${
      isCollapsed ? "justify-center px-2" : "gap-3 px-4"
    }`}
  >
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-xs">
      <Mountain className="w-4 h-4 text-slate-950 stroke-[2.5]" />
    </div>
    {!isCollapsed && (
      <div className="flex flex-col min-w-0">
        <span className="font-sans font-semibold text-[13px] text-[var(--text-primary)] leading-tight tracking-normal truncate">
          Smart Hauling
        </span>
        <span className="text-[10px] text-[var(--text-dim)] leading-tight font-normal truncate">
          Mining Operations
        </span>
      </div>
    )}
  </Link>
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sg_sidebar_collapsed") === "1";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, isLoading, pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (isLoading || !user) {
    return (
      <div
        className="h-full flex items-center justify-center font-mono text-xs"
        style={{ backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: "var(--accent)" }} />
          Memuat Sesi Pengguna ISHS...
        </div>
      </div>
    );
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sg_sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const desktopWidth = collapsed ? "w-[72px]" : "w-[260px]";

  return (
    <div className="h-full flex text-[var(--text-primary)] overflow-hidden" data-print="shell">
      {/* Desktop Sidebar */}
      <aside
        data-print="hide"
        className={`hidden md:flex ${desktopWidth} shrink-0 flex-col glass-panel border-r border-[var(--border)] transition-[width] duration-150 ease-out`}
      >
        <Brand isCollapsed={collapsed} />
        <SidebarNav isCollapsed={collapsed} />

        <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <ConnectionStatus collapsed />
              <button
                onClick={toggleCollapsed}
                title="Expand sidebar"
                className="w-[40px] h-[40px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1">
              <ConnectionStatus />
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" data-print="hide">
          <div
            className="absolute inset-0 bg-black/60 transition-opacity duration-150 cursor-pointer"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[260px] h-full flex flex-col glass-panel border-r border-[var(--border)] shadow-xl z-10">
            <div className="flex items-center justify-between h-[56px] border-b border-[var(--border)] pr-3">
              <Brand isCollapsed={false} />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav isCollapsed={false} onItemClick={() => setMobileOpen(false)} />
            <div className="p-3 border-t border-[var(--border)] flex items-center justify-between">
              <div className="px-1">
                <ConnectionStatus />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden" data-print="shell">
        <TopHeader onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6" data-print="main">
          <div className="max-w-[1400px] mx-auto w-full" data-print="shell">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
