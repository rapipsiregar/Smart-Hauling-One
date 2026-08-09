/**
 * Minimal WHEP client — WebRTC-HTTP Egress Protocol.
 *
 * The backend spec (SRS §8.1) leaves the player to the frontend, and the whole
 * protocol is: POST an SDP offer to the resource URL as `application/sdp`, get
 * an SDP answer back, apply it. That is small enough that a dependency would
 * cost more than it saves, and it keeps the media path free of third-party code.
 *
 * This carries **raw camera video only** — never detection overlays
 * (`docs/edge-system/PRD.md` Goal 7). There is nothing to annotate here.
 */

export interface WhepConnection {
  pc: RTCPeerConnection;
  /** Tears down the peer connection and releases the server-side resource. */
  close: () => void;
}

/** Give up waiting for ICE candidates; whatever we have is offered as-is. */
const ICE_GATHER_TIMEOUT_MS = 2_000;

/**
 * Trickle ICE would need a second signalling channel this contract doesn't
 * define, so the offer is sent once, complete. Waiting forever for gathering
 * to finish would hang on networks where one candidate type never resolves —
 * hence the timeout, after which the candidates collected so far are good
 * enough (the TURN relay in SRS §8.1 is the fallback path anyway).
 */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => { if (pc.iceGatheringState === "complete") done(); };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

/**
 * Negotiates playback of `whepUrl` into `video`.
 *
 * Resolves once the answer is applied — which means negotiation succeeded, not
 * that frames are flowing. A session opened against an offline device answers
 * normally and then simply never sends media (API_CONTRACT §2.4), so the caller
 * decides how long to wait for an actual track before declaring the device
 * unreachable.
 */
export async function connectWhep(
  whepUrl: string,
  video: HTMLVideoElement,
  onTrack?: () => void,
): Promise<WhepConnection> {
  const pc = new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: "max-bundle",
  });

  // Receive-only: the browser is a viewer, it never publishes to the gate.
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        /* autoplay policy — the muted player normally satisfies it */
      });
    }
    onTrack?.();
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);

  const res = await fetch(whepUrl, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp ?? offer.sdp ?? "",
  });

  if (!res.ok) {
    pc.close();
    throw new Error(`WHEP negotiation failed: ${res.status} ${res.statusText}`);
  }

  // The relay returns the session resource here; DELETE-ing it on teardown is
  // what stops the relay pushing to a viewer that has gone away.
  const resourceUrl = resolveResource(res.headers.get("Location"), whepUrl);
  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  return {
    pc,
    close: () => {
      if (resourceUrl) {
        // Best-effort: the session also times out server-side (SRS §8.3), so a
        // failed DELETE delays cleanup rather than leaking it.
        fetch(resourceUrl, { method: "DELETE", keepalive: true }).catch(() => {});
      }
      pc.close();
      video.srcObject = null;
    },
  };
}

function resolveResource(location: string | null, base: string): string | null {
  if (!location) return null;
  try {
    return new URL(location, base).toString();
  } catch {
    return null;
  }
}
