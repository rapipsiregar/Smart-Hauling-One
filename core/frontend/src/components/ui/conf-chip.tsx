import React from "react";

interface ConfChipProps {
  confidence: number;
}

export function ConfChip({ confidence }: ConfChipProps) {
  let cardClass = "";
  let dotClass = "";

  if (confidence >= 80) {
    cardClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    dotClass = "bg-emerald-500";
  } else if (confidence >= 50) {
    cardClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    dotClass = "bg-amber-500";
  } else {
    cardClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    dotClass = "bg-rose-500";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cardClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`} />
      {confidence.toFixed(0)}%
    </span>
  );
}
