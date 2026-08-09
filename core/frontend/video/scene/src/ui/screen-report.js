/* Laporan Harian & Shift.

   Mirrors 16-reports-standard.png. The Excel and PDF buttons are the payoff
   of the whole video, so they carry data hooks for act 5 to press them. */

import { shell, svg, I } from './screen-shell.js';
import { GATES } from '../timeline.js';

const KPIS = [
  { label: 'RITASE', value: '2', unit: 'siklus', hint: 'dari 36 lintasan gate', tone: 'acc' },
  { label: 'LINTASAN GATE', value: '36', unit: 'lintasan', hint: 'total pembacaan di semua gate', tone: '' },
  { label: 'BELUM BERPASANGAN', value: '32', unit: 'lintasan', hint: 'perlu ditinjau', tone: 'bad' },
  { label: 'PRESISI OCR', value: '71.2%', unit: '', hint: '31% lintasan terekonsiliasi', tone: 'acc', tag: 'PERLU AUDIT' },
];

const CAL = 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z';
const SHEET = 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13l6 6M15 13l-6 6';

function field(label, value, icon) {
  return (
    `<div class="rf"><div class="label">${label}</div>` +
    `<div class="rfin">${svg(icon, 14)}<span class="mono">${value}</span></div></div>`
  );
}

function bars() {
  const max = Math.max(...GATES.map((g) => g.masuk + g.keluar));
  return GATES.map((g, i) => {
    const total = g.masuk + g.keluar;
    const isIn = g.masuk > 0;
    return (
      `<div class="brow" data-bar="${i}">` +
      `<span class="bname mono">${g.name}</span>` +
      `<span class="btrack"><span class="bfill ${isIn ? 'in' : 'out'}" ` +
      `data-w="${((total / max) * 100).toFixed(1)}"><em>${total}</em></span></span>` +
      `<span class="bval mono">${total}</span></div>`
    );
  }).join('');
}

function detail() {
  return (
    `<div class="dtl">` +
    `<div class="dhrow label"><span>GATE</span><span>MASUK</span>` +
    `<span>KELUAR</span><span>PORSI</span></div>` +
    GATES.map(
      (g, i) =>
        `<div class="dtrow mono" data-dt="${i}"><span>${g.name}</span>` +
        `<span class="${g.masuk ? 'ok' : 'dim'}">${g.masuk}</span>` +
        `<span class="${g.keluar ? 'acc' : 'dim'}">${g.keluar}</span>` +
        `<span class="sec">${g.porsi}%</span></div>`
    ).join('') +
    `<div class="dtnote mono">Semua angka terukur dari hasil deteksi nyata ` +
    `(run 2026-07-19, model pak-shomad-v1.pt). Ritase dihitung dari pasangan ` +
    `IN + OUT per nomor lambung.</div></div>`
  );
}

export function reportScreen() {
  const body =
    `<div class="card rbanner">` +
    `<div class="rbhead">${svg(I.file, 19)}<b>LAPORAN RITASE HARIAN & SHIFT</b></div>` +
    `<div class="rbsub mono">Susun laporan akhir shift, tinjau lintasan yang belum ` +
    `berpasangan, dan ekspor ke Excel atau PDF untuk audit ritase.</div></div>` +

    `<div class="card rmain">` +
    `<div class="rhead"><div><div class="label acc">${svg(I.file, 12)} LAPORAN RITASE</div>` +
    `<div class="rtitle mono">LAPORAN AKHIR SHIFT</div></div>` +
    `<div class="rtabs">` +
    ['SHIFT SIANG', 'SHIFT MALAM', 'KUSTOM']
      .map((s, i) => `<span class="rtab mono${i === 0 ? ' on' : ''}">${s}</span>`)
      .join('') +
    `</div></div>` +

    `<div class="rnote"><div class="rnh">${svg(I.clock, 14)}<b class="mono">WAKTU LINTASAN BELUM TERSEDIA</b></div>` +
    `<div class="rnb">Data deteksi saat ini belum memuat waktu lintasan per truk, jadi ` +
    `jendela shift di bawah hanya menjadi keterangan pada berkas ekspor, bukan penyaring data. ` +
    `Ritase dipasangkan dengan menghitung IN dan OUT per nomor lambung.</div></div>` +

    `<div class="rfields">` +
    field('TANGGAL SHIFT', '07/19/2026', CAL) +
    field('JAM MULAI', '07:00 AM', I.clock) +
    field('JAM SELESAI', '07:00 PM', I.clock) +
    `<div class="rbtns">` +
    `<span class="rbtn" data-btn="excel">${svg(SHEET, 15)} Excel</span>` +
    `<span class="rbtn pri" data-btn="pdf">${svg(I.file, 15)} PDF</span>` +
    `</div></div>` +
    `<div class="rwin mono">Panjang jendela: 12 jam</div>` +

    `<div class="rkpis">` +
    KPIS.map(
      (k, i) =>
        `<div class="rk" data-rk="${i}"><div class="label">${k.label}</div>` +
        `<div class="rkv"><b class="mono ${k.tone}">${k.value}</b>` +
        `<span>${k.unit}</span>` +
        (k.tag ? `<em class="rtag mono">${k.tag}</em>` : '') +
        `</div><div class="rkh mono">${k.hint}</div></div>`
    ).join('') +
    `</div>` +

    `<div class="rcols">` +
    `<div class="rcard"><div class="label">LINTASAN PER GATE</div>` +
    `<div class="bars">${bars()}</div>` +
    `<div class="blegend mono"><span><i class="in"></i>Masuk</span>` +
    `<span><i class="out"></i>Keluar</span></div></div>` +
    `<div class="rcard"><div class="label">RINCIAN PER GATE</div>${detail()}</div>` +
    `</div>` +

    `<div class="rfoot"><span class="rfl">${svg('M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', 14)}` +
    `<b class="mono">BELUM BERPASANGAN</b>` +
    `<em>32 lintasan · 13 masuk belum keluar, 14 keluar belum masuk, 5 nomor lambung tidak terbaca</em></span>` +
    `<span class="rfa">${svg('M9 6l6 6-6 6', 15)}</span></div>` +
    `</div>`;

  return shell({ title: 'Laporan Harian & Shift', active: 'report', body });
}
