"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface GuideContextType {
  guideMode: boolean;
  toggleGuide: () => void;
  setGuide: (on: boolean) => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [guideMode, setGuideState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sg_guide");
    if (saved === "1") setGuideState(true);
  }, []);

  const setGuide = (on: boolean) => {
    setGuideState(on);
    try {
      localStorage.setItem("sg_guide", on ? "1" : "0");
    } catch {}
  };

  const toggleGuide = () => setGuide(!guideMode);

  return (
    <GuideContext.Provider value={{ guideMode, toggleGuide, setGuide }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error("useGuide must be used within a GuideProvider");
  }
  return context;
}
