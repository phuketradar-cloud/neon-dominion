# Neon Dominion — Phases 1–5 (complete)

2D cyberpunk turn-based territory-control strategy game. Plain HTML5/CSS/JavaScript, no build step, no dependencies.

## Run

```
node serve.js
```
Then open http://localhost:8080. (Any static file server works.)

## Architecture

| Layer | Files | Notes |
|---|---|---|
| Core rules (no DOM) | `js/core/rng.js`, `data.js`, `world.js`, `economy.js`, `actions.js`, `units.js`, `combat.js`, `tech.js`, `espionage.js`, `diplomacy.js`, `victory.js`, `market.js`, `ai.js`, `turn.js`, `save.js` | All state is one plain JSON object (`g`), including the seeded RNG, so saves are exact. |
| Presentation | `js/view/icons.js`, `art.js`, `portraits.js`, `mapview.js`, `ui.js`, `screens.js`, `tutorial.js`, `js/main.js`; `css/style.css` + `css/v3.css` | Reads state and calls core functions — never mutates rules directly. |

Player and AI factions use the same core functions (`ND.Actions`, `ND.Units`), so costs and rules are identical.

## UX V3 — full-screen, zero page scrolling

Every screen fits the viewport (tested at 1366×768, 1536×864, 1600×900, 1920×1080); long content uses tabs, pagination and detail panels instead of scrolling.

- **Faction selection** → **New Game Setup** (difficulty, victory condition, advanced: seed / autosave / auto briefing) → city.
- **City**: compact top bar (resources, turn, ops, units, research, screen nav, End Turn), left status column, map, contextual right panel (district / unit / faction), command cards below the map.
- **Full screens** (`ND.Screens`, `js/view/screens.js`): Turn report, Units, Recruit, Armory, Research tree, Battles, Diplomacy, Factions, Intel, Objectives, Treasury, Settings, Manual, Victory/Defeat. Each has a title, the same nav and a `‹ City` back button (Esc also closes).
- Not offered because the rules do not support them: number of AI opponents (all 6 factions always play) and a turn limit.

Tests: `node tests/rules-fingerprint.js .` (rules unchanged), and in the browser console `tests/ui-smoke.js` (every control) and `tests/viewport-sweep.js` (54 screen/tab states checked for overflow, clipping and text under 12px).

## Phase 1 scope (done)

10×10 city grid, 10 district types, 6 factions with mechanical bonuses/weaknesses, influence vs. control,
4 resources with income/upkeep/net forecast, 5 district operations, 9-step turn sequence, rival AI with
personalities, intelligence briefings, territorial/domination victory, save/load (3 slots + autosave).

## Phase 2 scope (done)

8 unit types with rolled stats, procedural portraits, recruitment cost, maintenance, special ability, 2–3 equipment
slots and 5 experience levels. Per-turn hiring market (faction signature units cheaper and more common), roster cap,
movement through connected territory, standing orders (canvass, guard, seize/sabotage facility, gather intel,
train, establish HQ, rest), injuries, deaths, desertion on unpaid payroll. Armory with 11 items. Facilities are
ownable separately from districts and yield income + influence. AI recruits, equips and orders its units.
Saves from Phase 1 are migrated automatically.

## Phase 3 scope (done)

Automatic multi-round combat (`js/core/combat.js`): hit chance from ATK vs DEF, damage reduced by armor,
per-battle HP, morale rolls, equipment, faction combat doctrines and district defense bonuses (security,
development, HQ, guard stance). Attack orders (assault a rival's units or raid an undefended hold) and guard
interceptions of intruders. Casualties (killed / wounded), XP, influence consequences, repelled orders.
Full battle reports (sides, modifiers, round-by-round log, aftermath), Battle Reports screen, battle markers on
the map, win estimates on attack orders. AI attacks when the odds favour it and avoids guarded districts.

## Phase 4 scope (done)

Technology tree (`js/core/tech.js`): Military (5), Biological (4) and Information (5) branches with prerequisites,
plus one signature technology per faction. Up-front cost in credits/materials/energy/intel and multi-turn research
points driven by research districts and facilities; cancel refunds 50%. Every tech has a concrete rule effect
(combat bonuses, recruitment, guard strength, visibility, OPS, upkeep, influence regrowth, new item and operation).
Covert operations (`js/core/espionage.js`): Spy, Manipulate Public Opinion, Disrupt Income, Sabotage Factory,
Steal Technology, Plague Release, Assassinate Leader — success chances with a visible breakdown, failure
consequences (alerts, exposure, wounded/executed operatives), leaderless and sabotaged states. AI researches by
personality and runs one covert operation per turn when worthwhile.

## Phase 5 scope (done)

- **Victory conditions** (`js/core/victory.js`): Territorial, Total Domination, Economic, Technological (the
  Singularity Protocol capstone, which needs all 14 branch techs) and Political. Each can be switched on/off with
  its own target on the start screen; any faction can win any of them.
- **Difficulty**: Easy / Normal / Hard scales rival income (×0.8 / ×1 / ×1.25).
- **Diplomacy** (`js/core/diplomacy.js`): relations from −100 to +100, moved by battles, raids, captures and
  exposed covert operations (at most −6 per pair per turn, recovering 3 per turn). 12-turn non-aggression pacts
  block every hostile action between partners. The AI proposes, accepts and occasionally betrays; you can
  propose, answer offers (Diplomacy screen or briefing) and break pacts at a reputation cost.
- **Black market** (`js/core/market.js`): sell or buy energy, materials and intel against credits; controlled
  Black Market districts improve rates. The AI sells its surpluses.
- **Polish**: glowing territory borders, a turn transition card, an end-of-game statistics table, and saves
  trimmed (round-by-round logs only for the latest 20 battles).
- **Saves** from every earlier phase migrate automatically.

## Balance notes (30 AI-only games, default settings)

23 of 30 games end (average turn ~158). Winners: Street Reapers 9, Syndicate 7, Bio Mutants 2, Cyber Cult 2,
with 7 timeouts at turn 250 and 3 cases where the simulated "player" faction was eliminated. Territorial and
Economic wins dominate; Iron Legion and Shadow Network rarely win AI-only games, and Political and
Technological victories did not occur in this sample. A human player shifts these numbers considerably.
