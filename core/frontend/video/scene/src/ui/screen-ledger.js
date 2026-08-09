/* Buku Lintasan (crossing ledger).

   Mirrors 03-ledger-standard.png: search + filter strip above a table whose
   rightmost column carries the reconciliation state. Act 5 flips rows from
   "Locked - needs review" to "Auto-matched" one at a time, which is the whole
   point of the screen. */

import { shell, svg, I } from './screen-shell.js';

const ROWS = [
  { hull: '830E', gate: 'A', dir: 'IN', reads: 98, conf: 30, matched: false },
  { hull: '299', gate: 'A', dir: 'IN', reads: 22, conf: 100, matched: true },
  { hull: '5600', gate: 'A', dir: 'IN', reads: 51, conf: 98, matched: true },
  { hull: '133', gate: 'A', dir: 'IN', reads: 21, conf: 95, matched: true },
  { hull: 'F375', gate: 'A', dir: 'IN', reads: 181, conf: 67, matched: false },
  { hull: '93', gate: 'A', dir: 'IN', reads: 211, conf: 82, matched: false },
  { hull: '460', gate: 'A', dir: 'IN', reads: 61, conf: 90, matched: false },
  { hull: 'F8724', gate: 'C', dir: 'IN', reads: 32, conf: 15, matched: false },
  { hull: '013', gate: 'C', dir: 'IN', reads: 32, conf: 100, matched: true },
  { hull: '04', gate: 'C', dir: 'IN', reads: 28, conf: 74, matched: false },
  { hull: '308', gate: 'A', dir: 'IN', reads: 60, conf: 98, matched: true },
  { hull: '9805', gate: 'C', dir: 'IN', reads: 17, conf: 24, matched: false },
];

const LOCK = 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4';
const CHECK = 'M9 12l2 2 4-4M12 3l7.8 3.5v5c0 4.6-3.2 8.9-7.8 10-4.6-1.1-7.8-5.4-7.8-10v-5z';

function row(r, i) {
  const cls = r.conf >= 80 ? 'g' : r.conf >= 50 ? 'a' : 'r';
  return (
    `<div class="lrow" data-lrow="${i}">` +
    `<span class="lhull mono">${r.hull}</span>` +
    `<span class="lgate"><b>CK Gate ${r.gate}</b><em class="mono">CAM-GATE-${r.gate}</em></span>` +
    `<span class="ldir mono">${r.dir}</span>` +
    `<span class="lreads mono">${r.reads}</span>` +
    `<span class="lconf"><span class="chip ${cls}"><i></i>${r.conf}%</span></span>` +
    `<span class="lrec ${r.matched ? 'ok' : 'lock'}" data-rec="${i}">` +
    `${svg(r.matched ? CHECK : LOCK, 13)}` +
    `<em>${r.matched ? 'Auto-matched' : 'Locked — needs review'}</em></span>` +
    `<span class="larr">${svg('M5 12h14M13 6l6 6-6 6', 15)}</span>` +
    `</div>`
  );
}

export function ledgerScreen() {
  const body =
    `<div class="card lbar">` +
    `<span class="lsearch">${svg(I.search, 15)}<em>Search hull ID…</em></span>` +
    `<span class="lsegs">` +
    ['All', 'Reconciled', 'Unresolved']
      .map((s, i) => `<span class="lseg${i === 0 ? ' on' : ''}">${s}</span>`)
      .join('') +
    `</span>` +
    `<span class="lcam">${svg(I.video, 14)}</span>` +
    `<span class="lsel">All cameras<em>▾</em></span>` +
    `<span class="lcount" data-lcount>${svg(CHECK, 14)} 11/36 reconciled</span>` +
    `</div>` +
    `<div class="card ltable">` +
    `<div class="lhead">` +
    `<span>Hull ID</span><span>Camera / Gate</span><span>Dir</span>` +
    `<span>OCR Reads</span><span>Confidence</span><span>Reconciliation</span><span></span>` +
    `</div>` +
    `<div class="lrows">${ROWS.map(row).join('')}</div>` +
    `</div>`;

  return shell({ title: 'Buku Lintasan', active: 'ledger', body });
}

export const LEDGER_ROWS = ROWS;
