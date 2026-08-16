import { Camera } from "./types";

/**
 * One gate as the monitoring wall sees it.
 *
 * Built from the camera registry alone. It used to merge in the clip folders the
 * core's test bench processed; that bench now runs on each gate device, because
 * the gate is what detects. The core watches gates and collects what they
 * decided, so a feed here is a camera — not a folder of videos.
 */
export interface GateFeed {
  cameraCode: string;
  cameraName: string;
  gateLocation: string | null;
  status: Camera["status"];
  rtspUrl: string | null;
}

export function buildGateFeeds(cameras: Camera[]): GateFeed[] {
  return cameras.map((camera) => ({
    cameraCode: camera.camera_code,
    cameraName: camera.name || camera.camera_code,
    gateLocation: camera.gate_location,
    status: camera.status,
    rtspUrl: camera.rtsp_url ?? camera.ip_host ?? null,
  }));
}
