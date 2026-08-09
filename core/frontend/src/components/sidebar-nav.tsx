"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_SECTIONS, UserRole } from "./navigation-data";

interface SidebarNavProps {
  isCollapsed?: boolean;
  onItemClick?: () => void;
}

/**
 * A flat, grouped sidebar: every page is its own row and nothing hides behind
 * an expander. Sections carry a heading when the sidebar is open; when it is
 * collapsed to icons the heading has nowhere to go, so a rule between groups
 * keeps the grouping legible.
 */
export function SidebarNav({ isCollapsed, onItemClick }: SidebarNavProps) {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = React.useState<UserRole>("super_admin");

  React.useEffect(() => {
    const updateRole = () => {
      const saved = localStorage.getItem("sg_active_role") as UserRole;
      if (saved) setActiveRole(saved);
    };
    updateRole();
    window.addEventListener("storage", updateRole);
    return () => window.removeEventListener("storage", updateRole);
  }, []);

  return (
    <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
      {NAV_SECTIONS.map((section, index) => {
        const items = NAV_ITEMS.filter((i) => {
          if (i.section !== section) return false;
          if (!i.roles) return true;
          return i.roles.includes(activeRole);
        });

        if (items.length === 0) return null;

        return (
          <div
            key={section}
            className={`space-y-1 ${
              isCollapsed && index > 0 ? "pt-4 border-t border-[var(--border)]" : ""
            }`}
          >
            {!isCollapsed && (
              <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)] font-mono">
                {section}
              </p>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.match(pathname);

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onItemClick}
                  title={isCollapsed ? item.label : undefined}
                  className={`h-[40px] rounded-lg flex items-center transition-colors duration-150 cursor-pointer ${
                    isCollapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    isActive
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] border-l-[3px] border-[var(--accent)] font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] border-l-[3px] border-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <span className="text-[13px] font-medium leading-none whitespace-nowrap flex-1 truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
