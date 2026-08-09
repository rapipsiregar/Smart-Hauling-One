/* Shell styling. Values traced from the product screenshots: 232px sidebar,
   50px header, amber active state with a left accent bar, mono uppercase
   section labels. */

export const SHELL_CSS = `
.app {
  width: 1600px; height: 980px; display: flex;
  background: var(--bg); color: var(--text-primary);
  font-family: var(--font-sans); font-size: 14px; overflow: hidden;
  position: relative;
}
/* Same pit backdrop the app paints behind its glass. */
.app::before {
  content: ''; position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(1000px 580px at 72% 88%, rgba(var(--accent-rgb), .16), transparent 60%),
    radial-gradient(760px 500px at 12% 4%, rgba(30,41,59,.35), transparent 62%);
}
.light .app::before {
  background:
    radial-gradient(900px 540px at 72% 92%, rgba(var(--accent-rgb), .14), transparent 60%),
    linear-gradient(180deg, #eef1f6 0%, #e6ebf2 100%);
}
.app > * { position: relative; z-index: 1; }

/* --- sidebar --- */
.side {
  width: 232px; flex: 0 0 232px; display: flex; flex-direction: column;
  background: var(--bg-card); backdrop-filter: blur(22px) saturate(140%);
  border-right: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 11px; padding: 15px 16px; border-bottom: 1px solid var(--border); }
.bmark {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 34px;
  background: linear-gradient(145deg, var(--accent), var(--accent-hover));
  display: flex; align-items: center; justify-content: center; color: #1a1205;
  box-shadow: 0 4px 16px -4px rgba(var(--accent-rgb), .6);
}
.bname { font-size: 15px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.bsub { font-size: 10px; color: var(--text-dim); letter-spacing: .02em; }
.nav { flex: 1; padding: 14px 10px; overflow: hidden; }
.navlabel {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .16em;
  color: var(--text-dim); padding: 14px 8px 8px;
}
.navitem, .navsub {
  display: flex; align-items: center; gap: 11px; height: 38px;
  padding: 0 11px; border-radius: 9px; color: var(--text-secondary);
  font-size: 13.5px; position: relative;
}
.navsub { margin-left: 14px; height: 34px; font-size: 13px; }
.navitem .ni, .navsub .ni { display: flex; opacity: .85; }
.navitem.on, .navsub.on {
  background: rgba(var(--accent-rgb), .1); color: var(--accent); font-weight: 600;
}
.navitem.on::before, .navsub.on::before {
  content: ''; position: absolute; left: -10px; top: 7px; bottom: 7px;
  width: 3px; border-radius: 0 3px 3px 0; background: var(--accent);
}
.chev { margin-left: auto; opacity: .8; display: flex; }
.sfoot {
  height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 18px;
  border-top: 1px solid var(--border); font-size: 12px; color: var(--text-secondary);
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 10px var(--ok); }

/* --- header --- */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.hdr {
  height: 50px; flex: 0 0 50px; display: flex; align-items: center;
  padding: 0 22px; border-bottom: 1px solid var(--border);
  background: var(--bg-card); backdrop-filter: blur(22px);
}
.htitle { font-size: 17px; font-weight: 600; letter-spacing: -.02em; }
.hicons { margin-left: auto; display: flex; align-items: center; gap: 17px; color: var(--text-secondary); }
.hicons > span { display: flex; }
.avatar {
  width: 27px; height: 27px; border-radius: 50%; font-size: 10px; font-weight: 700;
  background: linear-gradient(145deg, var(--accent), var(--accent-hover));
  color: #1a1205; display: flex; align-items: center; justify-content: center;
}
.page { flex: 1; padding: 20px 22px; overflow: hidden; }

/* --- shared card + chip primitives --- */
.card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
  backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  box-shadow: 0 8px 32px -12px rgba(0,0,0,.55), inset 0 1px 0 0 var(--glass-highlight);
  position: relative; overflow: hidden;
}
.chip {
  display: inline-flex; align-items: center; gap: 5px; height: 21px; padding: 0 8px;
  border-radius: 999px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
}
.chip i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.chip.g { background: rgba(var(--ok-rgb), .14); color: var(--ok); }
.chip.a { background: rgba(var(--accent-rgb), .16); color: var(--accent); }
.chip.r { background: rgba(244,63,94,.14); color: #f43f5e; }
`;
