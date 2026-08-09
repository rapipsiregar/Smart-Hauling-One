/**
 * Hand a generated file to the browser as a download.
 *
 * Uses a Blob object URL rather than a `data:` URI: data URIs are size-capped in
 * several browsers and mangle non-ASCII payloads. The anchor is attached to the
 * DOM because Firefox ignores clicks on detached anchors, and the object URL is
 * released once the download has started.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof document === "undefined") throw new Error("Downloads require a browser");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
