/* Atmospheric dust.

   Slow additive motes at varying depth. They do two jobs: give the empty
   background parallax during the long type-on holds, and read as airborne
   dust in the pit, which suits a mining site. Positions come from a seeded
   PRNG so every render of frame N is identical. */

import * as THREE from '../../vendor/three.module.js';

const COUNT = 700;

/* Mulberry32: small, fast, and reproducible across runs. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDrift;

  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Each mote rises on its own slow loop and sways laterally.
    float span = 34.0;
    p.y = mod(p.y + uTime * aSpeed * uDrift + aSeed * span, span) - span * 0.5;
    p.x += sin(uTime * 0.12 * aSpeed + aSeed * 6.28) * 1.1;
    p.z += cos(uTime * 0.09 * aSpeed + aSeed * 3.14) * 0.8;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (36.0 / max(-mv.z, 0.001));

    // Fade with distance, and hard-fade the very near ones so nothing pops
    // as it crosses the near plane.
    float dist = -mv.z;
    vAlpha = smoothstep(46.0, 16.0, dist) * smoothstep(2.0, 7.0, dist);
  }
`;

const frag = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    // Soft round falloff; discard outside the disc to avoid square artefacts.
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 2.4);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;

export function createDust() {
  const rand = rng(20260726);

  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 0] = (rand() - 0.5) * 62;
    pos[i * 3 + 1] = (rand() - 0.5) * 34;
    pos[i * 3 + 2] = -6 - rand() * 38;
    // A few larger, closer motes carry the depth read; the rest stay fine.
    size[i] = rand() < 0.12 ? 2.6 + rand() * 2.4 : 0.7 + rand() * 1.2;
    seed[i] = rand();
    speed[i] = 0.25 + rand() * 0.85;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uColor: { value: new THREE.Color(0xffd79a) },
    uOpacity: { value: 0.5 },
    uDrift: { value: 1 },
  };

  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  points.frustumCulled = false;

  return { points, uniforms };
}
