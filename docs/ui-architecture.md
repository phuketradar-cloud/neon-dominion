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

## Event wiring that must keep working
Delegated click handler on `document` in `UI.init`: `[data-act]` (district ops), `[data-mode]` (map overlay),
`[data-screen]` (modals), `[data-cmd]` (everything else, with `data-arg`/`data-arg2`). `change` on `.equip-sel`.
Keyboard: arrows, 1–5, E, Esc. Map canvas: click/hover via `MapView` handlers. Tutorial targets these selectors:
`#center`, `#resources`, `#right`, `[data-act="campaign"]`, `#topbar [data-screen="recruit"]`,
`#modal [data-cmd="recruit"]`, `#right [data-cmd="move"]`, `#right [data-order="canvass"]`, `#right .u-cur`,
`#rdpill`, `#modal [data-cmd="research"]`, `#btn-end`, `#modal .modal-box`, `#modal .modal-head [data-cmd="close"]`,
`#left .ledger`, `#topbar nav`.
