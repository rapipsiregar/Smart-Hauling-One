/* Ledger styling, traced from 03-ledger-standard.png. Column template is
   shared between the header and the rows so they stay aligned. */

export const LEDGER_CSS = `
.lbar { display: flex; align-items: center; gap: 13px; height: 60px; padding: 0 15px; }
.lsearch {
  flex: 1; display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 14px;
  background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text-dim);
}
.lsearch em { font-style: normal; font-size: 13.5px; }
.lsegs { display: flex; gap: 3px; padding: 3px; background: var(--bg-input); border-radius: 9px; }
.lseg { height: 30px; display: inline-flex; align-items: center; padding: 0 15px; border-radius: 7px; font-size: 12.5px; color: var(--text-secondary); }
.lseg.on { background: var(--accent); color: #1a1205; font-weight: 700; }
.lcam { display: flex; color: var(--text-dim); }
.lsel {
  display: inline-flex; align-items: center; gap: 22px; height: 34px; padding: 0 12px;
  background: var(--bg-input); border: 1px solid var(--border); border-radius: 9px;
  font-size: 12.5px; color: var(--text-secondary);
}
.lsel em { font-style: normal; opacity: .7; }
.lcount { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ok); }

.ltable { margin-top: 16px; height: 790px; overflow: hidden; }
.lhead, .lrow {
  display: grid;
  grid-template-columns: 200px 250px 90px 150px 160px 1fr 40px;
  align-items: center; padding: 0 20px;
}
.lhead { height: 46px; font-size: 12.5px; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
.lrows { display: flex; flex-direction: column; }
.lrow { height: 62px; border-bottom: 1px solid var(--border); }
.lhull { font-size: 15px; font-weight: 700; color: var(--accent); }
.lgate { display: flex; flex-direction: column; gap: 2px; }
.lgate b { font-size: 13px; font-weight: 600; }
.lgate em { font-style: normal; font-size: 9.5px; color: var(--text-dim); letter-spacing: .06em; }
.ldir { font-size: 11px; color: var(--ok); letter-spacing: .1em; }
.lreads { font-size: 13.5px; color: var(--text-secondary); }
.lrec { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; }
.lrec em { font-style: normal; }
.lrec.lock { color: #f43f5e; }
.lrec.ok { color: var(--ok); }
.larr { display: flex; color: var(--text-dim); justify-self: end; }
/* Sweep highlight used when a row resolves. */
.lrow.hot { background: rgba(var(--accent-rgb), .07); }
`;
