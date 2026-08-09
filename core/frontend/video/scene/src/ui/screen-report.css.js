/* Report styling, traced from 16-reports-standard.png. */

export const REPORT_CSS = `
.rbanner { padding: 15px 18px 17px; }
.rbhead { display: flex; align-items: center; gap: 11px; color: var(--accent); }
.rbhead b { font-size: 19px; font-weight: 700; letter-spacing: .01em; color: var(--text-primary); }
.rbsub { font-size: 12.5px; color: var(--text-secondary); margin-top: 7px; }

.rmain { margin-top: 16px; padding: 17px 20px 20px; }
.rhead { display: flex; align-items: flex-start; }
.rhead .label { display: flex; align-items: center; gap: 6px; font-size: 10px; }
.rtitle { font-size: 20px; font-weight: 700; margin-top: 5px; letter-spacing: .01em; }
.rtabs { margin-left: auto; display: flex; gap: 4px; }
.rtab { height: 29px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 7px; font-size: 11px; letter-spacing: .08em; color: var(--text-secondary); }
.rtab.on { background: var(--accent); color: #1a1205; font-weight: 700; }

.rnote {
  margin-top: 15px; padding: 13px 16px 14px; border-radius: 12px;
  border: 1px solid rgba(var(--accent-rgb), .38); background: rgba(var(--accent-rgb), .06);
}
.rnh { display: flex; align-items: center; gap: 9px; color: var(--accent); }
.rnh b { font-size: 12px; letter-spacing: .1em; }
.rnb { font-size: 12.5px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }

.rfields { display: flex; align-items: flex-end; gap: 14px; margin-top: 16px; }
.rf { flex: 1; }
.rfin {
  display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 13px; margin-top: 7px;
  background: var(--bg-input); border: 1px solid var(--border); border-radius: 9px;
  color: var(--text-dim); font-size: 13.5px;
}
.rfin span { color: var(--text-primary); }
.rbtns { display: flex; gap: 11px; }
.rbtn {
  display: inline-flex; align-items: center; gap: 9px; height: 40px; padding: 0 20px;
  border-radius: 9px; border: 1px solid var(--border-strong); background: var(--bg-input);
  font-size: 13.5px; font-weight: 600; color: var(--text-primary);
}
.rbtn.pri { background: var(--accent); border-color: var(--accent); color: #1a1205; }
.rwin { font-size: 11px; color: var(--text-dim); margin-top: 9px; }

.rkpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 16px; }
.rk { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 13px 15px 15px; }
.rk .label { font-size: 9.5px; }
.rkv { display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
.rkv b { font-size: 30px; font-weight: 700; line-height: 1; }
.rkv span { font-size: 12px; color: var(--text-secondary); }
.rtag {
  font-style: normal; font-size: 8.5px; letter-spacing: .1em; padding: 3px 7px;
  border-radius: 5px; background: rgba(var(--accent-rgb), .18); color: var(--accent);
}
.rkh { font-size: 10px; color: var(--text-dim); margin-top: 8px; }

.rcols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
.rcard { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px 16px; }
.bars { margin-top: 14px; display: flex; flex-direction: column; gap: 11px; }
.brow { display: flex; align-items: center; gap: 12px; }
.bname { font-size: 12px; width: 92px; }
.btrack { flex: 1; height: 19px; border-radius: 5px; background: var(--bg-input); overflow: hidden; }
.bfill { display: block; height: 100%; border-radius: 5px; width: 0; position: relative; }
.bfill.in { background: var(--ok); }
.bfill.out { background: var(--accent); }
.bfill em {
  position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
  font-style: normal; font-family: var(--font-mono); font-size: 10px; color: #08120e; font-weight: 700;
}
.bval { width: 22px; text-align: right; font-size: 11.5px; color: var(--text-dim); }
.blegend { display: flex; gap: 20px; margin-top: 14px; font-size: 11px; color: var(--text-secondary); }
.blegend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; }
.blegend i.in { background: var(--ok); }
.blegend i.out { background: var(--accent); }

.dtl { margin-top: 14px; }
.dhrow, .dtrow { display: grid; grid-template-columns: 1fr 90px 90px 80px; align-items: center; }
.dhrow { height: 28px; font-size: 9.5px; }
.dhrow span:not(:first-child), .dtrow span:not(:first-child) { text-align: right; }
.dtrow { height: 33px; font-size: 12.5px; border-top: 1px solid var(--border); }
.dtnote { font-size: 10px; color: var(--text-dim); line-height: 1.6; margin-top: 12px; }

.rfoot {
  display: flex; align-items: center; margin-top: 16px; padding: 13px 16px;
  border-radius: 12px; border: 1px solid var(--border); background: var(--bg-elevated);
}
.rfl { display: flex; align-items: center; gap: 10px; color: var(--accent); }
.rfl b { font-size: 12px; letter-spacing: .08em; }
.rfl em { font-style: normal; font-size: 12px; color: var(--text-secondary); }
.rfa { margin-left: auto; display: flex; color: var(--text-dim); }
`;
