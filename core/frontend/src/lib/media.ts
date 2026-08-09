/**
 * URLs for files the backend serves.
 *
 * The backend mounts its `data/` directory at `/media`, and next.config.ts
 * proxies `/media/*` to it — so a stored path only needs its `data/` prefix
 * traded for `/media/`.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("data/") ? `/media/${path.slice(5)}` : `/media/${path}`;
}

/**
 * Folder inside `data/` where each camera's clips live (`data/01-playlist/gate-a`).
 * Clip records carry only a folder and a filename, so the viewport rebuilds the
 * path from this root.
 */
const PLAYLIST_ROOT = "01-playlist";

/** Playable URL for a raw playlist clip. */
export function clipUrl(folder: string | null | undefined, name: string): string {
  const segments = [PLAYLIST_ROOT, folder || "", name].filter(Boolean);
  return `/media/${segments.map(encodeURIComponent).join("/")}`;
}
