"""Draw detection boxes onto a frame for the gate's own screen.

Kept apart from agent/live_view.py on purpose. That module feeds the centre and
is bound by PRD Goal 7's non-goal: the stream leaving this device stays raw, with
no boxes and no hull ids, because its job is to be evidence of what the camera
saw rather than of what the software concluded. This module is the opposite case
-- a technician standing at the gate, on the LAN, asking what the detector is
doing right now. Nothing drawn here is sent upstream.

Frames are downscaled before encoding. The console is a small panel, and a gate
that spends its CPU JPEG-encoding 1080p for a browser is spending it on the wrong
thing.
"""

from __future__ import annotations

# Long edge of the annotated frame. Big enough to read a hull number on a laptop,
# small enough that encoding it never competes with inference.
STREAM_LONG_EDGE = 960
JPEG_QUALITY = 72

_BOX_BGR = (120, 255, 90)      # detection box: green, as in the reference UI
_LABEL_BGR = (16, 20, 24)
_TEXT_BGR = (245, 250, 240)
_CENTER_LINE_BGR = (0, 200, 255)  # amber: the line direction is judged against


def annotate(frame, boxes, *, track_id: int | None = None, label: str | None = None,
             detail: bool = True, scale_to: int = STREAM_LONG_EDGE):
    """Return a downscaled copy of ``frame`` with ``boxes`` drawn on it.

    ``detail`` controls the caption above each box (track id and detection
    score), not the box itself. The green rectangle is always drawn: it is the
    thing an operator is watching for, and it says only "the system is looking
    here". The caption is diagnostic -- a number nobody asked about invites a
    question nobody wanted -- so it is off unless the console asks for it.

    The frame is copied before anything is drawn: the array handed in belongs to
    the capture ring and is read by other threads, so drawing in place would put
    boxes into the crops the recogniser is about to read.
    """
    import cv2

    height, width = frame.shape[:2]
    factor = min(1.0, scale_to / max(width, height)) if scale_to else 1.0
    canvas = (
        cv2.resize(frame, (int(width * factor), int(height * factor)))
        if factor < 1.0 else frame.copy()
    )

    # The virtual line every gate now judges direction against (agent/pipeline.py
    # DetectionWindow.direction): left->right of this line is inbound, the
    # reverse is outbound. Drawn first so a box always renders on top of it.
    canvas_height, canvas_width = canvas.shape[:2]
    line_x = canvas_width // 2
    cv2.line(canvas, (line_x, 0), (line_x, canvas_height), _CENTER_LINE_BGR, 1, cv2.LINE_AA)

    for box in boxes or ():
        x0 = int(box["x0"] * factor)
        y0 = int(box["y0"] * factor)
        x1 = int(box["x1"] * factor)
        y1 = int(box["y1"] * factor)
        cv2.rectangle(canvas, (x0, y0), (x1, y1), _BOX_BGR, 2)

        if not detail:
            continue
        caption = label or (f"T#{track_id}" if track_id is not None else "")
        caption = f"{caption} {box['conf']:.2f}".strip()
        if not caption:
            continue
        (tw, th), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        # Above the box normally, inside it when the box is against the top edge.
        ty = y0 - 6 if y0 - th - 8 >= 0 else y1 + th + 8
        cv2.rectangle(canvas, (x0, ty - th - 5), (x0 + tw + 8, ty + 4), _LABEL_BGR, -1)
        cv2.putText(canvas, caption, (x0 + 4, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                    _TEXT_BGR, 1, cv2.LINE_AA)

    return canvas


def encode(frame, quality: int = JPEG_QUALITY) -> bytes:
    import cv2

    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buffer.tobytes() if ok else b""


def annotated_jpeg(frame, boxes, *, track_id: int | None = None,
                   label: str | None = None, detail: bool = True) -> bytes:
    """The one call the detection loop makes: annotate, downscale, encode."""
    return encode(annotate(frame, boxes, track_id=track_id, label=label, detail=detail))
