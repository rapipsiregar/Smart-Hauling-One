"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff } from "lucide-react";

const PANEL_WIDTH = 320;
const GAP = 8; // between the bell and the panel
const EDGE = 16; // minimum breathing room from the viewport edge

interface Placement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Header notification bell + dropdown.
 *
 * The panel renders through a portal with fixed positioning rather than as an
 * absolutely-positioned child. The app shell is a scroll-locked flex layout
 * whose containers use `overflow-hidden`, and the header's `glass-panel`
 * backdrop-filter opens its own stacking context — between them an in-flow
 * dropdown gets clipped or painted underneath the page. A portal escapes both,
 * and the measured placement keeps the panel inside the viewport on any width.
 *
 * There is no live notification feed wired to the backend yet, so the panel
 * shows a truthful empty state rather than fabricated alerts.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2);
    // Right-align to the bell, then clamp so it never leaves the viewport.
    const left = Math.max(
      EDGE,
      Math.min(rect.right - width, window.innerWidth - width - EDGE),
    );
    const top = rect.bottom + GAP;
    setPlacement({ top, left, width, maxHeight: window.innerHeight - top - EDGE });
  }, []);

  // Measure before paint so the panel never flashes in the wrong spot.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    // Capture phase: the shell scrolls an inner <main>, not the window.
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
          open
            ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        }`}
      >
        <Bell className="w-4 h-4" />
      </button>

      {/* `open` only ever flips from a click, so this never runs during SSR
          and needs no mounted guard before touching document.body. */}
      {open && placement &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifikasi"
            data-print="hide"
            style={{
              position: "fixed",
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
            className="z-[100] flex flex-col rounded-xl border border-[var(--border)] glass-panel shadow-xl overflow-hidden animate-slide-up"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Notifikasi</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]" />
                Belum ada umpan
              </span>
            </div>

            {/* Scrolls internally, so a long list is never cut off by the viewport. */}
            <div className="overflow-y-auto px-4 py-8 flex flex-col items-center text-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-dim)]">
                <BellOff className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Tidak ada notifikasi</p>
              <p className="text-[11px] text-[var(--text-dim)] leading-relaxed max-w-[220px]">
                Peringatan akan muncul di sini setelah layanan notifikasi terhubung.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
