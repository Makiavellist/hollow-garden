# The Hollow Garden: Season of Horrors

A Pathfinder 1e adventure for seven 13th-level characters, packaged as a **Foundry VTT v13** module (verified on 13.351, PF1 system 11.x), with a futuristic gameshow studio built around it.

> *Contestants, the doors are open and the stakes are personal!*

## What's inside

All compendiums live in one folder in the Compendium sidebar: **The Hollow Garden: Season of Horrors**.

| Compendium | Contents |
|---|---|
| Adventure & Producer's Guide | The full adventure as a 14-page journal (Introduction → Sources), with stat blocks, read-aloud boxes, tables, the Garden flow diagram, and links to every actor, item and roll table. Plus a *Producer's Guide* to the module's controls. GM-only. |
| Contestant Handouts | *The Rules of the Show* and *Tonight's Contestants*, styled for players. |
| Robots, Holograms & Cast | PF1 NPCs: Celmak Toysiel, Celmak's Stand-In, Vlathherex, Stagehand Drone, Topiary Hound, Courtier Mannequin, Hard-Light Actor, Prize Sentinel, Gardener Colossus. Sheets match the printed stat blocks (see *Stat Block Adjustments* on each), force fields are tracked as temporary HP, and the printed stat block is in each actor's notes. |
| Prizes, Trinkets & Hoard | Celmak's 8 Trinkets, all prize and story items (lattice, Muse visor, seed, bracer, cradle, cartridge, fans, crystal, schematic, ledger, archive, Garden Credits), the auction lots and the hoard of the fallen. |
| Roll Tables | Mood Gas, Amusing and Detrimental Fakes, Celmak's Mistakes, the Mystery Box, Trinkets (drawable straight onto a sheet), Meyanda's Catalogue, Isuma's Confessional, and four tables of Celmak catchphrases (Host, Critic, Lover, Child). |
| Producer Macros | One-click macros for everything below. |
| Studio Sound Effects | A playlist of all 26 stings. |

## The studio (GM tools)

Open the **Producer Console** from the broadcast-tower button in the Token controls, the button on the ratings board, or the macro.

- **Ratings board.** A gameshow scoreboard pinned to the top of the screen. You toggle it on and off for everyone. It shows the adventure's Show Rating (1–5) with Celmak's response, plus a fan meter (0–10) for every contestant. Portraits change with mood: they cry at 0–3, stay cool at 4–6 and cheer at 7+. The leader wears a *Fan Favourite* crown, and anyone at 2 or less is in the *Danger Zone*. Hover a card for +/–. Each player can drag the board anywhere or collapse it.
- **Automatic rules** (optional). When the rating hits 5, the studio celebrates, you get an *Award Trinket* card that draws a Trinket onto the fan favourite's sheet, and the rating resets to 3. When it hits 1, you get Celmak's escalation options and it resets to 2.
- **Episode Wheel.** A spinning wheel of the episodes that haven't aired yet. It looks random, but it lands where you rigged it to. It has ticks, a drumroll, confetti and a near-miss tease, and you get a chat card linking to the episode's journal page.
- **Audience Vote.** A live poll with a countdown and jittering bars. It shows the percentages you set, or ones the console invents so your pick wins.
- **Soundboard.** 28 cues (applause, boo, buzzer, drumroll, sad trombone, airhorn…). Each plays for everyone and pops up one of the host's stickers. Shift-click a cue to preview it only for yourself.
- **Stickers.** Pop any of the host's 28 stickers on everyone's screen.
- **Celmak says…** A broadcast caption in the voice of one of her four personas, with a typewriter effect and the matching sticker. You can also draw a random catchphrase.
- **Title cards and effects.** Episode openers (*starring* the linked contestant), *Commercial Break* (optionally costs 1 rating), *Previously On…*, *The Lock Falls*, *Season Finale*, confetti, the Gap glitch, screen shake, and **Mood Gas**, which rolls the d6, tints everyone's screen and posts the DCs.
- **Honeypot check.** Roll Knowledge (engineering) from the linked sheet, or type in the total and natural d20. The console sorts the result into the honeypot bands, whispers you the table result, and laughs (+1 rating) on an obvious fake.

Each player can set their own studio volume, turn stickers off or reduce motion in their module settings.

## Casting

The default cast uses the supplied chibi art, matched to the adventure's roles. **Check these and fix any that are wrong**: *Console → Ratings → Contestants…*, where you can also link each contestant to their actor.

| Art | Role |
|---|---|
| Bodnar | The Technologist |
| Ryuz | The Merchant (fetchling) |
| Altronus | The Chronicler (kasatha) |
| Yoshea | The Ghaltan (fae) |
| Casandalee, Meyanda, Isuma | Companions |

## Install

- **Manifest URL** (repository must be public): `https://raw.githubusercontent.com/Makiavellist/hollow-garden/main/module.json`
- **Manual install:** download `hollow-garden.zip` from the latest release (or *Code → Download ZIP*), unzip it into `Data/modules/hollow-garden`, and restart Foundry.

Enable it in a PF1 world, then open the compendium folder.

## API

```js
const hg = game.modules.get("hollow-garden").api;
hg.toggleBoard();                    // show/hide the ratings board for everyone
hg.adjustShow(+1, "Heroic sacrifice");
hg.adjustContestant("bodnar", +2);
hg.cue("airhorn");                   // sound + sticker for everyone
hg.say("Nobody leaves early!", "Child");
hg.episodeTitle("auction");
hg.openRoulette(); hg.openVote(); hg.openHoneypot(); hg.moodGas();
```

## Development

The compendiums are built from sources in this repository:

```bash
cd tools
npm install
python3 build.py      # writes packs-src/ and scripts/data/generated.js
node compile.mjs      # compiles packs-src/ into LevelDB packs/
```

- `src/journal/*.html` is the adventure text, converted from the PDF. Edit it here, then rebuild.
- `tools/actors.py`, `tools/items.py` and `tools/tables.py` define the PF1 documents.
- `tools/harness/` holds a small stand-in for the Foundry API, used to exercise the UI in a plain browser.

## Credits and licences

- Adventure text, contestant art and host art: © their author. All rights reserved.
- Module code: MIT (see `LICENSE.md`).
- Feat and gear data reused from the Pathfinder 1e system for Foundry VTT, under the Open Game License (see `OGL.txt`).
- Fonts: Orbitron and Fredoka, SIL Open Font License (see `fonts/`).
- Sound effects: synthesised for this module.
- This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy. We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit paizo.com.
