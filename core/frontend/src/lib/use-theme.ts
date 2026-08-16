"use client";

import { useEffect, useState } from "react";

/**
 * Whether the dark theme is currently on screen.
 *
 * Chart palettes have a *selected* dark step rather than an automatic flip of
 * the light one, so anything drawing data marks has to know which mode is
 * showing — CSS variables cannot answer that from inside JavaScript.
 *
 * Read from the document element, where the theme toggle writes it, and watched
 * so a toggle repaints the marks without a reload. Defaults to dark because
 * that is this app's default surface; a wrong first frame would otherwise flash
 * the light palette against the dark background.
 */
export function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const read = () => {
      const stamped = document.documentElement.getAttribute("data-theme");
      if (stamped === "light") return setDark(false);
      if (stamped === "dark") return setDark(true);
      setDark(!document.documentElement.classList.contains("light"));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return dark;
}
