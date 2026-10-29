# Changelog

## 1.3.0

- The show is now called **«Пустой сад»** everywhere players see it.
- Players never learn which persona Celmak is using: captions say «Сельмак · В ЭФИРЕ» in one colour, and chat messages come from «Сельмак».
- Fan meters now run **1–7** (start at 4): crying at 1–2, calm at 3–5, cheering at 6–7. Existing worlds are converted automatically (5 → 4).
- Players get a «Пропустить рекламу» button during adverts. It costs their contestant one fan, angry Celmak pops up for everyone, and the advert keeps playing.
- Celmak's schedule can be reordered on the Games tab (drag or arrows); title cards announce the new episode numbers and the wheel follows the order.
- Twelve escalation responses for «Celmak's response», played after the title card.
- New crowd «Ooh!», «Aww…», «Don't leave!» and Ba-dum-tss sounds from free recordings (credits in LICENSE.md).
- The adventure journal, Producer's Guide, actors, items, tables, macros and sounds are locked to the GM: the compendiums are relocked on load, imported copies of the GM journals are made GM-only again, and they can't be shown to players. Trinket chat cards link to the item on the sheet instead of the compendium.
- Fixes: dropping an actor onto a row in *Contestants…* now links it; saving the cast no longer overwrites fan changes made while the window was open; the ticked winner of an audience vote always wins; the vote's sticker respects the stickers setting.

## 1.2.0

- New **Effects** tab in the Producer Console with thirty effects in three groups, each with a Shift-click private preview, an optional duration and a *Stop all effects* button.
  - Malfunctions: blackout with an emergency beacon, TV static, no signal (colour bars and test tone), hologram desync, short circuit sparks, electric arcs, buffering, gravity failure, system crash and reboot, red alert with klaxon, lockdown blast doors (plus the Gap glitch).
  - Studio: neon signs (АПЛОДИСМЕНТЫ, ТИШИНА В СТУДИИ or custom text and colour), countdown with buzzer, spotlight on selected or targeted tokens, Celmak's camera feed, breaking-news crawl, confetti, screen shake.
  - Garden & scenes: spring, summer, autumn and winter of the Garden episode (with their rules line), stage smoke, Drift jump, dimensional lock pulse, Mood Gas vents.
- **Commercial breaks**: eleven in-world adverts in Russian with jingles, pack shots, price stickers, testimonials from the cast and fine print. A new **Ads** tab switches them on, sets how many play per break and in what order, picks which are in rotation, and previews or airs any one. The *Commercial break* button (and macro) now plays the break card, the adverts and a «Мы снова в эфире!» card. The GM can skip an advert or end the break.
- 22 new sounds (power, static, sparks, arcs, klaxon, doors, warp, seasons, neon, cash register, three ad jingles), also in the Studio SFX playlist.
- New macros: Effects Desk, Blackout, System Crash, Red Alert, Spotlight on Selected Tokens, Countdown 30 s, Stop All Effects.
- API: `effect()`, `effects()`, `stopEffects()`, `spotlight()`, `commercialBreak()`, `playCommercials()`, `previewCommercials()`, `commercials()`.

## 1.1.0

- The season is now called **Звёздные Искатели** everywhere.
- Everything the players see is in Russian: the ratings board, title cards, captions, wheel, audience votes and public chat cards. The board is titled «Полый Сад» and the contestants use the names from the art.
- Roles are gone: the board, wheel and title cards show names only. In the adventure text the PCs' roles are replaced with their names.
- The ratings board docks unobtrusively to a corner (top right by default; each player can switch corners, drag it or collapse it) and nothing on it blinks.
- Every player can set their own studio volume from the board, the Playlists sidebar or module settings.
- Rating changes are silent. At Show Rating 5 or 1 the GM gets an editable announcement to approve; nothing is broadcast until the GM presses Broadcast.
- New announcement desk in the Producer Console: Escalation…, Ratings peak… and Custom announcement…, plus a megaphone button per contestant.
- Linking actors to contestants fixed and easier: pick from the list, or drag an actor onto the card or the row. Linked cards show a chain icon and open the sheet on click.
- Honeypot laughs (+1 rating) now wait for the GM's button.
- A real applause recording (CC-BY 3.0, Blender Foundation) replaces the synthesised one.
- Fonts with Cyrillic: Exo 2 and Nunito.


## 1.0.0

Season premiere.

- The full adventure journal (14 pages) with linked actors, items and roll tables, plus a Producer's Guide and player handouts.
- PF1 actors for Celmak Toysiel, her stand-in, Vlathherex and all robots and holograms, matching the printed stat blocks.
- Trinkets, prize and story items, auction lots and the hoard of the fallen; adventure roll tables and Celmak catchphrases; macros; studio sound effects.
- GM-toggled gameshow ratings board with mood-swapping contestant portraits, fan meters and automatic ratings rules.
- Producer Console: soundboard with host stickers, "Celmak says" captions, title cards, Mood Gas, confetti, glitch, a rigged episode wheel, audience votes and honeypot checks.
