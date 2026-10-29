# Man in the Chair

A modern, local-first **PWA DM screen** for fifth-edition tabletop RPGs. Think
5etools, but visually modern, offline-first, and fully private — nothing leaves
your browser.

Free and open source under the [AGPL-3.0](LICENSE). No ads, no account, nothing
locked behind a paywall.

![status: v0.1](https://img.shields.io/badge/status-v0.1-c2f04a)

## Features

- **Resizable, draggable panel grid** — arrange your screen however you run a
  session. Panels: Compendium, Stat Block, Initiative tracker, Dice, Encounter
  builder, Rules reference, Party tracker, Notes.
- **Saved layout presets** — switch between *Prep*, *Combat*, *Reference* (or
  your own) with one click. Each preset remembers its own arrangement.
- **SRD out of the box** — bundled **SRD 5.1 (2014)** and **SRD 5.2 (2024)**;
  pick your edition in the top bar.
- **Bring your own compendium** — import FightClub5e-compatible `.xml`
  (e.g. [FightClub5eXML](https://github.com/ogre-project/FightClub5eXML)) or
  native `.json`. Imports merge into the browser alongside the SRD.
- **3D dice overlay** — type `5d6` (or `2d20kh1+3`, advantage, modifiers…) and
  hit enter: physical dice tumble across the whole screen, the total lands, and
  it dismisses on click.
- **Combat tracker** — initiative order, HP with damage/heal steppers, condition
  chips, round counter, send-encounter-to-combat.
- **Encounter builder** — XP budget with the DMG encounter multiplier and a
  live difficulty rating against your party's level thresholds.
- **Dark theme first**, with a light theme toggle.
- **Installable & fully offline** — service worker precaches everything.
- **100% local** — IndexedDB (via Dexie). No account, no backend, no network.

## Getting started

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Dice notation

`NdS` with optional keep and modifiers, multiple terms joined by `+` / `-`:

| Input          | Meaning                              |
| -------------- | ------------------------------------ |
| `5d6`          | five six-sided dice                  |
| `d20`          | one d20 (count defaults to 1)        |
| `2d20kh1+3`    | advantage, +3                        |
| `2d20kl1`      | disadvantage                         |
| `4d6kh3`       | ability score (keep highest 3)       |
| `2d6+1d4+3`    | mixed dice + flat modifier           |

## Importing a compendium

Top bar → **Import** → drop `.xml` or `.json`. FightClub XML `<monster>`,
`<spell>`, and `<item>` elements are parsed; native JSON accepts
`{ monsters, spells, items, conditions, rules }` arrays matching
`src/types/index.ts`. The import layer is pluggable — add a parser in
`src/lib/import.ts` to support another format.

## Architecture

```
src/
  data/srd/{srd51,srd52}/*.json   bundled, normalized SRD (built by scripts/)
  lib/
    db.ts            Dexie (IndexedDB) schema
    compendium.ts    lazy edition loader + import merge
    import.ts        FightClub XML + native JSON parsers (pluggable)
    dice.ts          dice notation parser + roller
  store/useStore.ts  Zustand app state
  panels/            one component per panel type
  components/        Panel chrome, import dialog
  App.tsx            grid layout, presets, edition/theme controls
```

Tech: React 18 + TypeScript + Vite 5, Zustand, Dexie, react-grid-layout,
react-three-fiber (dice), fast-xml-parser, vite-plugin-pwa.

## Data & licensing

Bundled SRD content is normalized from
[5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT-licensed
project). The underlying game content is the Wizards of the Coast SRD 5.1 and
SRD 5.2, both released under CC-BY-4.0. See `ATTRIBUTION.md`.

Application code is licensed under the **GNU Affero General Public License
v3.0 only** (`AGPL-3.0-only`, see `LICENSE`). You can use, modify and host it.
If you run a modified version for other people over a network, you must offer
them its source code under the same license.

Only SRD and original content may be committed. Never add data from published
books or other copyrighted sources, including your own FightClub imports: those
stay in your browser.

"Man in the Chair" is the project's name; forks should use their own. This
project is not affiliated with Wizards of the Coast.

## Sample campaign

Settings → **Try the sample campaign** (or open the app with `?sample`) loads a
pre-filled session in a separate database that is wiped and reseeded on every
load. Your own data is never read or changed. A fresh install offers it once
from a welcome card.

## Supporting the project

The app is free; development is funded by donations. Set `SUPPORT_URL` and
`SOURCE_URL` in `src/lib/support.ts`, or the `VITE_SUPPORT_URL` /
`VITE_SOURCE_URL` environment variables at build time, to show the Support and Source code links
in Settings and the feedback dialog, and the one-time support card (shown after
the app has been opened on five different days, never again once dismissed).
