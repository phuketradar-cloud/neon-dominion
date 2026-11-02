# UI architecture audit (before the UI redesign)

Rules layer (`js/core/*`) never touches the DOM. The presentation layer (`js/view/*`, `js/main.js`, `css/`, `index.html`)
reads the game state object `g` and changes it only through core functions. The redesign changes presentation only.

## Game systems → core API → UI components

| System | State in `g` | Core API used by the UI | UI components (file) |
|---|---|---|---|
| Game state & saves | whole `g` (JSON, versioned, `World.migrate`) | `World.create`, `Save.save/load/meta/remove` | Start screen, Settings modal (`main.js`, `ui.js screenSettings`) |
| Turn system | `g.turn`, `g.current`, `g.history`, `g.lastReport` | `Turn.end` | END TURN button, briefing modal, turn flash (`ui.js endTurn/showReport/flash`) |
| Factions | `g.factions[fid]`, `ND.FDEF` | `Turn.standings` | Faction card + standings (left panel), Factions modal, start-screen picker |
| Economy | `f.res`, district yields/upkeep | `Econ.ledger/yieldFor/upkeepFor/skimFor`, `Market.*` | Top-bar resources, Treasury forecast, black market rows |
| District control | `d.owner`, `d.inf`, `d.security`, `d.dev`, `d.facilities` | `Inf.*`, `World.reachable` | City map (`mapview.js`), right-panel district cards, tooltip |
| District operations | `f.ops` | `Actions.check/exec/defs/maxOps` | Bottom "District Ops" action cards, keys 1–5 |
| Units | `g.units`, `f.market`, `f.inventory` | `Units.*` (recruit, move, tasks, setTask, equip…) | Units-here cards, Unit Management, unit page, Recruit, Armory, move mode |
| Combat | `g.battles` | `Combat.*` (resolved inside `Turn.end`) | Battles modal, battle report, map battle marks |
| Research | `f.tech` | `Tech.*` | R&D pill, Technology Tree modal |
| Espionage | `f.spied`, `d.disrupted`, `f.leaderless` | `Espionage.check/exec/chance` | Bottom "Covert Ops" cards |
| Diplomacy | `g.relations`, `g.pacts`, `g.proposals` | `Diplo.*` | Diplomacy modal, offers in briefing, PACT tags |
| Victory | `g.victory`, `g.over` | `Victory.progress/check` | Victory modal, "closest win", game-over modal, setup options |
| AI | — (runs inside `Turn.end`) | `AI.*`, `Diplo.aiTurn`, `Market.aiTrade` | Briefing events only |
| Tutorial | `g.tutorial` | — (view only) | Coach card + highlight ring (`tutorial.js`) |

## UI redesign (after the audit)
Presentation-only changes; `git diff pre-ui-redesign -- js/core` is empty and `tests/rules-fingerprint.js`
gives identical hashes before and after.

- `css/style.css` — rewritten theme: palette tokens, Rajdhani / Inter / IBM Plex Mono, cards, responsive rules
  for 1920×1080, 1600×900, 1536×864 and 1366×768.
- `js/view/icons.js` — shared line-icon set (`ND.icon(name)`, `[data-icon]` decoration).
- `js/view/art.js` — `ND.drawBuilding` (vector art per district type) and `ND.drawDistrictHero`.
- `js/view/mapview.js` — cached static layer + ~30 fps animated layer (selection, hover, tutorial pointer);
  cells up to 1.4× wider than tall; Facilities overlay.
- `js/view/ui.js` — two-tier top bar with animated counters, faction profile card, district cards, unit cards
  with condition and equipment, action cards (icon, description, expected result, cost, OPS, reason),
  styled tooltips for every `[title]`, turn activity overlay and per-faction territory changes.
- Testing: `tests/ui-smoke.js` drives every control through the DOM; run it at each target resolution.

## UX V3 — full-screen, zero page scrolling (tag `pre-v3` = before)
Still presentation-only: `git diff pre-v3 -- js/core` is empty and the rules fingerprint is unchanged.

| Screen | Where | Purpose |
|---|---|---|
| Faction selection | `#start` (`js/main.js`) | Large portrait, pitch, traits, roster of 6; Continue / load slots / Tutorial |
| New Game Setup | `#setupscr` | Difficulty, victory condition, Advanced (seed, autosave, auto briefing) |
| City | `#game` | Top bar, left status, map (~65–70%), contextual right panel (district / unit / faction), command cards |
| Full screens | `#screen` via `ND.Screens.open(name)` | report, units, recruit, armory, research, battles, diplomacy, factions, intel, victory, treasury, settings, help, gameover |

- `css/v3.css` — V3 palette and layouts (loaded after `style.css`); minimum text size 12px.
- `js/view/screens.js` — screen framework: header with `‹ City` back, title and nav; per-screen state
  `{tab, page, sel, sub}` (reset on every new game); `ND.Screens.fill()` measures the free space and paginates
  card grids so nothing scrolls.
- `js/view/portraits.js` — vector character portraits and faction emblems.
- `g.settings.autoBriefing` — presentation-only setting (show the turn report automatically).
- Not offered (no rules support): number of AI opponents, turn limit.
- Testing: `tests/viewport-sweep.js` checks 54 states per resolution with `tests/viewport-check.js`.

## Event wiring that must keep working
Delegated click handler on `document` in `UI.init`: `[data-act]` (district ops), `[data-mode]` (map overlay),
`[data-screen]` (full screens), `[data-cmd]` (everything else, with `data-arg`/`data-arg2`). `change` on `.equip-sel`.
Keyboard: arrows, 1–5, E, Esc (closes dialog → screen → panel). Map canvas: click/hover via `MapView` handlers.
Tutorial targets: `#center`, `#resources`, `#right`, `[data-act="campaign"]`, `#topbar [data-screen="recruit"]`,
`#screen [data-cmd="recruit"]`, `#right [data-cmd="move"]`, `#right [data-order="canvass"]`, `#rdpill`,
`#screen [data-cmd="research"]`, `#btn-end`, `#screen-body`, `#screen .scr-back`, `#left .treasury-mini`,
`#topbar .tb-nav`.
