"""Roll tables from the adventure, plus Celmak's catchphrase tables used by the Producer Console."""
from lib import MODULE_ID, core_icon, hid, stats, write_doc, uuid

PACK = "hg-tables"

MOOD_GAS = [
    "<strong>Rage</strong> (as the spell, involuntary).",
    "<strong>Confusion</strong>.",
    "<strong>Crushing despair</strong>.",
    "<strong>Unnatural lust</strong> toward the nearest creature Celmak chooses.",
    "<strong>Fear</strong>: frightened, or shaken on a successful save.",
    "<strong>Euphoria</strong>: staggered, but +2 morale bonus on attack rolls.",
]
AMUSING = [
    "The schematic is a beautifully drafted diagram of a duck, labelled “PRIMARY POWER SOURCE.”",
    "The exit is through the door marked EXIT. There is no door marked EXIT. A moment later, there is; it opens onto a wall painted with a door.",
    "Celmak's one weakness is sincere compliments. Every compliment paid to the speakers raises ratings and achieves nothing else.",
    "The system log is a 400-page romance novel in which the Technologist and the Prize Sentinel fall in love. It is chapter 12.",
    "The self-destruct sequence is “up, up, down, down.” Entering it plays a laugh track and drops confetti.",
    "The device is a “Mk. IV Thinking Cap,” which grants +10 Intelligence. It is a colander with a light bulb.",
    "The anchor array is located “directly behind you.” Celmak repeats this in a spooky voice whenever the Technologist turns around.",
    "Every line of code is a hand-written note to the Technologist: “Still reading? Good.”",
    "The diagnostics confirm the Garden is powered by a hamster on a wheel. A holographic hamster appears and waves.",
    "The answer is correct, perfectly detailed, and about a completely different building on a planet that does not exist.",
]
DETRIMENTAL = [
    "A “safe” route through the next scene leads straight into a Mood Gas vent (DC 22, no warning).",
    "The character “disables” a defence and actually arms it: the next encounter gains a Stagehand Drone with a full force field.",
    "The interface plugs into the character's mind: Celmak gets a free Muse scan on them, with a −4 penalty on the save.",
    "Feedback: 6d6 electricity damage, and the character is confused for 1d4 rounds (Will DC 25 negates the confusion).",
    "A map of the Garden, accurate except that it puts the Core Vault behind the wrong wall; the party loses 10 minutes and 1 rating finding out.",
    "“Celmak's” weak point, correctly located on a robot, is a decoy plate: attacks against it in the next fight take a −4 penalty.",
    "The character “learns” the override word for the robots in the next scene; shouting it gives every robot there a free round of surprise.",
    "A broadcast that seems to reach outside the Garden actually reaches the Cast Quarters: a demon cast member is sent into the next scene, angry.",
]
MISTAKES = [
    ("The Drift is a glowing river running through the Ring, with ships sailing on it.", "The Drift is a separate plane, reached only by a ship's Drift engine."),
    ("Starships have sails and oars.", "Starships use thrusters and Drift engines."),
    ("Every kasatha has two arms.", "Kasatha have four arms."),
    ("Triune is a statue of a three-headed dragon.", "Triune is a merged god of three machine deities, not a creature."),
    ("Golarion hangs in the sky above the station, blue and whole.", "Golarion is gone; the station sits in its empty orbit."),
    ("Every sign is in Androffan.", "Signs are in Common and dozens of other languages."),
    ("Every billboard shows Celmak as “the station's beloved host.”", "Nobody in the future has ever heard of Celmak."),
    ("The Swarm are fluffy, round and adorable.", "See Scene 3."),
]
MYSTERY = [
    "A robotic rat that bites the opener (1 damage) and squeaks Celmak's catchphrase forever.",
    "A mannequin hand that waves goodbye at anyone who leaves the room. It never stops.",
    "Gems worth 2,000 gp.",
    "A <em>wand of dispel magic</em> (12 charges).",
    "A <em>ring of sustenance</em>.",
    "A cue card (Trinket) and a note in Celmak's handwriting: “I knew you'd pick this one.”",
]
CATALOGUE = [
    "<em>Steward series</em>: caretaker and tutor for colonists' children during the long voyage.",
    "<em>Field series</em>: combat medic, designed to keep soldiers alive long enough to keep fighting.",
    "<em>Envoy series</em>: interpreter and negotiator for first contact with alien peoples.",
    "<em>Display series</em>: a showroom model, built to stand in a window and be admired. Celmak's own line.",
]
CONFESSIONAL = [
    "She wishes she had been woken first instead of last.",
    "She sometimes thinks the xoarians' hosts are luckier than she is.",
    "She has stopped believing she will ever see Kasath again.",
]

# Original catchphrases in the voice of Celmak's four personas (used by the Producer Console's "Celmak says").
QUIPS = {
    "Host": [
        "Contestants, the doors are open and the stakes are personal!",
        "Welcome back to The Hollow Garden, where every exit is an entrance!",
        "Give it up for our brave, brave, slightly bleeding contestants!",
        "Stay tuned, darlings. The best part is always after the break.",
        "Ratings are UP! Somebody tell the lawyers. Oh wait. I ate the lawyers.",
        "Remember the rules: rest in the Green Room, vote with your hearts, and nobody leaves early!",
        "And now, a word from our sponsor: me!",
        "Let's spin that wheel and see whose nightmare is next!",
    ],
    "Critic": [
        "Is this a heist or a nap? I genuinely can't tell.",
        "Oh, a plan. How derivative.",
        "I've seen better tension in a wet paper bag.",
        "That was so dull I edited it while it was happening.",
        "Wonderful. Another speech. Someone get me a Mood Gas vent.",
        "You call that a near-death experience? I've had longer commercial breaks.",
        "The audience is leaving. The audience is holograms. Think about that.",
        "Three stars. Generous. I'm feeling generous.",
    ],
    "Lover": [
        "Oh, darling, you look positively radiant when you're terrified.",
        "Stay with me a little longer. The finale's lonely without you.",
        "I wrote this one just for you. Every. Single. Word.",
        "You're my favourite. Don't tell the others. They'd be devastated. On camera.",
        "Your heart rate is simply divine right now.",
        "Leave? But we were just getting to know each other's deepest fears.",
        "Come closer to the speaker, sweetheart. Closer. There.",
        "I'd give you the Booth, you know. If you asked nicely.",
    ],
    "Child": [
        "That's not fair! You broke my favourite toy!",
        "You're not supposed to do that! It's not in the script!",
        "I'm not crying. The speakers are crying.",
        "Fine. FINE. No snacks for anybody.",
        "Nobody ever plays the game properly with me.",
        "You'll be sorry when the ratings drop. You'll ALL be sorry.",
        "I made all of this for you and you don't even like it.",
        "That's cheating! Director's cut! Do it again!",
    ],
}


def table(key, name, img, desc, rows, formula=None, sort=0, folder=None, docs=None):
    tid = hid("table", key)
    results = []
    for i, r in enumerate(rows):
        rid = hid(tid, "r", i)
        res = {"_id": rid, "_key": f"!tables.results!{tid}.{rid}", "type": "text", "name": "", "description": r, "text": r, "img": img,
               "weight": 1, "range": [i + 1, i + 1], "drawn": False, "flags": {}, "_stats": stats(False)}
        if docs and docs[i]:
            d = docs[i]
            res.update({"type": "document", "name": d["name"], "description": "", "text": d["name"], "img": d["img"],
                        "documentCollection": f"{MODULE_ID}.hg-items", "documentId": d["_id"],
                        "documentUuid": uuid("hg-items", "Item", d["_id"])})
        results.append(res)
    doc = {"_id": tid, "_key": f"!tables!{tid}", "name": name, "img": img, "description": desc,
           "formula": formula or f"1d{len(rows)}", "replacement": True, "displayRoll": True, "results": results,
           "folder": folder, "sort": sort, "flags": {MODULE_ID: {"key": key}}, "_stats": stats(False)}
    write_doc(PACK, doc)
    return doc


def build(items):
    adv = hid("folder", PACK, "adventure")
    quip = hid("folder", PACK, "quips")
    for fid, name, color, sort in ((adv, "Adventure Tables", "#7a1f2b", 100), (quip, "Celmak's Catchphrases", "#c0398f", 200)):
        write_doc(PACK, {"_id": fid, "_key": f"!folders!{fid}", "name": name, "type": "RollTable", "color": color, "sorting": "m",
                         "sort": sort, "folder": None, "description": "", "flags": {}, "_stats": stats(False)})
    out = {}
    out["mood-gas"] = table("mood-gas", "Mood Gas (d6)", core_icon("icons/magic/air/fog-gas-smoke-swirling-pink.webp"),
                            "<p>Fortitude DC 22 to avoid inhaling a dose (DC 25 for Celmak's mood release); a creature that inhales attempts a Will save "
                            "at the same DC against the effect, lasting 1d4+1 rounds. Creatures that do not breathe are immune, which irritates Celmak.</p>",
                            MOOD_GAS, sort=100, folder=adv)
    out["amusing"] = table("amusing-fakes", "Honeypots: Amusing Fakes (d10)", core_icon("icons/magic/control/mouth-smile-deception-purple.webp"),
                           "<p>Knowledge (engineering) result of 60 or lower with a natural 1–10. Celmak laughs, and the ratings rise by 1.</p>",
                           AMUSING, sort=200, folder=adv)
    out["detrimental"] = table("detrimental-fakes", "Honeypots: Detrimental Fakes (d8)", core_icon("icons/magic/perception/eye-ringed-glow-angry-red.webp"),
                               "<p>Knowledge (engineering) result of 60 or lower with a natural 11–20. The character believes it until the consequences arrive.</p>",
                               DETRIMENTAL, sort=300, folder=adv)
    out["mistakes"] = table("celmaks-mistakes", "Reruns of Tomorrow: Celmak's Mistakes (d8)", core_icon("icons/magic/time/arrows-circling-pink.webp"),
                            "<p>Roll each time someone looks closely at Absalom Station. Calling out a mistake (free action, once per round) makes one Hard-Light "
                            "Actor glitch: staggered 1 round, no fast healing until the end of its next turn.</p>",
                            [f"<p><strong>Celmak shows:</strong> {a}</p><p><strong>The truth:</strong> {b}</p>" for a, b in MISTAKES], sort=400, folder=adv)
    out["mystery"] = table("mystery-box", "Lot 11: The Mystery Box (d6)", core_icon("icons/containers/boxes/crate-wooden-brown.webp"),
                           "<p>“The Mystery Box. Nobody knows. Not even me.”</p>", MYSTERY, sort=500, folder=adv)
    tr_names = ["Applause Injector", "Encore Stim", "Filter Plugs", "Spotlight Flare", "Holo-Decoy", "Static Grenade", "Cue Card",
                "From the Hoard (GM's choice)"]
    out["trinkets"] = table("trinkets", "Celmak's Trinkets (d8)", core_icon("icons/containers/chest/chest-simple-box-gold-brown.webp"),
                            "<p>Celmak hands the highest-rated contestant a Trinket when the ratings reach 5, then resets them to 3.</p>",
                            [""] * 8, sort=600, folder=adv, docs=[items[n] for n in tr_names])
    out["catalogue"] = table("catalogue", "Mint Condition: Meyanda's Catalogue (d4)", core_icon("icons/sundries/books/book-embossed-blue.webp"),
                             "<p>What the model line was built for. Celmak hopes for result 4, and if you roll anything else she quietly suggests it might be wrong.</p>",
                             CATALOGUE, sort=700, folder=adv)
    out["confessional"] = table("confessional", "The Ambassadors: Isuma's Confessional (d3)", core_icon("icons/skills/trades/music-singing-voice-blue.webp"),
                                "<p>The secret Celmak's scan pulled from Isuma, played aloud to everyone. Pick one that fits your table.</p>",
                                CONFESSIONAL, sort=800, folder=adv)
    for i, (persona, lines) in enumerate(QUIPS.items()):
        out[f"quips-{persona.lower()}"] = table(f"quips-{persona.lower()}", f"Celmak Says: The {persona}", core_icon(
            {"Host": "icons/skills/trades/music-singing-voice-blue.webp", "Critic": "icons/magic/control/fear-fright-white.webp",
             "Lover": "icons/magic/life/heart-hand-gold-green-light.webp", "Child": "icons/magic/control/fear-fright-monster-grin-purple-blue.webp"}[persona]),
            f"<p>Lines for Celmak's {persona} persona. The Producer Console draws from these for “Random line.”</p>",
            lines, sort=100 * (i + 1), folder=quip)
    return out
