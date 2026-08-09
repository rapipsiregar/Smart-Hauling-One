"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import { useGuide } from "@/lib/guide-context";

/** Styled explanation block shown in place of a card's data when guide mode is on. */
export function GuideNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-left w-full">
      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
          {title}
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] font-medium">
          {children}
        </p>
      </div>
    </div>
  );
}

/**
 * Renders `children` normally, but swaps them for a plain-language explanation
 * of the card when guide mode is active. The surrounding card frame is untouched
 * — only the inner content changes.
 */
export function GuideSwap({
  title,
  note,
  children,
}: {
  title: string;
  note: React.ReactNode;
  children: React.ReactNode;
}) {
  const { guideMode } = useGuide();
  if (!guideMode) return <>{children}</>;
  return <GuideNote title={title}>{note}</GuideNote>;
}
