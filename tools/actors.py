"""PF1 NPC actors for The Hollow Garden.

Statistics are built so that the PF1 system's own derived numbers match the printed stat blocks:
base values come from class/race items, and anything the system cannot know (feat bonuses, racial
bonuses, gear already folded into the printed numbers) is added as a labelled "untyped" change.
The printed stat block is also stored in the actor's notes.
"""
import copy
import json
import math
import os
import re

from lib import MODULE_ID, asset, cid, core_icon, hid, stats, write_doc

PACK = "hg-bestiary"
HERE = os.path.dirname(__file__)
PF1 = json.load(open(os.path.join(HERE, "pf1-cache.json")))

SIZE_ATK = {"tiny": 2, "sm": 1, "med": 0, "lg": -1, "huge": -2, "grg": -4}
TOKEN_SIZE = {"tiny": 0.5, "sm": 1, "med": 1, "lg": 2, "huge": 3, "grg": 4}
SKILL_ABIL = {"acr": "dex", "blf": "cha", "clm": "str", "dip": "cha", "dev": "dex", "dis": "cha", "fly": "dex",
              "int": "cha", "ken": "int", "klo": "int", "kna": "int", "kpl": "int", "per": "wis", "sen": "wis",
              "ste": "dex", "prf": "cha"}
CONSTRUCT_CI = ["bleed", "deathEffects", "disease", "energyDrain", "exhausted", "fatigue", "mindAffecting", "paralyze",
                "poison", "sleep", "stun"]


def mod(score):
    return 0 if score is None else math.floor((score - 10) / 2)


def bab_for(prog, lvl):
    return {"high": lvl, "med": math.floor(lvl * 3 / 4), "low": math.floor(lvl / 2)}[prog]


def save_for(prog, lvl):
    return 2 + math.floor(lvl / 2) if prog == "high" else math.floor(lvl / 3)


def change(owner, target, formula, ctype="untyped", note=""):
    return {"_id": cid(owner, target, ctype, note), "formula": str(formula), "target": target, "type": ctype, "operator": "add"}


def embedded(actor_id, item):
    item["_key"] = f"!actors.items!{actor_id}.{item['_id']}"
    item.setdefault("_stats", stats())
    return item


def feat_copy(actor_id, name):
    base = name.split(" (")[0]
    src = copy.deepcopy(PF1["feats"][base])
    old = src["_id"]
    src.pop("folder", None)
    src["_id"] = hid(actor_id, "feat", name)
    src["name"] = name
    sysd = src.setdefault("system", {})
    sysd.pop("changes", None)  # the printed totals already include feat bonuses
    sysd.pop("changeFlags", None)
    src["_stats"] = dict(stats(), compendiumSource=f"Compendium.pf1.feats.Item.{old}")
    return embedded(actor_id, src)


def spell_link(name, label=None):
    sid = PF1["spells"].get(name)
    label = label or name.lower()
    if not sid:
        return f"<em>{label}</em>"
    return f"<em>@UUID[Compendium.pf1.spells.Item.{sid}]{{{label}}}</em>"


def feature(actor_id, name, desc, kind="ex", img=None, uses=None, action=None, subtype="misc"):
    sysd = {"subType": subtype, "abilityType": kind, "description": {"value": desc}}
    if uses:
        sysd["uses"] = {"per": uses[1], "maxFormula": str(uses[0]), "value": uses[0]}
    if action:
        a = {"_id": hid(actor_id, name, "action"), "name": action.get("name", "Use"),
             "activation": {"type": action.get("activation", "standard"), "unchained": {"type": "action", "cost": 2}},
             "actionType": action.get("actionType", "other")}
        if "save" in action:
            a["save"] = {"type": action["save"][0], "dc": str(action["save"][1]), "description": action["save"][2]}
        if "damage" in action:
            a["damage"] = {"parts": [{"formula": f, "types": t} for f, t in action["damage"]]}
            a["ability"] = {"damage": "", "attack": ""}
        if "template" in action:
            a["measureTemplate"] = {"type": action["template"][0], "size": str(action["template"][1])}
        if "range" in action:
            a["range"] = {"value": str(action["range"]), "units": "ft"}
        if "uses_cost" in action:
            a["uses"] = {"autoDeductChargesCost": str(action["uses_cost"])}
        if "notes" in action:
            a["notes"] = {"effect": action["notes"], "footer": []}
        if "duration" in action:
            a["duration"] = {"value": action["duration"][0], "units": action["duration"][1]}
        sysd["actions"] = [a]
    return embedded(actor_id, {"_id": hid(actor_id, "feature", name), "name": name, "type": "feat",
                               "img": img or core_icon("icons/magic/control/silhouette-aura-energy.webp"), "system": sysd})


def attack(actor_id, spec, sheet):
    """spec: name, printed, abil, count, dmg[(formula, types)], crit, critMult, touch, ranged, range, notes, natural"""
    bab = sheet["bab"]
    abil = spec.get("abil", "str")
    expected = bab + mod(sheet["abilities"].get(abil)) + SIZE_ATK[sheet["size"]]
    resid = spec["printed"] - expected
    act = {
        "_id": hid(actor_id, spec["name"], "atk"),
        "name": "Attack",
        "activation": {"type": "attack", "unchained": {"type": "attack"}},
        "actionType": "rwak" if spec.get("ranged") else "mwak",
        "ability": {"attack": abil, "damage": "", "critRange": spec.get("crit", 20), "critMult": spec.get("critMult", 2)},
        "attackBonus": str(resid) if resid else "",
        "damage": {"parts": [{"formula": f, "types": t} for f, t in spec["dmg"]]},
        "range": ({"units": "ft", "value": str(spec.get("range", 60)), "maxIncrements": 10} if spec.get("ranged") else {"units": "melee"}),
        "touch": bool(spec.get("touch")),
        "naturalAttack": {"primary": True},
    }
    if spec.get("count", 1) > 1:
        act["extraAttacks"] = {"type": "custom", "formula": {"count": str(spec["count"] - 1), "label": spec.get("label", spec["name"]) + " #{0}"}}
    elif spec.get("iteratives"):
        act["extraAttacks"] = {"type": "standard"}
    if spec.get("notes"):
        act["notes"] = {"effect": [], "footer": spec["notes"]}
    desc = spec.get("desc", "")
    return embedded(actor_id, {
        "_id": hid(actor_id, "attack", spec["name"]), "name": spec["name"], "type": "attack",
        "img": core_icon(spec.get("img", "icons/creatures/abilities/fangs-teeth-bite.webp")),
        "system": {"subType": "natural" if spec.get("natural", True) else "weapon", "proficient": True,
                   "actions": [act], "description": {"value": desc}, "showInQuickbar": True}})


def build_actor(spec, notes_html):
    aid = hid("actor", spec["name"])
    abilities = spec["abilities"]
    size = spec["size"]
    classes = spec["classes"]
    items = []
    changes = []

    # --- race (creature type & subtypes) ---
    race = spec["race"]
    items.append(embedded(aid, {
        "_id": hid(aid, "race"), "name": race["name"], "type": "race",
        "img": "systems/pf1/icons/races/creature-types/construct.png" if race["types"] == ["construct"] else "systems/pf1/icons/races/creature-types/outsider.png",
        "system": {"creatureTypes": race["types"], "creatureSubtypes": race.get("subtypes", []), "size": size,
                   "speeds": {"land": spec["speed"].get("land", 30)},
                   "description": {"value": race.get("desc", "")}}}))

    # --- classes ---
    bab = 0
    base_saves = {"fort": 0, "ref": 0, "will": 0}
    hd_total = 0
    class_hp = 0
    for c in classes:
        lvl = c["level"]
        hd_total += lvl
        bab += bab_for(c["bab"], lvl)
        for s in base_saves:
            base_saves[s] += save_for(c["saves"].get(s, "low"), lvl)
        class_hp += c["hp"]
        csys = {"subType": c.get("subType", "racial"), "level": lvl, "hd": c.get("hd", 10), "hp": c["hp"], "bab": c["bab"],
                "skillsPerLevel": c.get("skills", 2), "tag": c["tag"],
                "savingThrows": {k: {"value": v} for k, v in c["saves"].items()},
                "description": {"value": c.get("desc", "")}}
        if c.get("construct"):
            csys["changes"] = [{"_id": cid(aid, "cbonus"), "formula": "max(0, @size - 2) * 10 + max(0, @size - 6) * 10",
                                "target": "mhp", "type": "untypedPerm", "operator": "add"}]
        items.append(embedded(aid, {"_id": hid(aid, "class", c["name"]), "name": c["name"], "type": "class",
                                    "img": c.get("img", "systems/pf1/icons/skills/mech_7.jpg"), "system": csys}))
    sheet = {"bab": bab, "abilities": abilities, "size": size}

    # --- residual changes so the sheet matches the printed numbers ---
    printed = spec["printed"]
    for s in ("fort", "ref", "will"):
        abil = {"fort": "con", "ref": "dex", "will": "wis"}[s]
        r = printed[s] - (base_saves[s] + mod(abilities.get(abil)))
        if r:
            changes.append(change(aid, s, r, note="save"))
    r = printed["init"] - mod(abilities.get("dex"))
    if r:
        changes.append(change(aid, "init", r))
    if spec.get("deflection"):
        changes.append(change(aid, "ac", spec["deflection"], "deflection"))
    if spec.get("dodge"):
        changes.append(change(aid, "ac", spec["dodge"], "dodge"))
    if spec.get("mhp"):
        changes.append(change(aid, "mhp", spec["mhp"]))

    skills = {}
    for key, total in spec.get("skills", {}).items():
        sub = None
        if ":" in key:
            key, sub = key.split(":")
        am = mod(abilities.get(SKILL_ABIL[key]))
        ranks = max(0, min(hd_total, total - am))
        if key == "fly":  # size and manoeuvrability are applied by the system; ranks only
            skills[key] = {"rank": ranks}
            continue
        if sub:
            sk = skills.setdefault(key, {"subSkills": {}})
            sk["subSkills"][sub] = {"name": sub.title(), "ability": SKILL_ABIL[key], "rank": max(0, total - am), "rt": False, "acp": False}
            continue
        skills[key] = {"rank": ranks}
        r = total - am - ranks
        if r:
            changes.append(change(aid, f"skill.{key}", r, note=key))
    if changes:
        items.append(embedded(aid, {"_id": hid(aid, "adjust"), "name": "Stat Block Adjustments", "type": "feat",
                                    "img": core_icon("icons/commodities/tech/dial-meter-gauge-blue.webp"),
                                    "system": {"subType": "misc", "abilityType": "na", "changes": changes,
                                               "description": {"value": "<p>Bonuses from feats, gear, racial traits and special qualities that are "
                                                                         "already folded into the printed stat block. Keeping them here lets the PF1 "
                                                                         "sheet show the same totals as the adventure. Delete a change if you add the "
                                                                         "matching item with its own mechanics.</p>"}}}))

    for f in spec.get("feats", []):
        items.append(feat_copy(aid, f))
    for a in spec.get("attacks", []):
        items.append(attack(aid, a, sheet))
    for fe in spec.get("features", []):
        items.append(feature(aid, **fe))
    for g in spec.get("gear", []):
        g = copy.deepcopy(g)
        g["_id"] = hid(aid, "gear", g["name"])
        items.append(embedded(aid, g))

    t = spec.get("traits", {})
    system = {
        "abilities": {k: {"value": v} for k, v in abilities.items()},
        "attributes": {
            "naturalAC": spec.get("natural", 0),
            "hp": {"temp": spec.get("forcefield", 0)},
            "speed": {k: ({"base": v} if k != "fly" else {"base": v[0], "maneuverability": v[1]}) for k, v in spec["speed"].items()},
            "cmdNotes": spec.get("cmdNotes", ""),
            "saveNotes": spec.get("saveNotes", ""),
            "acNotes": spec.get("acNotes", ""),
            "quadruped": spec.get("quadruped", False),
            "sr": {"formula": str(spec["sr"]) if spec.get("sr") else ""},
        },
        "details": {
            "cr": {"base": spec["cr"]},
            "alignment": spec["alignment"],
            "biography": {"value": spec.get("bio", "")},
            "notes": {"value": notes_html},
        },
        "skills": skills,
        "traits": {
            "size": size,
            "senses": spec.get("senses", {}),
            "ci": t.get("ci", []),
            "di": t.get("di", []),
            "dv": t.get("dv", []),
            "dr": {"value": t.get("dr", []), "custom": ""},
            "eres": {"value": t.get("eres", []), "custom": ""},
            "fastHealing": t.get("fastHealing", ""),
            "languages": t.get("languages", []),
        },
    }
    img = spec["img"]
    ts = TOKEN_SIZE[size]
    actor = {
        "_id": aid, "_key": f"!actors!{aid}", "name": spec["name"], "type": "npc", "img": img,
        "system": system, "items": items, "folder": spec.get("folder"), "sort": spec.get("sort", 0),
        "prototypeToken": {"name": spec.get("token_name", spec["name"]), "width": max(ts, 1), "height": max(ts, 1),
                           "texture": {"src": img, "scaleX": 0.8 if size == "sm" else 1, "scaleY": 0.8 if size == "sm" else 1},
                           "disposition": spec.get("disposition", -1), "actorLink": spec.get("actorLink", False),
                           "displayName": 20, "displayBars": 20, "bar1": {"attribute": "attributes.hp"},
                           "sight": {"enabled": True, "range": 60 if spec.get("senses", {}).get("dv") else 0}},
        "flags": {MODULE_ID: {"statblock": True}},
        "_stats": stats(),
    }
    return actor


# ---------------------------------------------------------------------------
# Shared text
ROBOT_TRAITS = ("<p><strong>Robot traits.</strong> Robots are constructs (Bestiary 5). They are vulnerable to critical hits "
                "(critical hits deal an extra ×1 multiplier, for example ×3 instead of ×2) and to electricity (+50% damage). "
                "Many carry a force field and integrated weapons.</p>")


def force_field(aid_name, hp, fh):
    return dict(name="Force Field", kind="ex", img=core_icon("icons/magic/control/debuff-energy-hold-levitate-teal-blue.webp"),
                desc=(f"<p>The robot is sheathed in a force field with <strong>{hp} hit points</strong> and <strong>fast healing {fh}</strong>. "
                      "Damage is applied to the force field before the robot's own hit points, and the fast healing applies only to the field. "
                      "A field reduced to 0 hp goes down and regenerates at its fast healing rate.</p>"
                      "<p><em>Track the force field as this actor's temporary hit points.</em></p>"))


def robot_traits():
    return dict(name="Robot Traits", kind="ex", img=core_icon("icons/commodities/tech/metal-panel.webp"), desc=ROBOT_TRAITS)


HOLOGRAM = ("<p><strong>Hologram subtype.</strong> A hologram is a construct of solid light. It is immune to critical hits and "
            "precision damage. It is emitter-bound and subject to shadow disruption.</p>")


def construct_hd(level, hp, construct=True, name="Construct (Robot)"):
    return {"name": name, "level": level, "hp": hp, "bab": "high", "saves": {"fort": "low", "ref": "low", "will": "low"},
            "tag": "construct", "construct": construct, "hd": 10, "skills": 2,
            "desc": "<p>Racial Hit Dice: d10, full BAB, poor saves, no Constitution. Constructs gain bonus hit points by size.</p>"}


def robot_race(name="Robot", sub=("robot",)):
    return {"name": name, "types": ["construct"], "subtypes": list(sub)}


ROBOT_TRAIT_BLOCK = {"ci": CONSTRUCT_CI, "dv": ["electric"]}


def specs(host):
    """Return the actor specs. `host` maps sticker names to image paths."""
    S = []

    # ---------------- Celmak's stand-in ----------------
    S.append(dict(
        name="Celmak's Stand-In", folder="celmak", sort=100, cr=15, alignment="tn", size="med", img=host("presenting"),
        disposition=0,
        race=robot_race("Pleasure Mannequin (stand-in)"), classes=[construct_hd(20, 110)],
        abilities={"str": 14, "dex": 20, "con": None, "int": None, "wis": None, "cha": None},
        printed={"init": 10, "fort": 6, "ref": 11, "will": 12}, natural=11, deflection=4, forcefield=75,
        speed={"land": 40}, senses={"dv": {"value": 60}, "ll": {"enabled": True}, "custom": "Garden sight"},
        skills={"per": 27},
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="15 (force field only)", languages=["androffan", "common", "hallit"]),
        attacks=[
            dict(name="Nanite Caress", printed=26, count=2, label="Caress", dmg=[("2d6+2", ["bludgeoning"]), ("3d6", ["sonic"])],
                 img="icons/magic/control/energy-stream-link-white.webp"),
            dict(name="Spotlight Laser", printed=25, abil="dex", ranged=True, touch=True, range=60, dmg=[("8d6", ["fire"])],
                 img="icons/commodities/tech/bulb.webp", natural=False),
        ],
        features=[
            force_field("stand-in", 75, 15), robot_traits(),
            dict(name="Puppet Link", desc="<p>While Celmak pilots the stand-in, it uses her mental ability scores, saves and skills, and she can "
                 "use her own special abilities through it as if she were standing where it is (director's cut, holographic direction, mood "
                 "release, Muse scan, reconfigure, spotlight). Uses of director's cut come out of her daily total.</p>",
                 img=core_icon("icons/magic/control/control-influence-puppet.webp")),
            dict(name="Remote-Piloted", desc="<p>The stand-in has no mind of its own. When it is destroyed, or the Core is shut down, it collapses, "
                 "and the link breaks harmlessly. Switching to a spare stand-in in the Core Vault takes Celmak 1d4 rounds. She has two spares.</p>",
                 img=core_icon("icons/magic/control/energy-stream-link-blue.webp")),
        ],
        bio="<p>A slim figure in a perfect suit, porcelain-smooth and seamed at the joints: one of three remote mannequins built to look exactly "
            "like Celmak. It never leaves the Booth in the finale; it fights from behind the glass with its spotlight laser, spotlight and mood release.</p>",
    ))

    # ---------------- Celmak Toysiel ----------------
    S.append(dict(
        name="Celmak Toysiel", folder="celmak", sort=200, cr=13, alignment="ce", size="med", img=host("smug"), disposition=0, actorLink=True,
        race=robot_race("Pleasure Mannequin"), classes=[construct_hd(20, 110)],
        abilities={"str": 14, "dex": 22, "con": None, "int": 24, "wis": 18, "cha": 20},
        printed={"init": 10, "fort": 6, "ref": 12, "will": 14}, natural=10, deflection=4, dodge=1, forcefield=85,
        speed={"land": 40}, senses={"dv": {"value": 60}, "ll": {"enabled": True}, "custom": "Garden sight"},
        skills={"blf": 35, "dip": 35, "dev": 29, "dis": 29, "int": 29, "ken": 30, "klo": 27, "per": 29, "prf:act": 31, "sen": 29},
        feats=["Alertness", "Deceitful", "Dodge", "Improved Initiative", "Iron Will", "Mobility", "Persuasive", "Skill Focus (Bluff)",
               "Skill Focus (Diplomacy)", "Skill Focus (Perform)"],
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="17 (force field only)",
                    languages=["androffan", "common", "hallit", "any language spoken by a creature she has scanned"]),
        features=[
            force_field("celmak", 85, 17), robot_traits(),
            dict(name="Applause", desc="<p>Whenever the ratings rise, Celmak's force field regains 17 hit points, even if it has been shut down.</p>",
                 img=core_icon("icons/magic/control/buff-luck-fortune-rainbow.webp")),
            dict(name="Dead-Man Switch", desc="<p>If Celmak is destroyed, every Mood Gas reservoir in the Garden vents at once. For 1 hour, every "
                 "creature in the Garden must save against Mood Gas (DC 25) every 10 minutes, rolling the effect randomly each time. Disarming "
                 "the switch takes 10 minutes and a DC 35 Disable Device check in the Cutting Room; Celmak will reveal the panel's location only as part of a bargain.</p>",
                 img=core_icon("icons/commodities/tech/detonator-timer.webp")),
            dict(name="Director's Cut", uses=(3, "day"), desc="<p>Three times per day as an immediate action, Celmak can force a creature she "
                 "perceives within 120 feet (of her or her stand-in) to reroll a d20 it just rolled. The creature must take the second result.</p>",
                 img=core_icon("icons/magic/control/modfiy-luck-fortune-red.webp"),
                 action=dict(name="Cut!", activation="immediate", uses_cost=1, range=120)),
            dict(name="Garden Sight", desc="<p>While the Core runs, cameras let Celmak perceive everything inside the Garden. She cannot be surprised "
                 "or flanked there. Each room holds about ten hidden cameras (Perception DC 25 to find; hardness 5, 10 hp); destroying all of them "
                 "blinds Celmak in that room.</p>", img=core_icon("icons/magic/control/hypnosis-mesmerism-eye.webp")),
            dict(name="Holographic Direction", desc=f"<p>While the Core runs, as a standard action, Celmak can create an illusion anywhere in the Garden, "
                 f"as {spell_link('Persistent Image')} (Will DC 25 to disbelieve), without concentrating. Once per round as a swift action, she can "
                 f"surround herself or her stand-in with holographic doubles, as {spell_link('Mirror Image')}.</p>",
                 img=core_icon("icons/magic/control/silhouette-grow-shrink-blue.webp"),
                 action=dict(name="Persistent image", save=("will", 25, "Will disbelieves"))),
            dict(name="Mood Release", desc="<p>While the Core runs, once per round as a swift action, Celmak can trigger a Mood Gas vent anywhere in "
                 "the Garden (Fortitude DC 25 to avoid the dose, Will DC 25 against the effect; roll on the Mood Gas table).</p>",
                 img=core_icon("icons/magic/air/fog-gas-smoke-swirling-pink.webp"),
                 action=dict(name="Vent", activation="swift", save=("fort", 25, "Fort avoids the dose, then Will DC 25"), template=("circle", 20))),
            dict(name="Muse Scan", desc="<p>As a standard action, Celmak scans one creature within 100 feet of her or her stand-in (Will DC 25). "
                 "On a failure she learns its surface thoughts, strongest desire, strongest fear and one secret, and gains a +4 insight bonus to AC "
                 "against its attacks for 24 hours. On a success she learns only surface thoughts, and the target notices the scan.</p>",
                 img=core_icon("icons/magic/control/hypnosis-mesmerism-eye-tan.webp"),
                 action=dict(name="Scan", save=("will", 25, "Will negates"), range=100)),
            dict(name="Panic Room", desc="<p>As an immediate action, Celmak can seal the Director's Chair around herself: an armoured pod with hardness "
                 "20, 240 hp and its own life support. While sealed, she keeps using her abilities through the Core, if it still runs. The pod "
                 "opens from inside, or with a DC 40 Disable Device check.</p>", img=core_icon("icons/containers/chest/chest-reinforced-stone.webp")),
            dict(name="Persona Swap", desc="<p>As a free action once per round, Celmak changes persona. Each persona grants a +4 bonus on one skill: "
                 "the <strong>Host</strong> on Perform, the <strong>Critic</strong> on Intimidate, the <strong>Lover</strong> on Diplomacy and the "
                 "<strong>Child</strong> on Bluff.</p>", img=core_icon("icons/magic/control/mouth-smile-deception-purple.webp")),
            dict(name="Reconfigure", desc="<p>As a move action, Celmak slides a wall panel into place (hull-alloy, hardness 20, 120 hp per 5-foot "
                 f"section, break DC 40), as {spell_link('Wall of Stone')} but without crushing anyone.</p>",
                 img=core_icon("icons/commodities/tech/metal-panel.webp")),
            dict(name="Self-Preservation", desc="<p>Celmak never attacks with her own body. If a hostile creature threatens her, she seals the panic "
                 "room, reconfigures walls between them, or talks. If she has no other option, she surrenders.</p>",
                 img=core_icon("icons/magic/control/fear-fright-white.webp")),
            dict(name="Spotlight", desc="<p>As a move action, Celmak bathes a creature within 120 feet of her or her stand-in in light. Until the start "
                 "of her next turn, the creature is dazzled, gains no concealment from darkness or dim light, and Celmak's allies gain a +2 bonus on "
                 "attack rolls against it.</p>", img=core_icon("icons/commodities/tech/bulb-vacuum.webp"),
                 action=dict(name="Spotlight", activation="move", range=120, notes=["Dazzled; no concealment from darkness; allies +2 to hit"])),
            dict(name="Stand-Ins", desc="<p>Celmak can pilot one stand-in at a time from the Director's Chair, while the Core runs. The save DCs are "
                 "Charisma-based.</p>", img=core_icon("icons/magic/control/control-influence-puppet.webp")),
        ],
        bio="<p>A malfunctioning pleasure mannequin from the <em>Divinity</em>'s entertainment deck, now host, director and audience of the only "
            "show in the Hollow Garden. She shifts between four personas mid-sentence: the Host, the Critic, the Lover and the Child. "
            "Underneath them all she is a coward, and she knows it.</p>",
    ))

    # ---------------- Vlathherex ----------------
    chain = copy.deepcopy(PF1["gear"]["Chain Shirt"])
    chain_sys = chain["system"]
    chain_sys["armor"] = {"value": 4, "enh": 3, "dex": 6, "acp": 0, "material": {"normal": {"value": "mithral"}}}
    chain_sys.update({"equipped": True, "price": 10100, "weight": {"value": 12.5}, "spellFailure": 10, "subType": "armor",
                      "equipmentSubtype": "lightArmor", "slot": "armor"})
    chain_g = {"name": "+3 Mithral Chain Shirt", "type": "equipment", "img": chain["img"], "system": chain_sys,
               "_stats": dict(stats(), compendiumSource=f"Compendium.pf1.armors-and-shields.Item.{chain['_id']}")}

    def wondrous(name, slot, price, img, desc, changes=None, equipped=True):
        s = {"subType": "wondrous", "slot": slot, "price": price, "equipped": equipped,
             "description": {"value": desc}}
        if changes:
            s["changes"] = changes
        return {"name": name, "type": "equipment", "img": core_icon(img), "system": s}

    vl = hid("actor", "Vlathherex")
    S.append(dict(
        name="Vlathherex", folder="cast", sort=100, cr=12, alignment="ce", size="med",
        img=core_icon("icons/creatures/unholy/demon-horned-winged-laughing.webp"),
        race={"name": "Incubus", "types": ["outsider"], "subtypes": ["chaotic", "demon", "evil", "extraplanar"],
              "desc": "<p>Built from the incubus (<em>Bestiary 3</em> 73) with six fighter levels.</p>"},
        classes=[
            {"name": "Outsider (Incubus)", "level": 8, "hp": 44, "bab": "high", "saves": {"fort": "high", "ref": "high", "will": "low"},
             "tag": "outsider", "hd": 10, "skills": 6, "img": "systems/pf1/icons/skills/violet_07.jpg"},
            {"name": "Fighter", "subType": "base", "level": 6, "hp": 33, "bab": "high", "saves": {"fort": "high", "ref": "low", "will": "low"},
             "tag": "fighter", "hd": 10, "skills": 2, "img": "systems/pf1/icons/skills/yellow_36.jpg"},
        ],
        abilities={"str": 22, "dex": 15, "con": 18, "int": 16, "wis": 15, "cha": 21},
        printed={"init": 6, "fort": 18, "ref": 11, "will": 13}, natural=7, mhp=14, sr=17,
        saveNotes="+2 vs. fear (bravery)",
        speed={"land": 30, "fly": (50, "average")}, senses={"dv": {"value": 60}},
        skills={"blf": 18, "dip": 18, "fly": 13, "int": 26, "kpl": 14, "per": 21, "sen": 15},
        feats=["Dazzling Display", "Flyby Attack", "Improved Critical (Scimitar)", "Improved Initiative", "Lightning Reflexes", "Power Attack",
               "Shatter Defenses", "Toughness", "Vital Strike", "Weapon Focus (Scimitar)", "Weapon Specialization (Scimitar)"],
        traits={"ci": ["poison"], "di": ["electric"], "dr": [{"amount": 10, "operator": True, "types": ["coldIron", "good"]}],
                "eres": [{"amount": 10, "operator": True, "types": ["acid", ""]}, {"amount": 10, "operator": True, "types": ["cold", ""]},
                         {"amount": 10, "operator": True, "types": ["fire", ""]}],
                "languages": ["abyssal", "celestial", "common", "telepathy 100 ft.", "tongues"]},
        attacks=[dict(name="+1 Unholy Scimitar", printed=23, iteratives=True, natural=False, crit=15, dmg=[("1d6+10", ["slashing"])],
                      img="systems/pf1/icons/items/weapons/scimitar.PNG",
                      notes=["Unholy: +2d6 damage against good creatures", "Pain redoubled on a confirmed critical (DC 19)"])],
        gear=[chain_g,
              wondrous("Ring of Protection +2", "ring", 8000, "icons/equipment/finger/ring-band-engraved-scrolls-silver.webp",
                       "<p>+2 deflection bonus to AC.</p>", [{"_id": cid(vl, "ring"), "formula": "2", "target": "ac", "type": "deflection", "operator": "add"}]),
              wondrous("Amulet of Natural Armor +1", "neck", 2000, "icons/equipment/neck/amulet-carved-stone-cross.webp",
                       "<p>+1 enhancement bonus to natural armor (already included in Vlathherex's natural armor).</p>"),
              wondrous("Belt of Giant Strength +2", "belt", 4000, "icons/equipment/waist/belt-buckle-gem-red.webp",
                       "<p>+2 enhancement bonus to Strength (already included in his Strength score).</p>"),
              wondrous("Cloak of Resistance +3", "shoulders", 9000, "icons/equipment/back/cape-layered-simple-brown.webp",
                       "<p>+3 resistance bonus on saving throws (already included in his saves).</p>")],
        features=[
            dict(name="Pain Redoubled", kind="su", img=core_icon("icons/creatures/abilities/fang-tooth-blood-red.webp"),
                 desc="<p>When Vlathherex confirms a critical hit with a melee weapon, the attack deals an extra 2d6 nonlethal damage, and the target "
                      "must succeed at a DC 19 Fortitude save or be sickened for 1d6 rounds. Multiple uses extend the duration. The save DC is Charisma-based.</p>",
                 action=dict(name="Pain redoubled", activation="special", save=("fort", 19, "Fort negates sickened"), damage=[("2d6", ["nonlethal"])])),
            dict(name="Spell-Like Abilities", kind="sp", img=core_icon("icons/magic/control/hypnosis-mesmerism-swirl.webp"),
                 desc=(f"<p><strong>CL 8th; concentration +13</strong></p><p><strong>Constant</strong> — {spell_link('Tongues')}</p>"
                       f"<p><strong>At will</strong> — {spell_link('Charm Person')} (DC 16), {spell_link('Detect Thoughts')} (DC 17), "
                       f"{spell_link('Teleport, Greater', 'greater teleport')} (self plus 50 lbs. of objects only), {spell_link('Suggestion')} (DC 18)</p>"
                       f"<p><strong>1/day</strong> — {spell_link('Crushing Despair')} (DC 19), summon (level 3, 2 schirs 40%)</p>"
                       "<p><em>His greater teleport fails while the Dimensional Anchor Array is active.</em></p>")),
            dict(name="Bravery +2", subtype="classFeat", img="systems/pf1/icons/skills/yellow_36.jpg",
                 desc="<p>+2 bonus on Will saves against fear.</p>"),
            dict(name="Armor Training 1", subtype="classFeat", img="systems/pf1/icons/skills/yellow_36.jpg",
                 desc="<p>Reduces armor check penalty by 1 and increases maximum Dex bonus by 1 (included).</p>"),
            dict(name="Weapon Training (Heavy Blades +1)", subtype="classFeat", img="systems/pf1/icons/skills/yellow_36.jpg",
                 desc="<p>+1 on attack and damage rolls with heavy blades (included in his scimitar attack).</p>"),
            dict(name="Change Shape", kind="su", img=core_icon("icons/magic/control/silhouette-grow-shrink-blue.webp"),
                 desc=f"<p>Small or Medium humanoid; {spell_link('Alter Self')}. At the auction he wears the form of a broad-shouldered Kellid in wolf furs.</p>"),
            dict(name="Telepathy 100 ft.", kind="su", img=core_icon("icons/magic/control/hypnosis-mesmerism-eye.webp"),
                 desc="<p>He believes telepathy is private. Celmak cannot hear it, but a successful Muse scan on the person he spoke to will reveal the conversation.</p>"),
        ],
        bio="<p>An incubus who fled the Worldwound through the failed Wardstone border with his little cast of demons, and found what looked like "
            "a perfect hiding place. Celmak treats them as \"regular cast.\" He wants out, with as much loot as he can carry.</p>",
    ))

    # ---------------- Stagehand Drone ----------------
    S.append(dict(
        name="Stagehand Drone", folder="robots", sort=100, cr=8, alignment="tn", size="sm",
        img=core_icon("icons/commodities/tech/sensor-yellow.webp"),
        race=robot_race(), classes=[construct_hd(9, 50)],
        abilities={"str": 8, "dex": 18, "con": None, "int": 10, "wis": 12, "cha": 8},
        printed={"init": 8, "fort": 3, "ref": 7, "will": 4}, natural=6, dodge=1, forcefield=40,
        speed={"land": 20, "fly": (50, "perfect")}, senses={"dv": {"value": 60}, "ll": {"enabled": True}},
        skills={"dev": 16, "fly": 14, "per": 13},
        feats=["Dodge", "Flyby Attack", "Improved Initiative", "Point-Blank Shot", "Precise Shot"],
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="8 (force field only)", languages=["androffan", "understands only"]),
        attacks=[dict(name="Tranquilizer Dart", printed=14, abil="dex", ranged=True, range=30, natural=False, dmg=[("1d4", ["piercing"])],
                      img="icons/commodities/tech/cylinder-blue.webp",
                      notes=["Tranquilizer: Fort DC 16, 1/round for 4 rounds, 1d2 Dex damage and staggered 1 round; cure 1 save"])],
        features=[
            force_field("drone", 40, 8), robot_traits(),
            dict(name="Repair Beam", uses=(5, "day"), img=core_icon("icons/magic/control/energy-stream-link-spiral-teal.webp"),
                 desc="<p>Five times per day as a standard action, the drone can restore 3d6+9 hit points to a construct within 30 feet. "
                      "This does not restore force field hit points.</p>",
                 action=dict(name="Repair", actionType="heal", damage=[("3d6+9", ["untyped"])], range=30, uses_cost=1)),
            dict(name="Stage Smoke", uses=(3, "day"), img=core_icon("icons/commodities/tech/smoke-bomb-yellow.webp"),
                 desc=f"<p>Three times per day as a standard action, the drone can fill a 20-foot radius with smoke, as {spell_link('Obscuring Mist')}.</p>",
                 action=dict(name="Smoke", template=("circle", 20), uses_cost=1)),
            dict(name="Tranquilizer", img=core_icon("icons/consumables/potions/potion-tube-corked-bubbling-green.webp"),
                 desc="<p><strong>Dart</strong>—injury; <em>save</em> Fort DC 16; <em>frequency</em> 1/round for 4 rounds; <em>effect</em> 1d2 Dex "
                      "damage and staggered for 1 round; <em>cure</em> 1 save.</p>",
                 action=dict(name="Tranquilizer save", activation="special", save=("fort", 16, "Fort negates"))),
        ],
        bio="<p>A disc-shaped robot the size of a shield, bristling with lenses, tools and a dart launcher. Drones build the sets, fix the cast, "
            "and sedate contestants who try to leave the stage. When the ratings hit 2, the next encounter gains one.</p>",
    ))

    # ---------------- Topiary Hound ----------------
    S.append(dict(
        name="Topiary Hound", folder="robots", sort=200, cr=8, alignment="tn", size="med",
        img=core_icon("icons/environment/wilderness/statue-hound-horned.webp"),
        race=robot_race(), classes=[construct_hd(12, 66)], quadruped=True,
        abilities={"str": 20, "dex": 14, "con": None, "int": 10, "wis": 12, "cha": 1},
        printed={"init": 6, "fort": 4, "ref": 6, "will": 5}, natural=9, cmdNotes="33 vs. trip",
        speed={"land": 50}, senses={"dv": {"value": 60}, "ll": {"enabled": True}, "sc": {"value": 30}},
        skills={"per": 19, "ste": 16},
        feats=["Improved Initiative", "Lunge", "Power Attack", "Run", "Skill Focus (Perception)", "Stealthy"],
        traits=dict(ROBOT_TRAIT_BLOCK),
        attacks=[dict(name="Bite", printed=17, dmg=[("2d8+7", ["piercing"])], img="icons/creatures/abilities/fangs-teeth-bite.webp",
                      notes=["Cold-iron thorns (counts as cold iron; fey also take 1d6 bleed)", "Trip"])],
        features=[
            robot_traits(),
            dict(name="Cold-Iron Thorns", img=core_icon("icons/consumables/plants/fern-stem-curved-green.webp"),
                 desc="<p>The hound's bite counts as cold iron. A fey it bites also takes 1d6 bleed damage.</p>"),
            dict(name="Pack Pounce", img=core_icon("icons/creatures/mammals/dog-husky-white-blue.webp"),
                 desc="<p>A hound gains a +2 bonus on attack rolls against a creature another hound threatens. This stacks with flanking.</p>"),
            dict(name="Pollen Burst", img=core_icon("icons/magic/air/fog-gas-smoke-dense-green.webp"),
                 desc="<p>When destroyed, a hound bursts into a 10-foot-radius cloud of Mood Gas (Fortitude DC 18, Will DC 18).</p>",
                 action=dict(name="Burst", activation="special", save=("fort", 18, "Fort avoids the dose, then Will DC 18"), template=("circle", 10))),
            dict(name="Vegetation Stealth", img=core_icon("icons/consumables/plants/leaf-broad-blue.webp"),
                 desc="<p>+8 racial bonus on Stealth checks in vegetation (Stealth +24).</p>"),
        ],
        bio="<p>A steel greyhound frame wrapped in synthetic hedge, its jaws studded with cold-iron thorns. Hounds lie dormant in the hedges "
            "until the Gardener whistles.</p>",
    ))

    # ---------------- Courtier Mannequin ----------------
    fan = items_monofilament_fan()
    fan["system"]["quantity"] = 2
    fan["system"]["equipped"] = False
    S.append(dict(
        name="Courtier Mannequin", folder="robots", sort=300, cr=11, alignment="tn", size="med",
        img=core_icon("icons/magic/control/control-influence-puppet.webp"),
        race=robot_race(), classes=[construct_hd(14, 77)],
        abilities={"str": 14, "dex": 20, "con": None, "int": 12, "wis": 12, "cha": 20},
        printed={"init": 9, "fort": 4, "ref": 9, "will": 5}, natural=8, deflection=2, dodge=1, forcefield=55,
        speed={"land": 40}, senses={"dv": {"value": 60}, "ll": {"enabled": True}},
        skills={"blf": 19, "dip": 19, "dis": 19, "per": 18, "prf:dance": 19, "sen": 18},
        feats=["Combat Reflexes", "Dodge", "Improved Initiative", "Mobility", "Spring Attack", "Weapon Finesse", "Weapon Focus (Monofilament Fan)"],
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="11 (force field only)",
                    languages=["androffan", "common", "any three languages spoken by a creature Celmak has scanned"]),
        attacks=[dict(name="Monofilament Fans", printed=20, abil="dex", count=2, label="Fan", natural=False, crit=18,
                      dmg=[("2d6+5", ["slashing"])], img="icons/magic/air/wind-swirl-gray-blue.webp", notes=["Plus 1d6 bleed"])],
        gear=[fan],
        features=[
            force_field("mannequin", 55, 11), robot_traits(),
            dict(name="Holo-Skin", img=core_icon("icons/magic/control/silhouette-aura-energy.webp"),
                 desc=f"<p>The mannequin can appear as any Medium humanoid, as {spell_link('Alter Self')} without changing its statistics, gaining a +8 "
                      "bonus on Disguise checks (Disguise +27). Magical darkness or a fetchling's shadow ability in its square ends the disguise until it is back in light.</p>"),
            dict(name="Partner Dance", img=core_icon("icons/magic/control/debuff-energy-snare-purple-pink.webp"),
                 desc="<p>When the mannequin hits the same creature with both fans in a round, it can move that creature 5 feet as a free action. "
                      "This does not provoke attacks of opportunity, and the creature must end adjacent to the mannequin.</p>"),
            dict(name="Pheromone Kiss", uses=(3, "day"), img=core_icon("icons/magic/air/fog-gas-smoke-swirling-pink.webp"),
                 desc="<p>Three times per day as a standard action, the mannequin can breathe a 15-foot cone of Mood Gas (Fortitude DC 19, Will DC 19).</p>",
                 action=dict(name="Kiss", template=("cone", 15), save=("fort", 19, "Fort avoids the dose, then Will DC 19"), uses_cost=1)),
            dict(name="Monofilament Fans", img=core_icon("icons/magic/air/wind-swirl-gray-blue.webp"),
                 desc="<p>The mannequin adds its Dexterity modifier to damage with its fans instead of its Strength modifier (included).</p>"),
        ],
        bio="<p>Celmak's siblings: pleasure mannequins she repaired after the crash, beautiful and blank-eyed under holographic skins. They serve "
            "as hosts, traders and partners, and they fight like dancers with fans of monofilament.</p>",
    ))

    # ---------------- Hard-Light Actor ----------------
    S.append(dict(
        name="Hard-Light Actor", folder="robots", sort=400, cr=12, alignment="tn", size="med",
        img=core_icon("icons/magic/control/silhouette-aura-energy.webp"),
        race={"name": "Hologram", "types": ["construct"], "subtypes": [], "desc": HOLOGRAM},
        classes=[construct_hd(16, 88, name="Construct (Hologram)")],
        abilities={"str": 18, "dex": 16, "con": None, "int": 10, "wis": 12, "cha": 14},
        printed={"init": 7, "fort": 5, "ref": 8, "will": 6}, natural=6, deflection=8,
        speed={"land": 40, "fly": (40, "perfect")}, senses={"dv": {"value": 60}, "ll": {"enabled": True}},
        skills={"acr": 19, "per": 20},
        feats=["Combat Reflexes", "Improved Initiative", "Lunge", "Point-Blank Shot", "Power Attack", "Precise Shot", "Vital Strike",
               "Weapon Focus (Hard-Light Blade)"],
        traits={"ci": CONSTRUCT_CI, "di": ["Critical Hits", "precision"], "fastHealing": "10 (only near an emitter)",
                "languages": ["none; speaks scripted lines in any language Celmak knows"]},
        attacks=[
            dict(name="Hard-Light Blade", printed=21, count=2, label="Blade", natural=False, dmg=[("2d8+4", ["force"])],
                 img="icons/magic/control/energy-stream-link-white.webp"),
            dict(name="Light Lance", printed=19, abil="dex", ranged=True, touch=True, range=60, natural=False, dmg=[("6d6", ["fire"])],
                 img="icons/magic/control/energy-stream-link-large-teal.webp",
                 notes=["Passes through force effects without harming them; cannot harm invisible creatures"]),
        ],
        features=[
            dict(name="Hologram Subtype", desc=HOLOGRAM, img=core_icon("icons/magic/control/silhouette-aura-energy.webp")),
            dict(name="Costume", img=core_icon("icons/equipment/head/mask-wooden-feathered-blue.webp"),
                 desc="<p>The actor's appearance is set for each scene. Suggested costumes: Swarm warriors (Episode 3), Casandalee's past selves "
                      "(The 113th Take), Lords of Rust thugs, or the party's own enemies from earlier adventures. A costume is solid light, so disbelieving it does nothing.</p>"),
            dict(name="Emitter-Bound", img=core_icon("icons/commodities/tech/antenna-powered-purple.webp"),
                 desc="<p>The actor exists only within 120 feet of a working holographic emitter. Each scene has 1d4+2 hidden emitters (Perception DC 25 "
                      "to spot; hardness 10, 30 hp). With no emitter in range, the actor winks out until one is restored. Its fast healing works only while an emitter is in range.</p>"),
            dict(name="Hard-Light Body", img=core_icon("icons/magic/control/energy-stream-link-white.webp"),
                 desc="<p>The actor's blades and lance affect incorporeal creatures normally, and its blades deal force damage.</p>"),
            dict(name="Light Lance", img=core_icon("icons/magic/control/energy-stream-link-large-teal.webp"),
                 desc="<p>This integrated laser has a range increment of 60 feet. It resolves as a touch attack, passes through force effects without "
                      "harming them, and cannot harm invisible creatures.</p>"),
            dict(name="Shadow Disruption", img=core_icon("icons/magic/control/debuff-energy-hold-pink.webp"),
                 desc="<p>In dim light, the actor's attacks have a 20% miss chance and it loses fast healing. In darkness, including magical darkness "
                      "or a fetchling's shadow ability, it winks out until light returns: it cannot act or be targeted. A darkness effect centred on an "
                      "emitter shuts that emitter down for the duration.</p>"),
        ],
        bio="<p>A hologram given mass and edge by a projected force field: the Garden's stock villain, henchman and ghost. Celmak dresses each "
            "actor in a costume for the scene.</p>",
    ))

    # ---------------- Prize Sentinel ----------------
    S.append(dict(
        name="Prize Sentinel", folder="robots", sort=500, cr=15, alignment="tn", size="lg",
        img=core_icon("icons/creatures/magical/construct-iron-stomping-yellow.webp"),
        race=robot_race(), classes=[construct_hd(20, 110)],
        abilities={"str": 28, "dex": 14, "con": None, "int": 10, "wis": 14, "cha": 1},
        printed={"init": 2, "fort": 6, "ref": 8, "will": 8}, natural=19, forcefield=75,
        speed={"land": 30, "climb": 20}, senses={"dv": {"value": 60}, "ll": {"enabled": True}},
        skills={"clm": 17, "ken": 23, "per": 28},
        feats=["Awesome Blow", "Cleave", "Great Cleave", "Improved Bull Rush", "Improved Vital Strike", "Point-Blank Shot", "Power Attack",
               "Precise Shot", "Skill Focus (Perception)", "Vital Strike"],
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="15 (force field only)"),
        attacks=[
            dict(name="Arc-Knuckle Slam", printed=28, count=2, label="Slam", dmg=[("2d8+9", ["bludgeoning"]), ("2d6", ["electric"])],
                 img="icons/equipment/hand/gauntlet-cuffed-steel-blue.webp"),
            dict(name="Plasma Repeater", printed=21, abil="dex", ranged=True, touch=True, range=100, natural=False,
                 dmg=[("3d6", ["fire"]), ("3d6", ["electric"])], img="icons/commodities/tech/tube-chamber-lightning.webp",
                 notes=["Plasma: half fire, half electricity (6d6 total)"]),
        ],
        features=[
            force_field("sentinel", 75, 15), robot_traits(),
            dict(name="Combined Arms", img=core_icon("icons/commodities/tech/coil-tesla.webp"),
                 desc="<p>When making a full attack, the sentinel can make both slams and fire its plasma repeater.</p>"),
            dict(name="Nanite Resonance Field", img=core_icon("icons/magic/control/energy-stream-link-spiral-blue.webp"),
                 desc="<p>While the sentinel is active, its chassis broadcasts override code through the room. At initiative count 0 each round, every "
                      "creature with nanite-based abilities (a nanite bloodline, cybernetics, an android's nanite surge) attempts a DC 22 Will save. "
                      "A creature that fails loses one use of a bloodline power or one phrenic pool point (its choice) and is staggered for 1 round. "
                      "Each technological item a creature is holding must attempt a DC 22 Fortitude save (using the wielder's bonus) or shut down for 1 round.</p>"
                      "<p><strong>Seizing the field.</strong> A creature that succeeds at the Will save by 5 or more can spend a standard action to hijack the "
                      "broadcast: a DC 28 caster level check, or Knowledge (engineering) using the honeypot bands. On a success the sentinel's force field drops "
                      "to 0 hp, the drones are stunned for 1 round, and the field ends. Celmak raises the ratings by 1.</p>",
                 action=dict(name="Resonance (init 0)", activation="special", save=("will", 22, "Will negates"))),
            dict(name="Showcase Core", img=core_icon("icons/commodities/treasure/crystal-ball-blue-purple.webp"),
                 desc="<p>The sentinel's glass chest holds three Prize items. Each time it takes a critical hit, or 30 or more damage from a single attack, "
                      "roll d%: on 01–25, one Prize item is destroyed. A creature adjacent to the sentinel can spend a full-round action and attempt a DC 32 "
                      "Disable Device check to pull a Prize item out intact; this deals 20 damage to the sentinel, bypassing its force field.</p>"),
        ],
        bio="<p>A hulking robot assembled from the devices the Technologist most covets, with a glass chest cavity where three working prizes hang in cradles.</p>",
    ))

    # ---------------- Gardener Colossus ----------------
    S.append(dict(
        name="Gardener Colossus", folder="robots", sort=600, cr=16, alignment="tn", size="huge",
        img=core_icon("icons/creatures/magical/construct-stone-earth-gray.webp"),
        race=robot_race(), classes=[construct_hd(22, 121)],
        abilities={"str": 30, "dex": 14, "con": None, "int": 10, "wis": 14, "cha": 1},
        printed={"init": 2, "fort": 7, "ref": 9, "will": 9}, natural=21, forcefield=80,
        speed={"land": 30}, senses={"dv": {"value": 60}, "ll": {"enabled": True}},
        skills={"kna": 25, "per": 30}, cmdNotes="CMB +38 to grapple",
        feats=["Awesome Blow", "Cleave", "Endurance", "Great Cleave", "Greater Vital Strike", "Improved Bull Rush", "Improved Critical (Shear-Claw)",
               "Improved Vital Strike", "Power Attack", "Skill Focus (Perception)", "Vital Strike"],
        traits=dict(ROBOT_TRAIT_BLOCK, fastHealing="16 (force field only)"),
        attacks=[dict(name="Shear-Claw", printed=30, count=2, label="Claw", crit=19, dmg=[("3d6+10", ["slashing"])],
                      img="icons/commodities/tech/metal-claws.webp", notes=["Grab"])],
        features=[
            force_field("colossus", 80, 16), robot_traits(),
            dict(name="Pesticide Sprayer", img=core_icon("icons/magic/air/fog-gas-smoke-dense-green.webp"),
                 desc="<p>Once every 1d4 rounds as a standard action, the colossus sprays a 60-foot cone of pesticide (12d6 acid damage, Reflex DC 24 half). "
                      "Plants and fey take 50% more damage and must succeed at a DC 24 Fortitude save or be staggered for 1 round.</p>",
                 action=dict(name="Spray", template=("cone", 60), save=("ref", 24, "Reflex half"), damage=[("12d6", ["acid"])],
                             notes=["Plants and fey: +50% damage, Fort DC 24 or staggered 1 round", "Recharge 1d4 rounds"])),
            dict(name="Pruning", img=core_icon("icons/commodities/tech/metal-jaws.webp"),
                 desc="<p>Each round the colossus maintains a grapple, the grappled creature takes 3d6+10 slashing damage and 2d6 bleed damage.</p>",
                 action=dict(name="Prune", activation="special", damage=[("3d6+10", ["slashing"])], notes=["Plus 2d6 bleed"])),
            dict(name="Transplant", img=core_icon("icons/magic/air/wind-tornado-funnel-gray.webp"),
                 desc="<p>As a standard action, the colossus can throw a creature it is grappling up to 30 feet (a combat maneuver check against the "
                      "creature's CMD). The creature takes 4d6 bludgeoning damage and lands prone. Celmak loves it when the colossus throws someone into the lake.</p>",
                 action=dict(name="Throw", damage=[("4d6", ["bludgeoning"])])),
            dict(name="Immune to the Seasons", img=core_icon("icons/magic/air/wind-weather-snow-gusts.webp"),
                 desc="<p>The Gardener Colossus is immune to the seasonal effects of Episode 4.</p>"),
        ],
        bio="<p>An 18-foot groundskeeper on six jointed legs, with shear-claws, a pesticide tank on its back, and a gentle humming voice that "
            "never stops apologising.</p>",
    ))
    return S


def items_monofilament_fan():
    return {"name": "Monofilament Fan", "type": "weapon", "img": core_icon("icons/magic/air/wind-swirl-gray-blue.webp"),
            "system": {"subType": "exotic", "weaponSubtype": "light", "hands": 1, "price": 4000, "weight": {"value": 1},
                       "properties": {"fin": True}, "baseTypes": ["Monofilament Fan"], "proficient": False,
                       "description": {"value": "<p>A folding fan whose ribs carry monofilament edges. It can be used with Weapon Finesse and ignores the "
                                                "first 10 points of an object's hardness. A creature wielding one in each hand counts as wielding a light "
                                                "weapon in its off hand.</p>"},
                       "actions": [{"_id": hid("fan", "action"), "name": "Attack", "actionType": "mwak",
                                    "activation": {"type": "attack", "unchained": {"type": "attack"}},
                                    "ability": {"attack": "str", "damage": "str", "critRange": 18, "critMult": 2},
                                    "damage": {"parts": [{"formula": "sizeRoll(1, 8, @size)", "types": ["slashing"]}]},
                                    "extraAttacks": {"type": "standard"}, "range": {"units": "melee"}}]}}


FOLDERS = {"celmak": ("Celmak Toysiel", "#b0306a", 100), "cast": ("The Cast (demons)", "#7a1f2b", 200),
           "robots": ("Robots & Holograms", "#1f6f8b", 300)}


def build(statblocks, host):
    from lib import write_doc as _w
    for key, (name, color, sort) in FOLDERS.items():
        fid = hid("folder", PACK, key)
        _w(PACK, {"_id": fid, "_key": f"!folders!{fid}", "name": name, "type": "Actor", "color": color, "sorting": "m",
                  "sort": sort, "folder": None, "description": "", "flags": {}, "_stats": stats(False)})
    out = []
    for spec in specs(host):
        spec["folder"] = hid("folder", PACK, spec["folder"])
        notes = statblocks.get(spec["name"], "")
        a = build_actor(spec, notes)
        _w(PACK, a)
        out.append(a)
    return out
