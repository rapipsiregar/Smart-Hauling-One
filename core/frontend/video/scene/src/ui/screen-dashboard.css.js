/* Dashboard styling, traced from 01-dashboard-standard.png. */

export const DASH_CSS = `
.kpirow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kpi { padding: 15px 18px 17px; text-align: center; }
.kpi .label { font-size: 10px; letter-spacing: .16em; }
.kval { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-top: 9px; }
.kval b { font-family: var(--font-mono); font-size: 40px; font-weight: 700; line-height: 1; letter-spacing: -.01em; }
.kval span { font-size: 12px; color: var(--text-secondary); }
.khint { font-size: 10.5px; color: var(--text-dim); margin-top: 8px; }
.kicon { margin-top: 10px; display: flex; justify-content: center; color: var(--accent); opacity: .9; }
.kicon.bad { color: #f43f5e; }
.kpi:nth-child(3) .kval b { color: var(--text-primary); }

.fbar { display: flex; align-items: center; gap: 12px; padding: 0 14px; height: 52px; margin-top: 16px; }
.ficon { display: flex; color: var(--accent); }
.ftitle { font-size: 13px; font-weight: 600; letter-spacing: .1em; }
.fbtn {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 11px;
  border: 1px solid var(--border-strong); border-radius: 7px; font-size: 10px;
  letter-spacing: .12em; color: var(--text-secondary);
}
.fgates { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.fg {
  height: 27px; display: inline-flex; align-items: center; padding: 0 13px;
  border-radius: 7px; font-size: 11.5px; color: var(--text-secondary);
}
.fg.on { background: var(--accent); color: #1a1205; font-weight: 700; }

.dashcols { display: grid; grid-template-columns: 1fr 620px; gap: 16px; margin-top: 16px; height: 690px; }
.dlist { display: flex; flex-direction: column; }
.dhead { display: flex; align-items: center; padding: 14px 16px 12px; }
.dh { display: flex; align-items: center; gap: 9px; color: var(--accent); }
.dh b { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.dhead .label { margin-left: auto; font-size: 10px; }
.drows { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 7px; }

.drow {
  display: flex; align-items: center; gap: 13px; height: 58px; padding: 0 14px;
  border-radius: 11px; background: var(--bg-elevated); border: 1px solid var(--border);
}
.dmark { display: flex; }
.dmark.ok { color: var(--ok); }
.dmark.warn { color: var(--accent); }
.dbody { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dtop { display: flex; align-items: baseline; gap: 9px; }
.dtop b { font-size: 15px; font-weight: 700; letter-spacing: .01em; }
.dtop em { font-style: normal; font-size: 10px; color: var(--text-dim); letter-spacing: .06em; }
.dsub { font-size: 11.5px; color: var(--text-secondary); }
.drow .chip { margin-left: auto; }

/* --- Inspection HUD --- */
.hud { padding: 14px 16px 16px; display: flex; flex-direction: column; }
.hudhead { display: flex; align-items: center; margin-bottom: 13px; }
.hh { display: flex; align-items: center; gap: 9px; color: var(--accent); }
.hh b { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.hstat { margin-left: auto; }
.hplate { padding: 15px 0 17px; text-align: center; }
.hplate .label { font-size: 10px; }
.hullid { font-size: 52px; font-weight: 700; color: var(--accent); line-height: 1.1; margin-top: 4px; text-shadow: 0 0 34px rgba(var(--accent-rgb), .5); }
.hconf { font-size: 12px; color: var(--text-secondary); }
.hstats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; margin-top: 14px; }
.hs {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 11px;
  padding: 12px 0 11px; text-align: center;
}
.hs b { display: block; font-size: 25px; font-weight: 700; line-height: 1.1; }
.hs .label { font-size: 9px; }
.hreadlbl { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-secondary); margin-top: 16px; }
.hreads { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.hr {
  height: 25px; display: inline-flex; align-items: center; padding: 0 9px;
  border-radius: 7px; background: var(--bg-input); border: 1px solid var(--border);
  font-size: 11.5px; color: var(--text-secondary);
}
.hr.hit { background: rgba(var(--accent-rgb), .18); border-color: rgba(var(--accent-rgb), .45); color: var(--accent); }
.hfoot {
  display: flex; justify-content: space-between; margin-top: auto; padding-top: 14px;
  font-size: 10px; color: var(--text-dim);
}

/* Voting bars, used when the HUD is in live mode. */
.votes { margin-top: 14px; display: flex; flex-direction: column; gap: 9px; }
.vrow { display: flex; align-items: center; gap: 11px; font-family: var(--font-mono); font-size: 11.5px; }
.vrow > b { width: 58px; font-weight: 600; }
.vtrack { flex: 1; height: 9px; border-radius: 5px; background: var(--bg-input); overflow: hidden; }
/* display:block is load-bearing: these are spans, and an inline box ignores
   the width the vote animation writes, collapsing the bar to nothing. */
.vfill {
  display: block; height: 100%; border-radius: 5px; background: var(--accent);
  box-shadow: 0 0 14px rgba(var(--accent-rgb), .5);
}
.vrow.dim .vfill { background: var(--text-dim); box-shadow: none; }
.vrow > span { width: 38px; text-align: right; color: var(--text-secondary); }
`;
