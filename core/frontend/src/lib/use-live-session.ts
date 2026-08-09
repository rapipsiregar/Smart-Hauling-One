"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { ApiError, api, isEndpointMissing } from "@/lib/api-client";
import { connectWhep, WhepConnection } from "@/lib/whep";

/** Keep-alive cadence; the server ends a session after ~20s of silence. */
const HEARTBEAT_MS = 10_000;

/**
 * How long to wait for actual media before calling the device unreachable.
 * A session against an offline device returns 200 and never streams
 * (API_CONTRACT §2.4), so this timeout is the only way to tell the two apart —
 * and the spec is explicit that the UI must not spin forever instead.
 */
const MEDIA_TIMEOUT_MS = 8_000;

export type LiveState =
  | "starting"
  | "connecting"
  | "live"
  | "unreachable"
  | "unsupported"
  | "error";

/**
 * Drives one gate's live-view session end to end: open it, negotiate WHEP into
 * `videoRef`, keep it alive, and close it on the way out.
 *
 * Raw feed only — this hook never receives, requests, or renders detection data.
 */
export function useLiveSession(cameraCode: string, videoRef: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<LiveState>("starting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const connRef = useRef<WhepConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let mediaTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let activeSession: string | null = null;

    const stopSession = () => {
      connRef.current?.close();
      connRef.current = null;
      if (activeSession) {
        // Fire-and-forget: an unclean exit is covered by the server's own
        // stale-session timeout, so this is politeness, not a guarantee.
        api.stopLiveSession(cameraCode, activeSession).catch(() => {});
        activeSession = null;
      }
    };

    const onPageHide = () => stopSession();

    (async () => {
      setState("starting");
      setMessage(null);

      let session;
      try {
        session = await api.startLiveSession(cameraCode);
      } catch (err) {
        if (cancelled) return;
        if (isEndpointMissing(err)) { setState("unsupported"); return; }
        setState("error");
        setMessage(
          err instanceof ApiError
            ? err.serverMessage ?? `Gagal membuka sesi (${err.status})`
            : "Gagal membuka sesi — backend tidak terjangkau.",
        );
        return;
      }
      if (cancelled) {
        api.stopLiveSession(cameraCode, session.session_id).catch(() => {});
        return;
      }

      activeSession = session.session_id;
      setSessionId(session.session_id);
      setState("connecting");

      heartbeat = setInterval(() => {
        if (activeSession) api.liveSessionHeartbeat(cameraCode, activeSession).catch(() => {});
      }, HEARTBEAT_MS);
      window.addEventListener("pagehide", onPageHide);

      // The edge only starts pushing once its long-poll delivers the start
      // command, so no media by now means it is not going to arrive.
      mediaTimer = setTimeout(() => {
        if (!cancelled) setState((s) => (s === "live" ? s : "unreachable"));
      }, MEDIA_TIMEOUT_MS);

      const video = videoRef.current;
      if (!video) return;

      try {
        connRef.current = await connectWhep(session.whep_url, video, () => {
          if (!cancelled) {
            clearTimeout(mediaTimer);
            setState("live");
          }
        });
      } catch (err) {
        if (cancelled) return;
        clearTimeout(mediaTimer);
        setState("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(mediaTimer);
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      stopSession();
    };
  }, [cameraCode, videoRef, attempt]);

  return {
    state,
    sessionId,
    message,
    /** Tear the session down and open a fresh one. */
    retry: () => setAttempt((a) => a + 1),
  };
}
