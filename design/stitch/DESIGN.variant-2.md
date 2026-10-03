---
name: Obsidian Command
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffb869'
  on-tertiary: '#482900'
  tertiary-container: '#ca801e'
  on-tertiary-container: '#3f2300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdcbb'
  tertiary-fixed-dim: '#ffb869'
  on-tertiary-fixed: '#2c1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
  bg-canvas: '#0a0a0c'
  bg-surface-lowest: '#0e0e11'
  bg-surface: '#131316'
  bg-surface-raised: '#18181d'
  bg-surface-overlay: '#1f1f26'
  bg-surface-glass: rgba(19, 19, 22, 0.72)
  border-subtle: rgba(255, 255, 255, 0.05)
  border-default: rgba(255, 255, 255, 0.09)
  border-highlight: rgba(255, 255, 255, 0.16)
  border-focus: rgba(139, 92, 246, 0.65)
  border-active-glow: rgba(139, 92, 246, 0.40)
  text-primary: '#f4f4f7'
  text-secondary: '#9ca3af'
  text-muted: '#636674'
  text-disabled: '#3f3f4e'
  text-inverse: '#0a0a0c'
  primary-hover: '#7c3aed'
  primary-active: '#6d28d9'
  primary-muted: rgba(139, 92, 246, 0.12)
  primary-glow: rgba(139, 92, 246, 0.28)
  secondary-muted: rgba(59, 130, 246, 0.12)
  accent-cyan: '#06b6d4'
  success-base: '#10b981'
  success-muted: rgba(16, 185, 129, 0.12)
  warning-base: '#f59e0b'
  warning-muted: rgba(245, 158, 11, 0.12)
  error-base: '#ef4444'
  error-muted: rgba(239, 68, 68, 0.12)
typography:
  display:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.035em
  display-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.015em
  body-default:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.45'
    letterSpacing: 0em
  caption:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  code-terminal:
    fontFamily: JetBrains Mono
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.55'
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

# Agent Hive — Visual Design System (Obsidian Command)

## Brand Philosophy & Aesthetic Direction
Agent Hive is an elite, next-generation local multi-agent AI workspace. The visual aesthetic balances high-density technical command-center efficiency with calm, luxurious obsidian surfaces, crisp typography, and restrained electric violet and emerald telemetry accents. It feels tactile, focused, and powerful—never flashy sci-fi cliché, but purposeful digital engineering craft.

---

## 1. Color System

### 1.1 Foundation & Surfaces (Dark Mode Only)
- `--bg-canvas`: `#0a0a0c` — Infinite canvas & viewport backdrop
- `--bg-surface-lowest`: `#0e0e11` — Terminal logs, sunken gutters, code wells
- `--bg-surface`: `#131316` — Standard card & panel base
- `--bg-surface-raised`: `#18181d` — Raised cards, table headers, hover surfaces
- `--bg-surface-overlay`: `#1f1f26` — Dropdowns, popovers, floating toolbars, modals
- `--bg-surface-glass`: `rgba(19, 19, 22, 0.72)` — Frosted glass with `backdrop-filter: blur(16px)`

### 1.2 Borders & Dividers
- `--border-subtle`: `rgba(255, 255, 255, 0.05)` — Card partitions, inactive table borders
- `--border-default`: `rgba(255, 255, 255, 0.09)` — Standard card borders, structural containers
- `--border-highlight`: `rgba(255, 255, 255, 0.16)` — Hover borders, highlighted card headers
- `--border-focus`: `rgba(139, 92, 246, 0.65)` — Keyboard & interactive focus rings
- `--border-active-glow`: `rgba(139, 92, 246, 0.40)` — Active agent execution outline

### 1.3 Text & Content
- `--text-primary`: `#f4f4f7` — Primary headers, titles, active telemetry readouts
- `--text-secondary`: `#9ca3af` — Subtitles, secondary labels, metadata tags
- `--text-muted`: `#636674` — Inactive items, placeholder text, timestamps, shortcuts
- `--text-disabled`: `#3f3f4e` — Disabled actions, dimmed agent statuses
- `--text-inverse`: `#0a0a0c` — Text placed on high-luminance badges or primary buttons

### 1.4 Accents & Functional Semantic Tokens
- `--primary-base`: `#8b5cf6` (Electric Violet / Purple-500)
- `--primary-hover`: `#7c3aed` (Purple-600)
- `--primary-active`: `#6d28d9` (Purple-700)
- `--primary-muted`: `rgba(139, 92, 246, 0.12)` — Violet ghost backgrounds
- `--primary-glow`: `rgba(139, 92, 246, 0.28)` — Ambient drop shadow glow
- `--secondary-base`: `#3b82f6` (Neural Cobalt / Blue-500)
- `--secondary-muted`: `rgba(59, 130, 246, 0.12)`
- `--accent-cyan`: `#06b6d4` (Telemetry Cyan / Cyan-500) — High-throughput streaming
- `--success-base`: `#10b981` (Emerald-500) — Online, completed, zero egress
- `--success-muted`: `rgba(16, 185, 129, 0.12)`
- `--warning-base`: `#f59e0b` (Amber-500) — Memory warning, reviewing, high compute load
- `--warning-muted`: `rgba(245, 158, 11, 0.12)`
- `--error-base`: `#ef4444` (Crimson-500) — Execution halt, syntax error, failed task
- `--error-muted`: `rgba(239, 68, 68, 0.12)`

---

## 2. Typography Scale

Primary Typeface: **Geist Sans** (fallback: Inter, -apple-system, sans-serif)  
Monospace Typeface: **Geist Mono** (fallback: JetBrains Mono, Fira Code, monospace)

| Token | Size | Line Height | Tracking | Weight | Target Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | 36px (2.25rem) | 1.15 | -0.035em | 700 / Bold | Hero dashboard stat numbers, major landing headers |
| **H1** | 28px (1.75rem) | 1.2 | -0.025em | 600 / SemiBold | Primary view titles (e.g., "Swarm Command Center") |
| **H2** | 20px (1.25rem) | 1.3 | -0.02em | 600 / SemiBold | Panel section headers, agent profile names |
| **H3** | 16px (1.0rem) | 1.4 | -0.015em | 600 / SemiBold | Sub-panel titles, modal headers, card headers |
| **Body** | 14px (0.875rem)| 1.5 | -0.01em | 400 / Regular | Core interface body text, descriptions, chat messages |
| **Small** | 12px (0.75rem) | 1.45| 0em | 500 / Medium | Secondary metadata, badge text, table cell values |
| **Caption** | 11px (0.6875rem)| 1.4| +0.02em | 500 / Medium | Metric captions, uppercase section labels (`tracking-wider`) |
| **Code / Terminal** | 12.5px | 1.55 | 0em | 400 / 500 | Code diffs, CLI logs, parameter tokens, IPC packets |

---

## 3. Spacing Scale

Base unit: **4px**

- `space-1` = 4px — Micro gap, badge padding X, icon-text tight inline gap
- `space-2` = 8px — Button inner icon gap, list item vertical padding, pill padding
- `space-3` = 12px — Compact card padding, input field padding X, small item gutters
- `space-4` = 16px — Standard input field height padding, medium card inner padding
- `space-5` = 20px — Standard component gap, header-to-content spacing
- `space-6` = 24px — Card container padding, modal content padding, grid gap
- `space-8` = 32px — Major panel padding, section divider margin
- `space-10` = 40px — View header margins, dashboard column spacing
- `space-12` = 48px — Page layout lateral margins, empty-state spacing
- `space-16` = 64px — Hero section vertical rhythm, onboarding container gaps

---

## 4. Corner Radius Scale

- `radius-sm`: 4px — Checkboxes, code chips, inline tags, small badges
- `radius-md`: 8px — Buttons, text inputs, dropdown menus, table rows
- `radius-lg`: 12px — Standard cards, task cards, terminal preview panes
- `radius-xl`: 16px — Major view containers, agent showcase cards, modals, drawers
- `radius-full`: 9999px — User & agent avatars, status indicator pills, pill buttons

---

## 5. Shadows & Elevations

- **Subtle Panel**: `0 1px 2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)`
- **Floating Card**: `0 10px 25px -5px rgba(0, 0, 0, 0.60), 0 0 0 1px rgba(255, 255, 255, 0.08)`
- **Active Agent Glow**: `0 0 24px -2px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(139, 92, 246, 0.5)`
- **Modal Elevation**: `0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.12)`
- **Terminal Glass Rim**: `inset 0 1px 0 0 rgba(255, 255, 255, 0.08)`

---

## 6. Comprehensive Component Library Specifications

### 6.1 Buttons
- **Primary**: Background `--primary-base`, text `#ffffff`, border none, shadow `0 2px 10px rgba(139, 92, 246, 0.35)`.
  - *Hover*: `--primary-hover`, scale 1.01.
  - *Active*: `--primary-active`, scale 0.98.
  - *Focus*: Outline 2px `--border-focus`, offset 2px.
  - *Disabled*: Background `#1c1b22`, text `#4b4b57`, border `1px solid rgba(255,255,255,0.04)`.
  - *Loading*: Spinner replacing left icon, text intact, opacity 0.85.
- **Secondary / Ghost**: Background `--bg-surface-raised`, border `1px solid --border-default`, text `--text-primary`.
  - *Hover*: Border `--border-highlight`, background `--bg-surface-overlay`.
- **Destructive**: Background `--error-muted`, border `1px solid rgba(239, 68, 68, 0.25)`, text `--error-base`.
- **Icon Button**: Sizing 32×32px or 36×36px, centered SVG, radius `8px`, subtle hover wash.

### 6.2 Inputs & Command Bar
- **Text Input**: Height 36px, radius 8px, background `--bg-surface-lowest`, border `1px solid --border-default`, text 13px `--text-primary`.
  - *Focus*: Border `--border-focus`, ring 3px `rgba(139, 92, 246, 0.15)`.
  - *Disabled*: Opacity 0.5, cursor not-allowed.
- **Command Input (Omnibar)**: Height 48px, radius 12px, font 14px, leading AI icon + trailing keyboard shortcut badge (`⌘K`). Glow effect on focus.
- **Select & Dropdown**: Custom chevron, backdrop blur menu, item height 32px with radius 6px hover states.

### 6.3 Agent Card
- Container: Radius 14px, background `--bg-surface`, border `1px solid --border-default`.
- Header: Agent avatar (40×40px) with live status pip, name, model badge (e.g. `Ollama / Qwen-2.5-Coder`), role tag.
- Body: VRAM footprint meter, current task summary, tokens-per-second indicator.
- Footer: Quick terminal toggle button, pause/resume switcher.

### 6.4 Task Card (Kanban / Mission Control)
- Radius 10px, background `--bg-surface-raised`, border `1px solid --border-default`.
- Card elements: Task ID (`#HIVE-104`), priority badge (P0 Urgent / P1 High), title, assigned agent mini avatar, micro progress bar, dependencies tag (`2 deps`).
- Interactive: Drag handle, subtle hover elevation `translateY(-2px)`.

### 6.5 Badges & Indicators
- **Status Badge**: Pill shape, 20px height, 8px padding X. Includes 6px glowing dot + text:
  - *Online / Active*: Emerald dot with pulse animation, emerald background `rgba(16, 185, 129, 0.12)`.
  - *Thinking / In-Flight*: Violet dot with pulse, violet background `rgba(139, 92, 246, 0.12)`.
  - *Awaiting Review / Idle*: Amber dot, amber background `rgba(245, 158, 11, 0.12)`.
- **Model Badge**: Monospace font 11px, subtle border, gray background `rgba(255, 255, 255, 0.04)`.

### 6.6 Terminal Panel
- Sunken background `--bg-surface-lowest`, top titlebar with macOS-style window controls or agent tab pills, monospace line numbers, color-coded syntax logs (`[INFO]`, `[IPC:SEND]`, `[GIT:DIFF]`, `[RETURN:0]`).

### 6.7 Progress Bar & Progress Ring
- **Bar**: Height 4px or 6px, track `--bg-surface-raised`, fill gradient from `#8b5cf6` to `#3b82f6` or emerald.
- **Ring**: SVG circle stroke with `stroke-dasharray`, center stat readout.

### 6.8 Toast & Feedback
- Floating bottom-right or top-center, radius 10px, glassmorphic dark container with accent border strip. Auto-dismiss progress timer bar.
