/* WebGL layer.

   Two passes over one canvas: an orthographic fullscreen glow, then a
   perspective pass for dust and outro strokes. autoClear is off after the
   first pass so the perspective content composites onto the glow. */

import * as THREE from '../../vendor/three.module.js';
import { createGlow } from './glow.js';
import { createDust } from './dust.js';
import { createLines } from './lines.js';

const DARK = new THREE.Color(0x07090d);
const LIGHT = new THREE.Color(0xeef1f6);
const ACCENT_DARK = new THREE.Color(0xf59e0b);
const ACCENT_LIGHT = new THREE.Color(0xea8a04);
const DUST_DARK = new THREE.Color(0xffd79a);
const DUST_LIGHT = new THREE.Color(0xb98a3a);

export class GL {
  constructor(canvas, width, height) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      // Required: Puppeteer screenshots read the composited surface, and
      // without this the buffer can already be cleared by capture time.
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(DARK, 1);
    this.renderer.autoClear = false;

    // Pass 1: fullscreen glow.
    this.glowScene = new THREE.Scene();
    this.glowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.glow = createGlow(width / height);
    this.glowScene.add(this.glow.mesh);

    // Pass 2: perspective atmosphere.
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    this.camera.position.set(0, 0, 18);

    this.dust = createDust();
    this.scene.add(this.dust.points);

    this.lines = createLines();
    this.scene.add(this.lines.group);

    this._c = new THREE.Color();
  }

  /* `s` is the per-frame state produced by the director:
     { t, theme, glow, focusX, focusY, spread, dust, camX, camY, camZ,
       lines, linesOpacity } */
  update(s) {
    const th = s.theme ?? 0;

    // Glow uniforms.
    const gu = this.glow.uniforms;
    gu.uTime.value = s.t;
    gu.uTheme.value = th;
    gu.uIntensity.value = s.glow ?? 0.16;
    gu.uSpread.value = s.spread ?? 0.34;
    gu.uFocus.value.set(s.focusX ?? 0.5, s.focusY ?? 0.56);
    gu.uBase.value.copy(this._c.copy(DARK).lerp(LIGHT, th));
    gu.uAccent.value.copy(this._c.copy(ACCENT_DARK).lerp(ACCENT_LIGHT, th));

    // Dust.
    const du = this.dust.uniforms;
    du.uTime.value = s.t;
    du.uOpacity.value = s.dust ?? 0.5;
    du.uDrift.value = s.dustDrift ?? 1;
    du.uColor.value.copy(this._c.copy(DUST_DARK).lerp(DUST_LIGHT, th));

    // Camera drift is shared with the DOM layer so both move together.
    this.camera.position.set(s.camX ?? 0, s.camY ?? 0, s.camZ ?? 18);
    this.camera.lookAt(0, 0, 0);

    this.lines.update(s.lines ?? 0, s.linesOpacity ?? 0);
  }

  render() {
    this.renderer.clear();
    this.renderer.render(this.glowScene, this.glowCam);
    this.renderer.render(this.scene, this.camera);
  }
}
