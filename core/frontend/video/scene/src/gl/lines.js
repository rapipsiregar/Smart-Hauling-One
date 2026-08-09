/* Outro line-art.

   The reference closes on thin brand-coloured curves sweeping across a light
   field before the logo resolves. These are drawn progressively with
   setDrawRange, which gives a true "drawing on" stroke rather than a fade. */

import * as THREE from '../../vendor/three.module.js';

const SEGMENTS = 260;

/* Long, lazy arcs that read as contour lines on a pit wall. */
const CURVES = [
  [[-34, -14, -12], [-12, 2, -10], [8, -6, -9], [30, 10, -11]],
  [[-32, 10, -14], [-8, -4, -12], [14, 8, -11], [34, -2, -13]],
  [[-30, -2, -9], [-6, 12, -8], [16, -10, -7], [32, 4, -9]],
  [[-28, 16, -16], [-4, 6, -15], [18, 14, -14], [33, 2, -16]],
  [[-33, -18, -11], [-14, -8, -10], [10, -16, -10], [31, -6, -12]],
];

function buildCurve(pts) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.5
  );
  const sampled = curve.getPoints(SEGMENTS);
  const arr = new Float32Array((SEGMENTS + 1) * 3);
  sampled.forEach((p, i) => {
    arr[i * 3 + 0] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.setDrawRange(0, 0);
  return geo;
}

export function createLines() {
  const group = new THREE.Group();
  const materials = [];

  CURVES.forEach((pts, i) => {
    const mat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(buildCurve(pts), mat);
    line.frustumCulled = false;
    line.userData.index = i;
    group.add(line);
    materials.push(mat);
  });

  group.visible = false;

  /* `p` 0..1 draws the strokes on, staggered; `opacity` scales them all. */
  function update(p, opacity) {
    group.visible = opacity > 0.001;
    if (!group.visible) return;

    group.children.forEach((line, i) => {
      // Stagger so the strokes chase each other rather than arriving together.
      const offset = i * 0.09;
      const local = Math.max(0, Math.min(1, (p - offset) / (1 - offset || 1)));
      const count = Math.floor(local * (SEGMENTS + 1));
      line.geometry.setDrawRange(0, count);
      // Trailing strokes sit progressively fainter, giving the fan depth.
      materials[i].opacity = opacity * (0.5 - i * 0.06) * (local > 0 ? 1 : 0);
    });
  }

  return { group, update };
}
