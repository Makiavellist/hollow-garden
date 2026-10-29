# The Hollow Garden: Звёздные Искатели

A Pathfinder 1e adventure for seven 13th-level characters, packaged as a **Foundry VTT v13** module (verified on 13.351, PF1 system 11.x), with a futuristic gameshow studio built around it.

> *Contestants, the doors are open and the stakes are personal!*

## What's inside

All compendiums live in one folder in the Compendium sidebar: **The Hollow Garden: Звёздные Искатели**.

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

Everything the players see (board, title cards, captions, wheel, votes, public chat cards) is in Russian. The Producer Console and the compendium content stay in English.

Open the **Producer Console** from the broadcast-tower button in the Token controls, the button on the ratings board, or the macro.

- **Ratings board.** A small panel docked to a corner (top right by default). Each player can move it to another corner (grid button), drag it, collapse it, and set **their own studio volume** with the speaker button. The same slider is in the Playlists sidebar and in module settings. The GM shows or hides the board for everyone. It shows the Show Rating (1–5) and a fan meter (0–10) per contestant, by name. Portraits change with mood, and nothing on it blinks.
- **Silent rating changes.** Raising or lowering ratings only updates the board. No sounds, no pop-ups, no chat messages.
- **Announcements with GM approval.** When the Show Rating reaches 5 or 1, a GM-only desk opens with a suggested Russian message. Edit the headline and text, then pick the sticker, sound, confetti or shake, Trinket award, escalation response and rating reset. Players see it only when you press *Broadcast*. The same desk is on the console's Ratings tab (*Escalation…*, *Ratings peak…*, *Custom announcement…*) and behind each contestant's megaphone button.
- **Episode Wheel.** A rigged wheel of the episodes that haven't aired, in Russian, *starring* the contestant's name.
- **Audience Vote.** A live poll with your rigged numbers. The presets are in Russian and use the cast's names.
- **Soundboard and stickers.** 28 cues and 28 host stickers; Shift-click previews one only for yourself.
- **Celmak says…** A broadcast caption in one of her four personas. *Random line* draws from Russian catchphrases.
- **Title cards and effects.** Episode openers, commercial break, *Previously on…*, *The lock falls*, season finale, confetti, the Gap glitch, screen shake and Mood Gas.
- **Honeypot check.** Results are whispered to you; the "Celmak laughs, +1 rating" moment is a button you choose to press.

## Casting

The board uses the names from the supplied art: Боднар, Рюз, Альтронус, Йошеа, Кассандали, Меянда, Изума. In the compendium adventure text the PCs' roles are replaced with their names (Technologist → Bodnar, Merchant → Ryuz, Chronicler → Altronus, Ghaltan → Yoshea).

**Linking actors:** drag an actor from the Actors sidebar onto a contestant's card on the board, or onto their row in *Console → Ratings → Contestants…*, or pick it from the list there. A chain icon marks a linked card; click the portrait to open the sheet. Trinkets are added to the linked sheet, and the honeypot desk rolls from it.

## Install

- **Manifest URL** (Foundry → *Add-on Modules* → *Install Module*): `https://github.com/Makiavellist/hollow-garden/releases/latest/download/module.json`
- **Manual install:** download `module.zip` from the [latest release](https://github.com/Makiavellist/hollow-garden/releases/latest), unzip it into `Data/modules/hollow-garden`, and restart Foundry.

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

Releases are published by GitHub Actions (`.github/workflows/release.yml`): bump `version` in `module.json`, add a matching `## x.y.z` section to `CHANGELOG.md`, and push to `main`.

- `src/journal/*.html` is the adventure text, converted from the PDF. Edit it here, then rebuild.
- `tools/actors.py`, `tools/items.py` and `tools/tables.py` define the PF1 documents.
- `tools/harness/` holds a small stand-in for the Foundry API, used to exercise the UI in a plain browser.

## Credits and licences

- Adventure text, contestant art and host art: © their author. All rights reserved.
- Module code: MIT (see `LICENSE.md`).
- Feat and gear data reused from the Pathfinder 1e system for Foundry VTT, under the Open Game License (see `OGL.txt`).
- Fonts: Exo 2 and Nunito (with Cyrillic), SIL Open Font License (see `fonts/`).
- Applause and cheer: "Applause" by the Blender Foundation (apricot.blender.org), CC-BY 3.0, via [OpenGameArt](https://opengameart.org/content/applause). The other sound effects were synthesised for this module.
- This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy. We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit paizo.com.
