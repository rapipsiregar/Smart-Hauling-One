/* 3D panel wrapper.

   Every recreated screen is real DOM living inside a CSS `perspective`
   container, not a texture. That is deliberate: text stays vector-crisp at
   1080p and each row can animate independently, which is exactly how the
   reference's tilted UI panels behave. */

const NUM = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

export class Panel {
  /* `content` is an element or an HTML string. */
  constructor(content, opts = {}) {
    this.el = document.createElement('div');
    this.el.className = `panel ${opts.className || ''}`.trim();

    if (typeof content === 'string') this.el.innerHTML = content;
    else if (content) this.el.appendChild(content);

    const { w = 900, h = 560, origin = '50% 50%' } = opts;
    this.w = w;
    this.h = h;

    Object.assign(this.el.style, {
      width: `${w}px`,
      height: `${h}px`,
      // Panels are positioned from their own centre so rotations pivot
      // sensibly and x/y read as "offset from frame centre".
      left: '50%',
      top: '50%',
      marginLeft: `${-w / 2}px`,
      marginTop: `${-h / 2}px`,
      transformOrigin: origin,
      opacity: '0',
    });

    this.hidden = true;
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }

  query(sel) {
    return this.el.querySelector(sel);
  }

  queryAll(sel) {
    return Array.from(this.el.querySelectorAll(sel));
  }

  /* Writes one frame of transform state. Omitted fields fall back to rest. */
  set(s = {}) {
    const o = NUM(s.opacity, 1);

    // Skipping layout work for invisible panels keeps the frame budget down;
    // there are enough panels that leaving them all live costs real time.
    if (o <= 0.001) {
      if (!this.hidden) {
        this.el.style.opacity = '0';
        this.el.style.visibility = 'hidden';
        this.hidden = true;
      }
      return;
    }
    if (this.hidden) {
      this.el.style.visibility = 'visible';
      this.hidden = false;
    }

    const x = NUM(s.x);
    const y = NUM(s.y);
    const z = NUM(s.z);
    const rx = NUM(s.rx);
    const ry = NUM(s.ry);
    const rz = NUM(s.rz);
    const sc = NUM(s.scale, 1);
    const blur = NUM(s.blur);
    const bright = NUM(s.brightness, 1);

    this.el.style.opacity = `${o}`;
    this.el.style.transform =
      `translate3d(${x}px, ${y}px, ${z}px) ` +
      `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) ` +
      `scale(${sc})`;

    // Depth-of-field and dimming are the two cues that sell layering; the
    // reference leans on both heavily for its background cards.
    const filters = [];
    if (blur > 0.01) filters.push(`blur(${blur}px)`);
    if (Math.abs(bright - 1) > 0.01) filters.push(`brightness(${bright})`);
    this.el.style.filter = filters.length ? filters.join(' ') : 'none';
  }
}

/* Builds a panel from an HTML string with the standard glass treatment. */
export function glassPanel(html, opts = {}) {
  return new Panel(html, {
    ...opts,
    className: `glass ${opts.className || ''}`.trim(),
  });
}
