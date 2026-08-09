import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 shadow-xs flex flex-col transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
