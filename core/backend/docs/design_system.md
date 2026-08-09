# Design System (DS) — Source of Truth #3

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Validated / Active  
**Last Updated:** 2026-08-02  
**Author:** System Analyst AI  
**Source:** Derived from `docs/PRD.md` (SoT-1) and `docs/information_architecture.md` (SoT-2).
§7.9–7.11 additionally derived from `docs/edge-system/` (PAGE-008/PAGE-009).

---

## 1. Document Overview

### 1.1 Purpose

This document defines the visual language, interaction patterns, and reusable UI components for the Smart Gate ISHS web dashboard. It serves as the single source of truth for all frontend implementation.

### 1.2 Design Principles

- **Industrial-Grade Clarity:** High contrast, large data-dense layouts for use in bright sunlight or dim mining control rooms.
- **Real-Time Awareness:** Every screen element communicates liveness — pulsing indicators, auto-refreshing data, instant WebSocket updates.
- **Operator Efficiency:** Critical actions (verify, correct, filter) require ≤ 2 clicks. Non-essential decoration is eliminated.
- **Fail-Safe Readability:** All text and data remains legible under screen glare, dust, or low brightness settings.

---

## 2. Brand Foundation

### 2.1 Brand Personality

- **Rugged & Reliable:** Industrial aesthetic with purposeful weight, thick borders, and structural layout grids.
- **Precision-Engineered:** Clean typography, exact spacing, data-driven density.
- **Mining Heritage:** Dark warm charcoal backgrounds inspired by coal/crushed stone, amber/orange accents for energy and alerts.

### 2.2 Visual Characteristics

- **Borders & Corners:** Sharp corners (0–4px radius) for UI chrome; slightly rounded (6–8px) for data cards.
- **Depth:** Layered glassmorphism with subtle backdrop blur on floating panels; thin border strokes define boundaries.
- **Motion:** Subtle glow pulse animations for live indicators; smooth cubic-bezier transitions for drawers and modals.

---

## 3. Color System

### 3.1 Theme: Warm Charcoal / Amber (Default Mining HUD)

| Token | Hex Value | Tailwind Class | Usage |
|-------|-----------|---------------|-------|
| color-bg-app | #0F1117 | bg-gray-950 | Main app background |
| color-bg-panel | #1A1D27 | bg-gray-900 | Cards, panels, sidebar |
| color-bg-elevated | #242733 | bg-gray-800 | Modals, dropdowns, tooltips |
| color-bg-input | #2A2D3A | bg-gray-800/80 | Text input, search fields |
| color-border | #33364A | border-gray-700 | Panel borders, dividers |
| color-border-active | #F59E0B | border-amber-500 | Active/focused borders |
| color-accent | #F59E0B | text-amber-500, bg-amber-500 | Primary actions, key metrics |
| color-accent-hover | #D97706 | hover:bg-amber-600 | Button + link hover |
| color-accent-dim | #92400E | bg-amber-800 | Muted accent backgrounds |
| color-text-primary | #F1F5F9 | text-slate-100 | Primary body text |
| color-text-secondary | #94A3B8 | text-slate-400 | Secondary/muted text |
| color-text-dim | #64748B | text-slate-500 | Placeholder, disabled text |
| color-success | #10B981 | text-emerald-400 | Verified, confident, online |
| color-warning | #F59E0B | text-amber-400 | Low confidence, low battery |
| color-danger | #EF4444 | text-red-400 | Unregistered, critical alert |
| color-info | #3B82F6 | text-blue-400 | Informational |

### 3.2 Theme: Slate-Blue (Alternative)

Swap accent tokens to cool blue tones while keeping dark backgrounds.

| Token | Alternate Value | Tailwind Class |
|-------|----------------|---------------|
| color-accent | #3B82F6 | bg-blue-500 |
| color-accent-hover | #2563EB | hover:bg-blue-600 |
| color-accent-dim | #1E3A5F | bg-blue-800 |
| color-border-active | #3B82F6 | border-blue-500 |

### 3.3 Semantic Status Colors

| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| Verified | Green | #10B981 | High-confidence OCR ≥ 95% |
| Questionable | Amber | #F59E0B | Medium confidence 85–94% |
| Rejected | Red | #EF4444 | Low confidence < 85% or unregistered |
| Unknown | Gray | #6B7280 | Processing, no result yet |
| Online | Green | #10B981 | Skid tower active |
| Warning | Amber | #F59E0B | Battery < 30%, latency > 400ms |
| Offline | Red | #EF4444 | No telemetry for > 5 minutes |

---

## 4. Typography

| Style | Font | Weight | Size | Line Height | Usage |
|-------|------|--------|------|-------------|-------|
| Display | Inter / Rajdhani | Bold 700 | 28px (1.75rem) | 1.2 | Large KPI values, dashboard hero numbers |
| Heading 1 | Inter | SemiBold 600 | 20px (1.25rem) | 1.3 | Page titles, section headers |
| Heading 2 | Inter | SemiBold 600 | 16px (1rem) | 1.4 | Card titles, panel headers |
| Body | Inter | Regular 400 | 14px (0.875rem) | 1.5 | Table content, descriptions |
| Body Small | Inter | Regular 400 | 12px (0.75rem) | 1.5 | Metadata, timestamps, badges |
| Mono | JetBrains Mono / Fira Code | Medium 500 | 14px (0.875rem) | 1.4 | Hull IDs, confidence % values |
| Mono Small | JetBrains Mono | Regular 400 | 12px (0.75rem) | 1.4 | Log IDs, technical details |

**Font Stack:** `Inter, system-ui, -apple-system, sans-serif` (primary); `JetBrains Mono, Fira Code, monospace` (code/data).

---

## 5. Elevation & Shadows

| Level | Usage | Shadow |
|-------|-------|--------|
| None | Text inputs, tables | `shadow-none` |
| Low | Cards, panels | `0 1px 2px rgba(0,0,0,0.3)` |
| Medium | Sidebar, topbar | `0 4px 6px rgba(0,0,0,0.4)` |
| High | Modals, dropdowns | `0 10px 25px rgba(0,0,0,0.5)` |
| Glass | Floating overlays | `backdrop-blur-xl bg-gray-900/80` |

---

## 6. Grid & Layout

### 6.1 Dashboard Layout

```
┌──────────┐ ┌────────────────────────────────────────────┐
│          │ │  Header: WS Dot | Search | Theme | User    │
│  Sidebar │ ├────────────────────────────────────────────┤
│  260px   │ │  KPI Row: Cards in 4-column grid           │
│  (icon:  │ ├────────────────────────────────────────────┤
│   80px)  │ │  Left (65%)        |  Right (35%)          │
│          │ │  Live Feed List    |  Mini Telemetry       │
│          │ │  + Filter Toolbar  |  Skid Map / Stats     │
│          │ │  + Search          |                       │
└──────────┘ └────────────────────────────────────────────┘
```

### 6.2 Breakpoints

| Breakpoint | Width | Layout Behavior |
|------------|-------|-----------------|
| Mobile | < 640px | Single column, sidebar = hamburger drawer |
| Tablet | 640–1023px | 2-column KPI, sidebar collapsed to icons |
| Desktop | ≥ 1024px | Full sidebar, multi-column grid |
| Wide | ≥ 1440px | Extra padding, max-width container |

---

## 7. Component Library

### 7.1 Button

| Variant | Background | Text | Border | Hover | Active |
|---------|-----------|------|--------|-------|--------|
| Primary | color-accent | white | none | 10% brighter opacity | scale(0.98) |
| Secondary | transparent | color-text-primary | color-border | bg-gray-800 | scale(0.98) |
| Danger | transparent | color-danger | color-danger/30 | bg-red-900/20 | scale(0.98) |
| Ghost | transparent | color-text-secondary | none | bg-gray-800 | — |

**Sizes:** `sm` (px-3 py-1.5 text-xs), `md` (px-4 py-2 text-sm), `lg` (px-6 py-3 text-base)

### 7.2 Card

```
┌─────────────────────────────────────┐
│ Header row (optional section label) │
├─────────────────────────────────────┤
│ Content area (flexible)             │
│                                     │
└─────────────────────────────────────┘
```

- **Background:** `color-bg-panel`
- **Border:** `color-border` 1px solid
- **Padding:** `p-4` standard, `p-6` spacious
- **Border Radius:** `rounded-lg` (8px)

### 7.3 Crossing Feed Card

```
┌──────────────────────────────────────────┐
│ ● DT-118         88%    ⬆ IN   12:34:05  │
├──────────────────────────────────────────┤
│ [Crop thumbnail]  [Context thumbnail]     │
│  hull_id.jpg       context.jpg           │
└──────────────────────────────────────────┘
```

- Confidence badge: color-coded by threshold
- Direction indicator: IN/OUT with arrow icon
- Click → opens PAGE-003 crossing detail
- Right-click → context menu (Verify, Correct Hull ID)

### 7.4 Text Input

| State | Border | Background |
|-------|--------|-----------|
| Default | `color-border` | `color-bg-input` |
| Focus | `color-border-active` + ring | `color-bg-input` |
| Error | `color-danger` | `color-bg-input` |
| Disabled | `color-border` opacity 50% | `color-bg-panel` |

### 7.5 Modal Dialog

- **Backdrop:** `bg-gray-950/60 backdrop-blur-sm`
- **Container:** Centered, `max-w-lg`, `color-bg-elevated`, `rounded-xl`, `shadow-high`
- **Header:** Title + close (X) button
- **Footer:** Right-aligned action buttons (Cancel + Confirm)
- **Transition:** Fade-in 200ms + scale 95% → 100%

### 7.6 Status Badge

| Type | Background | Text | Icon |
|------|-----------|------|------|
| Verified | `bg-emerald-500/20` | `text-emerald-400` | Checkmark |
| Low Conf | `bg-amber-500/20` | `text-amber-400` | Warning triangle |
| Unregistered | `bg-red-500/20` | `text-red-400` | Alert octagon |
| Processing | `bg-blue-500/20` | `text-blue-400` | Spinner |

### 7.7 KPI Stat Tile

```
┌──────────────┐
│  1,247       │  ← Large Rajdhani display number
│  Crossings   │  ← Small label
│  ▲ +12%     │  ← Trend indicator (green/red)
└──────────────┘
```

### 7.8 Table

- **Header:** `color-bg-elevated`, sticky, uppercase label
- **Rows:** Even/odd subtle stripe (`bg-gray-900` / `bg-gray-900/50`)
- **Hover:** `bg-gray-800` highlight
- **Sortable:** Click header to sort, arrow indicator

### 7.9 Device Health Badge

Reuses the existing Semantic Status Colors (§3.3 Online/Warning/Offline) — do not invent a new
color set for edge devices, the mapping is direct: `device_status: "online"` → Online (green),
`"maintenance"` → Warning (amber), `"offline"` → Offline (red).

```
┌────────────────────────────────┐
│ ● GATE-A            online     │
│   last seen 12s ago            │
│   queue: 0 pending             │
└────────────────────────────────┘
```
- **Queue depth callout:** if `local_queue_depth > 0` on an otherwise `online` device, render it
  in `color-warning` even though the device itself is online — a growing queue on a connected
  device is a distinct problem from being offline (`docs/edge-system/SRS.md` §6), and must not
  be visually indistinguishable from the healthy `queue: 0` state.
- **Saved vs. pending settings:** a small secondary badge, `Settings: saved` (`color-success`) vs.
  `Settings: pending` (`color-warning`), driven by `applied_config_version == config_version`
  (`docs/edge-system/API_CONTRACT.md` §2.1).

### 7.10 Device Settings Form (PAGE-008)

- **Layout:** One form per device card, numeric steppers (not free-text) for `yolo_fps`,
  `ocr_fps`, `detect_window_sec` — range-limited per `docs/edge-system/API_CONTRACT.md` §2.2
  (`yolo_fps` 1–30, `ocr_fps` 1–15, `detect_window_sec` 1–30), with the business owner's
  preferred operating range (18–25 / ~4 / 5–7) shown as inline helper text, not as the hard
  input limit.
- **Save button state:** disabled until at least one field changes from its last-saved value
  (matches the API's "partial update, at least one field required" rule, §2.2).
- **Validation errors:** inline under the offending field, sourced from the API's `400` response
  message — do not re-derive validation client-side only; the server is authoritative.

### 7.11 Live Video Player (PAGE-009)

- **Player:** any WHEP-compatible video element/library — implementation is a frontend choice,
  not dictated here.
- **States:** `connecting` (spinner + "Connecting to GATE-A…"), `live` (video + a small pulsing
  "LIVE" tag reusing the same pulse animation as §9's WS connection dot), `device offline`
  (explicit message + a Wifi-off icon, not just an infinitely-spinning loader — per
  `docs/edge-system/API_CONTRACT.md` §2.4, a session can be created for an offline device and
  will simply never start).
- **No overlay controls** — this player never renders bounding boxes or hull-ID text
  (`docs/edge-system/PRD.md` Non-Goal); do not add a "toggle detection overlay" control here, that
  data doesn't exist on this stream.

---

## 8. Iconography

Use **Lucide React** icons throughout. All icons `size={16}` (inline) or `size={20}` (standalone).

| Context | Icon Name |
|---------|-----------|
| Dashboard / Feed | `LayoutDashboard` |
| Crossing | `Truck` |
| Reports | `BarChart3` |
| Fleet | `Warehouse` |
| Telemetry | `RadioTower` |
| Admin | `Settings` |
| Verified | `BadgeCheck` |
| Warning | `TriangleAlert` |
| Error | `OctagonAlert` |
| Search | `Search` |
| User | `UserCircle` |
| Logout | `LogOut` |
| Filter | `Filter` |
| Sort | `ArrowUpDown` |
| Export | `Download` |
| Upload | `Upload` |
| Direction IN | `ArrowDownToLine` |
| Direction OUT | `ArrowUpFromLine` |
| Device Settings (M008) | `SlidersHorizontal` |
| Live CCTV Viewer (M009) | `Video` |
| Device online | `Wifi` |
| Device offline | `WifiOff` |
| Queue/pending sync | `Clock` |

---

## 9. Animation & Motion

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| WS connection dot | Pulse opacity | 2s infinite | ease-in-out |
| Feed card entry | Slide in from top + fade | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Toast notification | Slide in from right | 400ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Modal | Fade + scale | 200ms | ease-out |
| Theme switch | Background color transition | 400ms | ease-in-out |
| Status change | Background flash (brief) | 600ms | ease-out |
| Button press | Scale 0.98 | 100ms | ease |

---

## 10. Interaction Patterns

### 10.1 Real-Time Data

- All live data flows through WebSocket.
- Feed cards prepend new items at top with slide-in animation.
- KPI numbers animate counting up on update.
- Connection state visible at all times via header indicator.

### 10.2 Verification Action

1. Supervisor sees crossing card with amber/red confidence badge.
2. Click verify button (checkmark icon) on the card.
3. Card confidence updates to 100% without page reload.
4. Visual flash acknowledgment (green pulse).

### 10.3 Quick Filters

- Capsule toggle buttons above feed list.
- Multi-select: combine "Low Conf" + "Unregistered" to see only risky crossings.
- Filters persist across WebSocket updates.
- Active filters highlighted with accent color.

### 10.4 Error / Empty States

- **No crossings:** Centered truck icon + "No crossings detected yet. Ensure skid towers are online."
- **No search results:** Search icon + "No crossings match your search. Try a different hull ID or check filters."
- **API error:** Toast notification + inline card "Connection lost. Retrying..." with auto-retry.

---

## 11. Accessibility

- **Contrast Ratio:** All text meets WCAG 2.1 AA (≥ 4.5:1 for body, ≥ 3:1 for large text).
- **Focus Indicators:** Visible `ring-2 ring-amber-500` on all interactive elements.
- **Keyboard Navigation:** `Tab` through feed cards; `Enter` opens detail; `Escape` closes modals.
- **Screen Reader:** Semantic HTML, `aria-live="polite"` on feed list, `aria-label` on icon buttons.

---

## 12. Design Tokens Summary

```css
/* Theme: Warm Charcoal / Amber */
--bg-app: #0F1117;
--bg-panel: #1A1D27;
--bg-elevated: #242733;
--border-default: #33364A;
--border-active: #F59E0B;
--accent: #F59E0B;
--accent-hover: #D97706;
--text-primary: #F1F5F9;
--text-secondary: #94A3B8;
--success: #10B981;
--warning: #F59E0B;
--danger: #EF4444;
--info: #3B82F6;
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

---

## 13. Traceability Matrix (PRD → DS)

| PRD Section | Design Target | Components |
|-------------|--------------|------------|
| Live Terminal Feed | PAGE-002 List | Crossing Feed Card, Filter Tags, KPI Tiles |
| Visual Audit Section | PAGE-003 Split Pane | Image Viewer, Metadata Panel, Correction Modal |
| Shift Reporting Module | PAGE-004 Report | Compliance Gauge, Donut Chart, Export Button |
| Dashboard UX Guidelines | All pages | Dark theme, Lucide icons, WS indicator |
| Real-Time Verification | Feed cards | Verify badge, context menu, pulse animation |
| `docs/edge-system/PRD.md` Goals 2–3 (settings, device health) | PAGE-008 | Device Health Badge (§7.9), Device Settings Form (§7.10) |
| `docs/edge-system/PRD.md` Goals 6–7 (live raw feed, no overlay) | PAGE-009 | Live Video Player (§7.11) |
