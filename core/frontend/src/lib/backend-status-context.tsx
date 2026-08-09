"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type BackendStatus = "checking" | "online" | "offline";

interface BackendStatusValue {
  status: BackendStatus;
  recheck: () => void;
}

const BackendStatusContext = createContext<BackendStatusValue>({
  status: "checking",
  recheck: () => {},
});

// Lightweight reachability probe. When the backend is down the Next proxy
// returns a 5xx (ECONNREFUSED), so a non-ok response counts as offline just
// like a thrown network error. Runs once on mount, then on an interval and
// whenever the tab regains focus.
const PROBE_PATH = "/api/performance-kpis";
const PROBE_INTERVAL_MS = 30_000;

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>("checking");

  const check = useCallback(async () => {
    try {
      const res = await fetch(PROBE_PATH, { method: "GET", cache: "no-store" });
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, PROBE_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  return (
    <BackendStatusContext.Provider value={{ status, recheck: check }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  return useContext(BackendStatusContext);
}
