"""Extract the handful of PF1 system documents this module reuses (feats, gear, spell ids).

Usage: python3 make_pf1_cache.py /path/to/foundryvtt-pathfinder1
The result (pf1-cache.json) is committed so the build does not need the PF1 repository.
"""
import sys, os, glob, json, yaml

repo = sys.argv[1]
packs = os.path.join(repo, "packs")
FEATS = ["Skill Focus", "Deceitful", "Persuasive", "Alertness", "Mobility", "Iron Will", "Dodge", "Improved Initiative",
         "Flyby Attack", "Point-Blank Shot", "Precise Shot", "Lunge", "Power Attack", "Run", "Stealthy", "Combat Reflexes",
         "Spring Attack", "Weapon Finesse", "Weapon Focus", "Vital Strike", "Awesome Blow", "Cleave", "Great Cleave",
         "Improved Bull Rush", "Improved Vital Strike", "Greater Vital Strike", "Endurance", "Improved Critical",
         "Dazzling Display", "Lightning Reflexes", "Shatter Defenses", "Toughness", "Weapon Specialization"]
GEAR = {"armors-and-shields": ["Chain Shirt"], "weapons-and-ammo": ["Longsword", "Scimitar"], "items": ["Lantern of Revealing"]}
SPELLS = ["Charm Person", "Detect Thoughts", "Teleport, Greater", "Suggestion", "Crushing Despair", "Tongues", "Summon Monster III",
          "Good Hope", "Haste", "Mirror Image", "Faerie Fire", "Obscuring Mist", "Persistent Image", "Dominate Person",
          "Dimensional Lock", "Wall of Stone", "Rage", "Confusion", "Breath of Life", "Dispel Magic, Greater", "Dispel Magic",
          "Geas, Lesser", "Mage's Private Sanctum", "Alter Self"]


def load(pack, name):
    for f in glob.glob(os.path.join(packs, pack, "*.yaml")):
        with open(f) as fh:
            head = fh.read(4000)
        if f"\nname: {name}\n" in head or head.startswith(f"name: {name}\n"):
            return yaml.safe_load(open(f))
    for f in glob.glob(os.path.join(packs, pack, "*.yaml")):
        d = yaml.safe_load(open(f))
        if d.get("name") == name:
            return d
    raise KeyError(f"{pack}: {name}")


out = {"feats": {}, "gear": {}, "spells": {}}
for n in FEATS:
    out["feats"][n] = load("feats", n)
for pack, names in GEAR.items():
    for n in names:
        out["gear"][n] = dict(load(pack, n), _pack=pack)
for n in SPELLS:
    try:
        d = load("spells", n)
        out["spells"][n] = d["_id"]
    except KeyError:
        print("missing spell", n)
json.dump(out, open(os.path.join(os.path.dirname(__file__), "pf1-cache.json"), "w"), indent=1, ensure_ascii=False, default=str)
print("feats", len(out["feats"]), "gear", len(out["gear"]), "spells", len(out["spells"]))
