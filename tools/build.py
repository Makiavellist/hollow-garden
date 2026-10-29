"""Build every compendium source document and the generated JS data file.

    python3 tools/build.py      # writes packs-src/**.json and scripts/data/generated.js
    node tools/compile.mjs      # compiles packs-src into LevelDB packs/
"""
import json
import os
import re
import shutil

import actors
import items as items_mod
import journal
import tables as tables_mod
from lib import MODULE_ID, ROOT, SRC_OUT, asset, hid, stats, uuid, write_doc

HOST_DIR = os.path.join(ROOT, "assets", "host")


def host(name):
    path = os.path.join(HOST_DIR, f"{name}.webp")
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    return asset(f"assets/host/{name}.webp")


def statblocks_by_actor():
    """Pull each printed stat block out of the converted journal so it can live in the actor's notes."""
    src = os.path.join(ROOT, "src", "journal")
    out = {}
    names = {"CELMAK’S STAND-IN": "Celmak's Stand-In", "CELMAK TOYSIEL": "Celmak Toysiel", "VLATHHEREX": "Vlathherex",
             "STAGEHAND DRONE": "Stagehand Drone", "TOPIARY HOUND": "Topiary Hound", "COURTIER MANNEQUIN": "Courtier Mannequin",
             "HARD-LIGHT ACTOR": "Hard-Light Actor", "PRIZE SENTINEL": "Prize Sentinel", "GARDENER COLOSSUS": "Gardener Colossus"}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".html"):
            continue
        html = open(os.path.join(src, fn), encoding="utf-8").read()
        for m in re.finditer(r'<section class="hg-statblock"><h4 class="hg-sb-title">(.*?) — CR \d+</h4>.*?</section>', html, re.S):
            key = m.group(1).strip()
            if key in names:
                block = journal.fix_statblocks(m.group(0))
                out[names[key]] = f'<div class="hg-journal"><h3>Printed stat block</h3>{block}</div>'
    return out


SOUNDS = [
    ("applause", "Applause"), ("cheer", "Big Cheer"), ("boo", "Boo"), ("crowd-ooh", "Crowd: Ooh!"), ("crowd-aww", "Crowd: Aww"),
    ("correct", "Correct Ding"), ("buzzer", "Wrong Buzzer"), ("drumroll", "Drumroll"), ("fanfare", "Fanfare"), ("sad-trombone", "Sad Trombone"),
    ("rimshot", "Rimshot"), ("airhorn", "Airhorn"), ("suspense", "Suspense Sting"), ("jingle", "Commercial Break Jingle"),
    ("rating-up", "Ratings Up"), ("rating-down", "Ratings Down"), ("alarm", "Escalation Alarm"), ("countdown", "Countdown"),
    ("glitch", "Glitch (The Gap)"), ("gas", "Mood Gas Hiss"), ("confetti", "Confetti Pop"), ("spin-start", "Wheel Wind-Up"),
    ("tick", "Wheel Tick"), ("whoosh", "Whoosh"), ("on-air", "On Air Sting"), ("kiss", "Blown Kiss"),
    ("power-down", "Power Down"), ("power-up", "Power Up"), ("static", "TV Static (loop)"), ("tv-tone", "Test Tone"),
    ("sparks", "Sparks"), ("zap", "Electric Zap"), ("buzz", "Electric Hum (loop)"), ("klaxon", "Klaxon (loop)"),
    ("error", "System Error"), ("doors", "Blast Doors"), ("warp", "Drift Jump"), ("shockwave", "Shockwave"),
    ("wind", "Wind (loop)"), ("cicadas", "Cicadas (loop)"), ("chimes", "Spring Chimes"), ("camera", "Camera Shutter"),
    ("neon", "Neon Sign"), ("spotlight", "Spotlight Clunk"), ("cash", "Cash Register"),
    ("ad-jingle-a", "Ad Jingle A"), ("ad-jingle-b", "Ad Jingle B"), ("ad-jingle-c", "Ad Jingle C"),
]
LOOPED = {"static", "buzz", "klaxon", "wind", "cicadas"}

MACROS = [
    ("Producer Console", "mic-welcome", "api.openConsole();"),
    ("Toggle Ratings Board", "ratings", "api.toggleBoard();"),
    ("Spin the Episode Wheel", "presenting", "api.openRoulette();"),
    ("Audience Vote", "countdown", "api.openVote();"),
    ("Honeypot Check", "thinking", "api.openHoneypot();"),
    ("Celmak Says…", "blow-kiss", "api.openConsole('broadcast');"),
    ("Show Rating +1", "cheer", "api.adjustShow(1, 'Macro');"),
    ("Show Rating −1", "bored", "api.adjustShow(-1, 'Macro');"),
    ("Mood Gas Vent", "smug", "api.moodGas();"),
    ("Award Trinket to Fan Favourite", "trophy", "api.awardTrinket();"),
    ("Commercial Break", "this-is-fine", "api.commercialBreak();"),
    ("Previously On…", "shocked", "api.titleCard('previously');"),
    ("The Gap (Glitch)", "confused", "api.glitch();"),
    ("Confetti!", "champion", "api.confetti();"),
    ("Effects Desk", "presenting", "api.openConsole('effects');"),
    ("Malfunction: Blackout", "nervous", "api.effect('blackout');"),
    ("Malfunction: System Crash", "crying", "api.effect('crash');"),
    ("Red Alert", "angry", "api.effect('redalert');"),
    ("Spotlight on Selected Tokens", "wink", "api.spotlight();"),
    ("Countdown 30 s", "countdown", "api.effect('countdown', { seconds: 30 });"),
    ("Stop All Effects", "access-denied", "api.stopEffects();"),
]


def build_macros():
    pack = "hg-macros"
    for i, (name, img, cmd) in enumerate(MACROS):
        mid = hid("macro", name)
        command = (f"// The Hollow Garden: {name}\nconst api = game.modules.get(\"{MODULE_ID}\")?.api;\n"
                   f"if (!api) return ui.notifications.warn(\"The Hollow Garden module is not active.\");\n{cmd}")
        write_doc(pack, {"_id": mid, "_key": f"!macros!{mid}", "name": name, "type": "script", "img": host(img), "command": command,
                         "scope": "global", "folder": None, "sort": (i + 1) * 100, "flags": {}, "_stats": stats(False)})


def build_playlist():
    pack = "hg-sounds"
    pid = hid("playlist", "sfx")
    sounds = []
    for i, (key, name) in enumerate(SOUNDS):
        sid = hid(pid, key)
        sounds.append({"_id": sid, "_key": f"!playlists.sounds!{pid}.{sid}", "name": name, "path": asset(f"sounds/{key}.ogg"),
                       "repeat": key in LOOPED, "volume": 0.8, "fade": None, "sort": (i + 1) * 100, "flags": {}, "_stats": stats(False)})
    write_doc(pack, {"_id": pid, "_key": f"!playlists!{pid}", "name": "The Hollow Garden: Studio SFX", "description": "Gameshow stings for Celmak's studio.",
                     "mode": -1, "channel": "environment", "sounds": sounds, "folder": None, "sort": 0, "flags": {}, "_stats": stats(False)})


def main():
    if os.path.exists(SRC_OUT):
        shutil.rmtree(SRC_OUT)
    statblocks = statblocks_by_actor()
    missing = [n for n in ("Celmak's Stand-In", "Celmak Toysiel", "Vlathherex", "Stagehand Drone", "Topiary Hound", "Courtier Mannequin",
                           "Hard-Light Actor", "Prize Sentinel", "Gardener Colossus") if n not in statblocks]
    if missing:
        raise SystemExit(f"stat blocks not found: {missing}")
    A = actors.build(statblocks, host)
    I = items_mod.build()
    T = tables_mod.build(I)
    J = journal.build(A, I, T, host)
    build_macros()
    build_playlist()

    gen = {
        "episodes": J["episodes"],
        "contestants": [{"id": c, "name": ru} for c, _en, ru in journal.CONTESTANTS],
        "tables": {k: uuid("hg-tables", "RollTable", v["_id"]) for k, v in T.items()},
        "items": {"credit": uuid("hg-items", "Item", I["Garden Credit"]["_id"])},
        "journal": f"Compendium.{MODULE_ID}.hg-adventure.JournalEntry.{J['journal']}",
        "actors": {a["name"]: uuid("hg-bestiary", "Actor", a["_id"]) for a in A},
    }
    out = os.path.join(ROOT, "scripts", "data")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "generated.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/build.py. Do not edit by hand.\n")
        fh.write("export const GENERATED = " + json.dumps(gen, indent=2, ensure_ascii=False) + ";\n")
    # test-harness data (tools/harness) so the UI can be exercised without Foundry
    harness = {"tables": {v["_id"]: v for v in T.values()}, "items": {v["_id"]: v for v in I.values()}}
    with open(os.path.join(ROOT, "tools", "harness", "docs.json"), "w", encoding="utf-8") as fh:
        json.dump(harness, fh, ensure_ascii=False)
    counts = {d: len(os.listdir(os.path.join(SRC_OUT, d))) for d in sorted(os.listdir(SRC_OUT))}
    print("built", counts)


if __name__ == "__main__":
    main()
