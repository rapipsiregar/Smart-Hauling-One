/* Aggregates every screen's markup builder and stylesheet so main.js has a
   single import for the recreated UI. */

import { SHELL_CSS } from './screen-shell.css.js';
import { DASH_CSS } from './screen-dashboard.css.js';
import { LEDGER_CSS } from './screen-ledger.css.js';
import { REPORT_CSS } from './screen-report.css.js';
import { FX_CSS } from './fx.css.js';

export { dashboardScreen } from './screen-dashboard.js';
export { ledgerScreen } from './screen-ledger.js';
export { reportScreen } from './screen-report.js';

export const SCREEN_CSS =
  SHELL_CSS + DASH_CSS + LEDGER_CSS + REPORT_CSS + FX_CSS;
