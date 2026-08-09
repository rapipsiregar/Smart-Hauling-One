/* Volumetric brand glow.

   A fullscreen fragment shader standing in for the reference's big soft
   radial light. A CSS radial-gradient could fake the still frame, but not the
   slow internal churn: the reference's glow visibly breathes and drifts, and
   flat gradients also band badly once h264 quantises them. Domain-warped fbm
   plus a dither in the final line solves both. */

import * as THREE from '../../vendor/three.module.js';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uAspect;
  uniform vec3  uAccent;
  uniform vec3  uBase;
  uniform float uIntensity;
  uniform float uTheme;    // 0 = dark, 1 = light
  uniform vec2  uFocus;    // glow centre in uv space
  uniform float uSpread;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv - uFocus;
    p.x *= uAspect;

    // Domain warp so the light body churns instead of pulsing uniformly.
    vec2 w = vec2(
      fbm(p * 1.7 + vec2(0.0, uTime * 0.045)),
      fbm(p * 1.7 + vec2(5.2, uTime * 0.038 + 1.3))
    );
    float d = length(p + (w - 0.5) * 0.42);

    float core = exp(-d * d / max(uSpread, 0.0001));
    // Tight halo. A wide one reads as a flat wash rather than a light source.
    float halo = exp(-d * 2.2) * 0.3;
    float body = clamp(core + halo, 0.0, 1.0);

    // Two slow secondary blobs give the field parallax of its own.
    vec2 b1 = vec2(sin(uTime * 0.07) * 0.34 - 0.32, cos(uTime * 0.055) * 0.2 + 0.28);
    vec2 b2 = vec2(cos(uTime * 0.045) * 0.3 + 0.38, sin(uTime * 0.062) * 0.24 - 0.22);
    float g1 = exp(-length(p - b1) * 3.1) * 0.34;
    float g2 = exp(-length(p - b2) * 3.6) * 0.26;

    float lift = fbm(p * 2.4 + uTime * 0.03) * 0.1;

    // Every contribution scales with uIntensity. The secondary blobs used to
    // sit outside this multiply, so the field stayed bright no matter what the
    // act asked for and the dark acts washed out to flat orange.
    float amt = clamp((body + g1 + g2 + lift * body) * uIntensity, 0.0, 1.2);

    vec3 col = uBase + uAccent * amt;

    // The light act lifts toward a warm cream instead of adding saturated
    // accent, which would grey out against a near-white background.
    vec3 lightCol = uBase + vec3(0.17, 0.105, 0.02) * amt;
    col = mix(col, lightCol, uTheme);

    // Ordered dither: kills the banding h264 would otherwise amplify.
    float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col + dither, 1.0);
  }
`;

export function createGlow(aspect) {
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: aspect },
    uAccent: { value: new THREE.Color(0xf59e0b) },
    uBase: { value: new THREE.Color(0x07090d) },
    uIntensity: { value: 0.16 },
    uTheme: { value: 0 },
    uFocus: { value: new THREE.Vector2(0.5, 0.56) },
    uSpread: { value: 0.34 },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
  );
  mesh.frustumCulled = false;

  return { mesh, uniforms };
}
