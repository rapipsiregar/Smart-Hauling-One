/* App shell: sidebar and header.

   Layout, nav order and labels are taken from the real app screenshots, so a
   viewer who opens the product recognises the same chrome. Built at 1600x980
   and scaled by the panel, which keeps text crisp at any panel size. */

export const SHELL_W = 1600;
export const SHELL_H = 980;

/* Minimal lucide-style glyphs; only the ones the sidebar actually uses. */
const I = {
  video: 'M15 10l4.55-2.28A1 1 0 0121 8.6v6.8a1 1 0 01-1.45.9L15 14M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z',
  layers: 'M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  map: 'M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3zM8 3v15M16 6v15',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.9 1.17V21a2 2 0 11-4 0v-.09A1.65 1.65 0 007 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003 15V3a2 2 0 010 0',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V5a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 19.5z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
};

const svg = (d, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
  `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ` +
  `stroke-linejoin="round"><path d="${d}"/></svg>`;

const NAV = [
  { kind: 'label', text: 'MONITORING RITASE' },
  { kind: 'item', id: 'monitoring', icon: I.video, text: 'Monitoring Ritase', chevron: true },
  { kind: 'sub', id: 'ledger', icon: I.layers, text: 'Buku Lintasan' },
  { kind: 'sub', id: 'inspector', icon: I.activity, text: 'Pemeriksa Lintasan' },
  { kind: 'sub', id: 'history', icon: I.clock, text: 'Riwayat Pembacaan' },
  { kind: 'sub', id: 'fleet', icon: I.truck, text: 'Daftar Nomor Lambung' },
  { kind: 'item', id: 'map', icon: I.map, text: 'Peta Gate' },
  { kind: 'item', id: 'report', icon: I.file, text: 'Laporan Harian & Shift' },
  { kind: 'label', text: 'PENGATURAN' },
  { kind: 'item', id: 'settings', icon: I.gear, text: 'Konfigurasi Sistem' },
];

function nav(active) {
  return NAV.map((n) => {
    if (n.kind === 'label') return `<div class="navlabel">${n.text}</div>`;
    const on = n.id === active ? ' on' : '';
    const cls = n.kind === 'sub' ? 'navsub' : 'navitem';
    const chev = n.chevron
      ? '<span class="chev"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></span>'
      : '';
    return (
      `<div class="${cls}${on}" data-nav="${n.id}">` +
      `<span class="ni">${svg(n.icon, n.kind === 'sub' ? 15 : 17)}</span>` +
      `<span class="nt">${n.text}</span>${chev}</div>`
    );
  }).join('');
}

/* `body` is the page content HTML for the main column. */
export function shell({ title, active, body }) {
  return (
    `<div class="app">` +
      `<aside class="side">` +
        `<div class="brand">` +
          `<div class="bmark">${svg('M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6', 20)}</div>` +
          `<div><div class="bname">SmartGate</div>` +
          `<div class="bsub">Mining Operations</div></div>` +
        `</div>` +
        `<nav class="nav">${nav(active)}</nav>` +
        `<div class="sfoot"><span class="dot"></span>Online</div>` +
      `</aside>` +
      `<div class="main">` +
        `<header class="hdr">` +
          `<div class="htitle">${title}</div>` +
          `<div class="hicons">` +
            `<span>${svg(I.book, 18)}</span><span>${svg(I.sun, 18)}</span>` +
            `<span>${svg(I.search, 18)}</span><span>${svg(I.bell, 18)}</span>` +
            `<span class="avatar">SG</span>` +
          `</div>` +
        `</header>` +
        `<div class="page">${body}</div>` +
      `</div>` +
    `</div>`
  );
}

export { svg, I };
