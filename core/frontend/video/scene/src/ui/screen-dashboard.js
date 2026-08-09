/* Monitoring Ritase dashboard.

   Mirrors the real page: three KPI tiles, the gate filter strip, then the OCR
   Detections list beside the OCR Inspection HUD. Rows carry data-row indexes
   so acts can stagger them in individually. */

import { shell, svg, I } from './screen-shell.js';
import { DETECTIONS, FRAME_READS } from '../timeline.js';

const KPIS = [
  { label: 'LINTASAN GATE', value: '36', unit: 'lintasan', hint: 'Buka buku lintasan', icon: I.layers },
  { label: 'NOMOR LAMBUNG TERBACA', value: '30', unit: 'unit', hint: 'Lihat daftar nomor lambung', icon: I.truck },
  { label: 'GAGAL TERBACA', value: '5', unit: 'perlu ditinjau', hint: 'Selesaikan pembacaan gagal', icon: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', bad: true },
];

const GATES = ['SEMUA', 'CK Gate A', 'CK Gate B', 'CK Gate C', 'CK Gate D'];

function kpis() {
  return (
    `<div class="kpirow">` +
    KPIS.map(
      (k, i) =>
        `<div class="card kpi" data-kpi="${i}">` +
        `<div class="label">${k.label}</div>` +
        `<div class="kval"><b data-count="${k.value}">${k.value}</b>` +
        `<span class="mono">${k.unit}</span></div>` +
        `<div class="khint mono">${k.hint}</div>` +
        `<div class="kicon ${k.bad ? 'bad' : ''}">${svg(k.icon, 22)}</div>` +
        `</div>`
    ).join('') +
    `</div>`
  );
}

function filterBar() {
  return (
    `<div class="card fbar">` +
    `<span class="ficon">${svg(I.video, 17)}</span>` +
    `<span class="ftitle mono">ALIRAN PEMBACAAN GATE</span>` +
    `<span class="fbtn mono">${svg(I.clock, 12)} RIWAYAT</span>` +
    `<span class="fgates">` +
    GATES.map(
      (g, i) => `<span class="fg mono${i === 0 ? ' on' : ''}">${g}</span>`
    ).join('') +
    `</span></div>`
  );
}

function detectionRow(d, i) {
  const cls = d.conf >= 80 ? 'g' : d.conf >= 50 ? 'a' : 'r';
  const ok = d.conf > 0;
  return (
    `<div class="drow" data-row="${i}">` +
    `<span class="dmark ${ok ? 'ok' : 'warn'}">` +
    svg(ok ? 'M22 11.1V12a10 10 0 11-5.9-9.1M22 4l-10 10-3-3' : 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', 17) +
    `</span>` +
    `<span class="dbody">` +
    `<span class="dtop"><b class="mono">${d.hull}</b>` +
    `<em class="mono">CAM-GATE-${d.gate.slice(-1)}</em></span>` +
    `<span class="dsub">${d.gate} · ${d.reads} OCR reads · ${d.frames} frames</span>` +
    `</span>` +
    `<span class="chip ${cls}"><i></i>${d.conf}%</span>` +
    `</div>`
  );
}

function hud() {
  return (
    `<div class="card hud">` +
    `<div class="hudhead">` +
    `<span class="hh">${svg('M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2', 16)}` +
    `<b>OCR Inspection HUD</b></span>` +
    `<span class="hstat chip g" data-hudstat><i></i>Consistent</span>` +
    `</div>` +
    `<div class="plate hplate">` +
    `<div class="label">VOTED HULL ID</div>` +
    `<div class="hullid mono" data-hull>830E</div>` +
    `<div class="hconf mono" data-conf>29.7% vote confidence</div>` +
    `</div>` +
    `<div class="hstats">` +
    `<div class="hs" data-hs="0"><b class="mono">259</b><span class="label">FRAMES</span></div>` +
    `<div class="hs" data-hs="1"><b class="mono">98</b><span class="label">OCR READS</span></div>` +
    `<div class="hs" data-hs="2"><b class="mono">67%</b><span class="label">DET. CONF</span></div>` +
    `</div>` +
    `<div class="hreadlbl">${svg(I.layers, 13)} Frame reads (0/12 agree)</div>` +
    `<div class="hreads">` +
    FRAME_READS.map(
      (r, i) => `<span class="hr mono" data-read="${i}">${r}</span>`
    ).join('') +
    `</div>` +
    `<div class="hfoot mono"><span>MODEL: pak-shomad-v1.pt</span><span>CK Gate A</span></div>` +
    `</div>`
  );
}

export function dashboardScreen() {
  const body =
    kpis() +
    filterBar() +
    `<div class="dashcols">` +
    `<div class="card dlist">` +
    `<div class="dhead"><span class="dh">` +
    svg('M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2', 16) +
    `<b>OCR Detections</b></span><span class="label">36 READS</span></div>` +
    `<div class="drows">${DETECTIONS.map(detectionRow).join('')}</div>` +
    `</div>` +
    hud() +
    `</div>`;

  return shell({ title: 'Monitoring Ritase', active: 'monitoring', body });
}
