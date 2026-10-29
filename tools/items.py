"""Items: Celmak's trinkets, prize and story items, auction lots and the hoard of the fallen."""
import copy
import json
import os

from lib import cid, core_icon, hid, p, stats, write_doc

PACK = "hg-items"
PF1 = json.load(open(os.path.join(os.path.dirname(__file__), "pf1-cache.json")))

FOLDERS = {
    "trinkets": ("Trinkets (Celmak's prizes)", "#c0398f", 100),
    "prizes": ("Prize & Story Items", "#1f6f8b", 200),
    "lots": ("Auction Lots (Episode 2)", "#b8860b", 300),
    "hoard": ("The Hoard of the Fallen", "#5b4636", 400),
}


def spell(name, label=None):
    sid = PF1["spells"].get(name)
    label = label or name.lower()
    return f"<em>@UUID[Compendium.pf1.spells.Item.{sid}]{{{label}}}</em>" if sid else f"<em>{label}</em>"


def stat_line(**kw):
    parts = [f"<strong>{k.replace('_', ' ').title()}</strong> {v}" for k, v in kw.items()]
    return "<p>" + "; ".join(parts) + "</p>"


def action(key, name="Use", activation="standard", **kw):
    a = {"_id": hid(key, "action", name), "name": name, "activation": {"type": activation, "unchained": {"type": "action", "cost": 2}},
         "actionType": kw.get("actionType", "other")}
    if "damage" in kw:
        a["damage"] = {"parts": [{"formula": f, "types": t} for f, t in kw["damage"]]}
    if "save" in kw:
        a["save"] = {"type": kw["save"][0], "dc": str(kw["save"][1]), "description": kw["save"][2]}
    if "template" in kw:
        a["measureTemplate"] = {"type": kw["template"][0], "size": str(kw["template"][1])}
    if "range" in kw:
        a["range"] = {"value": str(kw["range"]), "units": "ft"}
    if "cost" in kw:
        a["uses"] = {"autoDeductChargesCost": str(kw["cost"])}
    if "notes" in kw:
        a["notes"] = {"effect": kw["notes"], "footer": []}
    if "duration" in kw:
        a["duration"] = {"value": str(kw["duration"][0]), "units": kw["duration"][1]}
    return a


def item(key, name, itype, img, folder, sort, desc, system=None, flags=None):
    _id = hid("item", key)
    sysd = {"description": {"value": desc}}
    sysd.update(system or {})
    doc = {"_id": _id, "_key": f"!items!{_id}", "name": name, "type": itype, "img": img, "folder": hid("folder", PACK, folder),
           "sort": sort, "system": sysd, "flags": flags or {}, "_stats": stats()}
    return doc


def trinkets():
    T = []
    T.append(item("applause-injector", "Applause Injector", "consumable", core_icon("icons/consumables/potions/potion-tube-corked-bubbling-green.webp"), "trinkets", 100,
                  stat_line(price="1,500 gp", usage="single use") +
                  p(f"An Androffan auto-injector that plays a short burst of recorded applause as it fires. It heals <strong>4d8+10</strong> hit points and grants {spell('Good Hope')} for 1 minute. Injecting takes a standard action.",
                    "<em>Trinket (d8: 1). Celmak hands these out when the ratings reach 5.</em>"),
                  {"subType": "misc", "price": 1500, "uses": {"per": "single"},
                   "actions": [action("applause-injector", "Inject", actionType="heal", damage=[("4d8+10", ["untyped"])], duration=(1, "minute"),
                                      notes=["Good hope for 1 minute"])]}))
    T.append(item("encore-stim", "Encore Stim", "consumable", core_icon("icons/consumables/potions/potion-flask-corked-labeled-pink.webp"), "trinkets", 200,
                  stat_line(price="1,200 gp", usage="single use") +
                  p(f"The user is {spell('Haste', 'hasted')} for 5 rounds, then fatigued for 1 minute.", "<em>Trinket (d8: 2).</em>"),
                  {"subType": "misc", "price": 1200, "uses": {"per": "single"},
                   "actions": [action("encore-stim", "Inject", duration=(5, "round"), notes=["Hasted 5 rounds, then fatigued 1 minute"])]}))
    T.append(item("filter-plugs", "Filter Plugs", "consumable", core_icon("icons/commodities/tech/bearing-steel-green.webp"), "trinkets", 300,
                  stat_line(price="300 gp", usage="single use") +
                  p("Immunity to inhaled effects, including Mood Gas, for 1 hour.", "<em>Trinket (d8: 3).</em>"),
                  {"subType": "misc", "price": 300, "uses": {"per": "single"},
                   "actions": [action("filter-plugs", "Insert", activation="move", duration=(1, "hour"), notes=["Immune to inhaled effects (Mood Gas)"])]}))
    T.append(item("spotlight-flare", "Spotlight Flare", "consumable", core_icon("icons/commodities/tech/smoke-bomb-red-yellow.webp"), "trinkets", 400,
                  stat_line(price="600 gp", usage="single use") +
                  p(f"Thrown 30 ft.; bright light in a 60-ft radius for 1 minute, and outlines invisible creatures as {spell('Faerie Fire')}.",
                    "<em>Trinket (d8: 4). Light is the enemy of shadows, and the friend of holograms.</em>"),
                  {"subType": "misc", "price": 600, "uses": {"per": "single"},
                   "actions": [action("spotlight-flare", "Throw", range=30, template=("circle", 60), duration=(1, "minute"),
                                      notes=["Bright light 60 ft.; outlines invisible creatures"])]}))
    T.append(item("holo-decoy", "Holo-Decoy", "loot", core_icon("icons/magic/control/silhouette-grow-shrink-blue.webp"), "trinkets", 500,
                  stat_line(price="2,000 gp", capacity="3", usage="1 charge per use") +
                  p(f"A disc that projects 1d4 duplicates of the user, as {spell('Mirror Image')}.", "<em>Trinket (d8: 5).</em>"),
                  {"subType": "gear", "price": 2000, "uses": {"per": "charges", "maxFormula": "3", "value": 3},
                   "actions": [action("holo-decoy", "Project", cost=1, notes=["1d4 mirror images"])]}))
    T.append(item("static-grenade", "Static Grenade", "consumable", core_icon("icons/commodities/tech/detonator-radio.webp"), "trinkets", 600,
                  stat_line(price="900 gp", usage="single use") +
                  p("20-ft burst; robots take <strong>6d6 electricity</strong> damage (Reflex DC 18 half) and their force fields lose fast healing for 1 round.",
                    "<em>Trinket (d8: 6). Celmak considers this one a little unsporting.</em>"),
                  {"subType": "misc", "price": 900, "uses": {"per": "single"},
                   "actions": [action("static-grenade", "Throw", range=20, template=("circle", 20), damage=[("6d6", ["electric"])],
                                      save=("ref", 18, "Reflex half (robots only)"), notes=["Robots only; force fields lose fast healing 1 round"])]}))
    T.append(item("cue-card", "Cue Card", "consumable", core_icon("icons/sundries/documents/document-symbol-triangle-pink.webp"), "trinkets", 700,
                  stat_line(price="500 gp", usage="single use") +
                  p("A slip of film showing Celmak's next twist. Once, as an immediate action, gain a +4 insight bonus on one saving throw inside the Garden.",
                    "<em>Trinket (d8: 7).</em>"),
                  {"subType": "misc", "price": 500, "uses": {"per": "single"},
                   "actions": [action("cue-card", "Read the card", activation="immediate", notes=["+4 insight on one save"])]}))
    T.append(item("from-the-hoard", "From the Hoard (GM's choice)", "loot", core_icon("icons/containers/chest/chest-simple-box-gold-brown.webp"), "trinkets", 800,
                  stat_line(price="up to 5,000 gp") +
                  p("A magic item from a dead adventurer, chosen to help just enough. Replace this card with an item worth up to 5,000 gp, "
                    "ideally one whose owner is named in the Ledger of the Fallen.", "<em>Trinket (d8: 8).</em>"),
                  {"subType": "misc", "price": 0}))
    return T


def prizes():
    P = []
    P.append(item("nanite-resonance-lattice", "Nanite Resonance Lattice", "equipment", core_icon("icons/equipment/neck/collar-rough-stone-cubes.webp"), "prizes", 100,
                  stat_line(price="28,000 gp", slot="neck", weight="—", capacity="10", usage="2 charges per pulse") +
                  p("A mesh of silver filaments that settles into the skin of the throat. The wearer gains a +5 competence bonus on Knowledge (engineering) "
                    "checks and a +2 bonus on caster level checks against constructs. When the wearer casts a spell or uses a nanite-based ability, they "
                    "can spend a swift action to emit an override pulse: every robot within 30 feet must succeed at a DC 20 Will save or be staggered for "
                    "1 round. A wearer with the nanite bloodline treats the lattice's save DC as 22.",
                    "<strong>Construction Requirements</strong> Craft Technological Item, military lab; <strong>Cost</strong> 14,000 gp; <strong>Craft</strong> DC 28.",
                    "<em>Found in: Episode 1 (the Prize Sentinel's chest case).</em>"),
                  {"subType": "wondrous", "slot": "neck", "price": 28000, "equipped": False,
                   "uses": {"per": "charges", "maxFormula": "10", "value": 10},
                   "changes": [{"_id": cid("lattice", "ken"), "formula": "5", "target": "skill.ken", "type": "competence", "operator": "add"}],
                   "actions": [action("lattice", "Override pulse", activation="swift", cost=2, template=("circle", 30),
                                      save=("will", 20, "Will negates (robots; DC 22 for nanite bloodline)"), notes=["Robots staggered 1 round"])]}))
    P.append(item("muse-visor", "Muse Visor", "equipment", core_icon("icons/equipment/head/goggles-leather-blue.webp"), "prizes", 200,
                  stat_line(price="26,000 gp", slot="head", weight="1 lb.", capacity="10", usage="1 charge per scan") +
                  p("Celmak's own mind-scanning optics, salvaged from her body. The party gets it only if Celmak is destroyed, surrenders, or hands it "
                    f"over as part of a deal. The wearer gains a +5 competence bonus on Sense Motive checks. As a standard action, the wearer can scan one "
                    f"creature within 60 feet, as {spell('Detect Thoughts')} with all three rounds of information gained at once (Will DC 20 negates).",
                    "<strong>Construction Requirements</strong> Craft Technological Item, military lab; <strong>Cost</strong> 13,000 gp; <strong>Craft</strong> DC 28.",
                    "<em>Found in: Celmak (the Cutting Room).</em>"),
                  {"subType": "wondrous", "slot": "head", "price": 26000, "equipped": False, "weight": {"value": 1},
                   "uses": {"per": "charges", "maxFormula": "10", "value": 10},
                   "changes": [{"_id": cid("visor", "sen"), "formula": "5", "target": "skill.sen", "type": "competence", "operator": "add"}],
                   "actions": [action("visor", "Scan", cost=1, range=60, save=("will", 20, "Will negates"))]}))
    P.append(item("seed", "Seed of the Hollow Garden", "loot", core_icon("icons/magic/nature/plant-seed-hands-glow-yellow.webp"), "prizes", 300,
                  stat_line(aura="moderate conjuration", cl="13th", slot="none", price="25,000 gp", weight="—") +
                  p("A living acorn grown from the awakened Lock Tree. While carried, it grants a +2 insight bonus on saves against illusions: its bearer "
                    "can feel what is real. Planted in the Hollow Garden's dome after the Core is shut down, it turns the synthetic garden into a living fey "
                    f"glade over a month. Planted anywhere else, it grows overnight into a 200-foot-wide grove where the bearer and their allies can always "
                    f"rest undisturbed, as {spell(chr(77)+'age' + chr(39) + 's Private Sanctum', 'private sanctum')}. Once planted, it is used up.",
                    "<strong>Construction Requirements</strong> none; it grows only from the Lock Tree.",
                    "<em>Found in: Episode 4, if the Tree was awakened rather than disabled or smashed.</em>"),
                  {"subType": "misc", "price": 25000, "cl": 13, "aura": {"school": "con"}}))
    P.append(item("hard-light-bracer", "Hard-Light Emitter Bracer", "equipment", core_icon("icons/equipment/wrist/bracer-shadow.webp"), "prizes", 400,
                  stat_line(price="16,000 gp", slot="wrist", weight="1 lb.", capacity="10", usage="3 charges per use") +
                  p("As a move action, the wearer projects either a hard-light shield, granting a +4 shield bonus to AC (a force effect), or a hard-light "
                    "blade that functions as a +2 short sword dealing force damage. Either lasts 1 minute. Darkness suppresses the effect while the wearer stands in it.",
                    "<strong>Construction Requirements</strong> Craft Technological Arms and Armor, military lab; <strong>Cost</strong> 8,000 gp; <strong>Craft</strong> DC 26.",
                    "<em>Found in: Episode 1.</em>"),
                  {"subType": "wondrous", "slot": "wrists", "price": 16000, "equipped": False, "weight": {"value": 1},
                   "uses": {"per": "charges", "maxFormula": "10", "value": 10},
                   "actions": [action("bracer-shield", "Hard-light shield", activation="move", cost=3, duration=(1, "minute"), notes=["+4 shield bonus to AC (force)"]),
                               dict(action("bracer-blade", "Hard-light blade", activation="attack", cost=3, damage=[("sizeRoll(1, 6, @size) + 2", ["force"])]),
                                    actionType="mwak", attackBonus="2", ability={"attack": "str", "damage": "str", "critRange": 19, "critMult": 2},
                                    range={"units": "melee"})]}))
    P.append(item("service-cradle", "Android Service Cradle", "loot", core_icon("icons/commodities/tech/frame-copper.webp"), "prizes", 500,
                  stat_line(price="12,000 gp", slot="none", weight="8 lb.", capacity="10", usage="5 charges per use") +
                  p("A folding maintenance cradle from the <em>Divinity</em>'s android workshops, “complimentary with purchase.” An android or other "
                    "construct that rests in it for 10 minutes regains 10d6 hit points and is cured of one of the following conditions: fatigued, sickened, "
                    "staggered or confused. It also lets its user find and purge factory override phrases, like the one Celmak holds over Meyanda, without a check.",
                    "<strong>Construction Requirements</strong> Craft Technological Item, military lab; <strong>Cost</strong> 6,000 gp; <strong>Craft</strong> DC 26.",
                    "<em>Found in: Mint Condition (Meyanda's episode).</em>"),
                  {"subType": "gear", "price": 12000, "weight": {"value": 8}, "uses": {"per": "charges", "maxFormula": "10", "value": 10},
                   "actions": [action("cradle", "Service (10 minutes)", activation="minute", actionType="heal", cost=5, damage=[("10d6", ["untyped"])],
                                      notes=["Androids/constructs only; also cures fatigued, sickened, staggered or confused"])]}))
    P.append(item("rewind-cartridge", "Temporal Rewind Cartridge", "loot", core_icon("icons/magic/time/clock-stopwatch-white-blue.webp"), "prizes", 600,
                  stat_line(price="9,000 gp", slot="none", weight="—", capacity="3", usage="1 charge per use") +
                  p("A cartridge from the holographic bridge's captain's chair that should not exist yet. As an immediate action after rolling a d20, but "
                    "before the result is announced, the holder can reroll and take the better result. A kasatha raised by a time traveller may use it "
                    "without the charge being spent once per day: it simply remembers how.",
                    "<strong>Construction Requirements</strong> none; its origin is unknown.", "<em>Found in: Episode 3.</em>"),
                  {"subType": "gear", "price": 9000, "uses": {"per": "charges", "maxFormula": "3", "value": 3},
                   "actions": [action("cartridge", "Rewind", activation="immediate", cost=1, notes=["Reroll a d20, take the better result"])]}))
    fan = {"subType": "exotic", "weaponSubtype": "light", "hands": 1, "price": 4000, "weight": {"value": 1}, "properties": {"fin": True},
           "baseTypes": ["Monofilament Fan"],
           "actions": [{"_id": hid("fan-item", "action"), "name": "Attack", "actionType": "mwak",
                        "activation": {"type": "attack", "unchained": {"type": "attack"}},
                        "ability": {"attack": "str", "damage": "str", "critRange": 18, "critMult": 2},
                        "damage": {"parts": [{"formula": "sizeRoll(1, 8, @size)", "types": ["slashing"]}]},
                        "extraAttacks": {"type": "standard"}, "range": {"units": "melee"}}]}
    P.append(item("monofilament-fan", "Monofilament Fan", "weapon", core_icon("icons/magic/air/wind-swirl-gray-blue.webp"), "prizes", 700,
                  stat_line(price="4,000 gp", type="exotic light melee weapon", damage="1d6 (Small), 1d8 (Medium)", critical="18–20/×2",
                            damage_type="slashing", weight="1 lb.") +
                  p("A folding fan whose ribs carry monofilament edges. It can be used with Weapon Finesse and ignores the first 10 points of an object's "
                    "hardness. A creature wielding one in each hand counts as wielding a light weapon in its off hand.",
                    "<em>Found in: Episode 2. Each Courtier Mannequin carries a pair.</em>"), fan))
    P.append(item("recording-crystal", "Ambassador's Recording Crystal", "loot", core_icon("icons/commodities/gems/gem-faceted-radiant-teal.webp"), "prizes", 800,
                  stat_line(price="4,000 gp", slot="none", weight="—") +
                  p("A palm-sized Androffan memory crystal that plays back, in light and sound, the evening the kasatha ambassadors spent on the entertainment "
                    "deck. Once per day, a kasatha who spends a minute watching it gains a +2 morale bonus on attack rolls and Will saves for 1 hour.",
                    "<em>Found in: Episode 2 (Lot 5) or The Ambassadors.</em>"),
                  {"subType": "misc", "price": 4000,
                   "actions": [action("crystal", "Watch (1 minute)", activation="minute", duration=(1, "hour"), notes=["Kasatha: +2 morale on attacks and Will saves"])]}))
    P.append(item("schematic", "Anchor Array Schematic", "loot", core_icon("icons/commodities/tech/blueprint.webp"), "prizes", 900,
                  stat_line(price="3,000 gp", slot="none", weight="—") +
                  p("A data spike holding the Lock Tree's engineering drawings, hand-drawn by a dead Technic League engineer. Celmak did not write it, so it "
                    "is immune to the honeypots. Plugged into any reader, it grants a +5 bonus on checks to find, disable or understand the Dimensional Anchor "
                    "Array. Afterward, it grants a +2 bonus on checks against any Androffan dimensional anchor, which may matter at Silver Mount.",
                    "<em>Found in: Episode 2 (Lot 4). Vlathherex bids on this and nothing else.</em>"),
                  {"subType": "misc", "price": 3000}))
    P.append(item("ledger", "Ledger of the Fallen", "loot", core_icon("icons/sundries/books/book-tooled-eye-gold-red.webp"), "prizes", 1000,
                  stat_line(price="2,000 gp", slot="none", weight="1 lb.") +
                  p("A datapad listing every adventurer who died in the Garden, with their gear, their home towns and their heirs. Its holder gains a +4 bonus "
                    "on Diplomacy checks with anyone named in it or related to someone who is. Once, it identifies the original owner of one item in the hoard of the fallen.",
                    "<em>Found in: Episode 2 (Lot 1).</em>"),
                  {"subType": "misc", "price": 2000, "weight": {"value": 1}}))
    P.append(item("archive", "Divinity Entertainment Archive", "loot", core_icon("icons/commodities/tech/cable-end.webp"), "prizes", 1100,
                  stat_line(price="priceless", slot="none", weight="—") +
                  p("A data spike holding the entertainment deck's records, partial crew logs and Celmak's footage of every contestant. Its owner gains a +4 "
                    "bonus on Knowledge checks about the <em>Divinity</em>, Silver Mount and Androffans. It also holds one secret of your choice, such as a "
                    "maintenance route into Silver Mount, crew lists, or logs from before Unity went mad.",
                    "<em>Found in: The 113th Take (Casandalee's episode).</em>"),
                  {"subType": "misc", "price": 0}))
    P.append(item("garden-credit", "Garden Credit", "loot", core_icon("icons/commodities/currency/coin-inset-lightning-silver.webp"), "prizes", 1200,
                  p("Auction scrip for The Last Market (Episode 2). Each contestant receives 2 on entry (14 for the party).",
                    "<strong>Raising more:</strong> sell a true secret (2 each), sell blood (1 per 10 hp, unhealable until the episode ends), lend a "
                    "companion to the Box (3 each), or sell an item (1 per 5,000 gp of value).",
                    "<em>Worthless outside the Garden. Celmak honours every sale.</em>"),
                  {"subType": "tradeGoods", "price": 0, "quantity": 2}))
    return P


def lots():
    L = []

    def lot(n, name, img, says, truth, extra=None, itype="loot", system=None):
        sysd = {"subType": "gear" if itype == "loot" else "misc", "price": 0}
        sysd.update(system or {})
        return item(f"lot-{n}", f"Lot {n}: {name}", itype, core_icon(img), "lots", n * 10,
                    f"<blockquote class=\"hg-readaloud\"><p><em>{says}</em></p></blockquote>" + p(truth) + (extra or ""), sysd)

    L.append(lot(2, "Fetchling's Shadow Lantern", "icons/sundries/lights/lantern-bullseye-signal-copper.webp",
                 "“A fetchling's shadow lantern: your door home!” (Open 3, rival max 8)",
                 "A fake: a hologram wrapped around an empty lantern. Using it reveals the dimensional lock: the Shadow Plane feels sealed, like a door "
                 "painted onto a wall. Celmak laughs: “Nobody leaves early. Rule three.”"))
    L.append(lot(3, "A Producer's Share", "icons/sundries/documents/document-sealed-red-yellow.webp",
                 "“A Producer's Share: a cut of the house, for one lucky contestant.” (Open 1, rival max 1)",
                 f"A trap. Whoever signs must make a DC 25 Will save or be bound as {spell('Geas, Lesser', 'lesser geas')} not to leave the Garden before the "
                 "finale. Sense Motive DC 25 reveals the catch."))
    L.append(lot(6, "A Grab Bag from the Vaults", "icons/containers/bags/sack-leather-pink.webp",
                 "“A grab bag from the vaults.” (Open 3, rival max 7)",
                 "2 applause injectors and a <em>ring of freedom of movement</em>."))
    L.append(lot(7, "Last Words of the Bright Lanterns", "icons/sundries/documents/document-symbol-eye.webp",
                 "“Last words of the Bright Lanterns. Very sad. Very long.” (Open 2, rival max 4)",
                 "The final recording of the last adventuring party. It runs three hours. Its last ten minutes show four exhausted adventurers crawling "
                 "through a maintenance duct behind the Showroom's seventh plinth, reaching a hatch into the Core Vault before a drone finds them.",
                 "<ul><li>The crawlway route into the Core Vault, which lets the party skip the vault door in the finale.</li>"
                 f"<li>A cache in the duct: 3 applause injectors and a <em>scroll of</em> {spell('Dispel Magic, Greater', 'greater dispel magic')}.</li>"
                 "<li>The Lanterns' leader whispering, “She's not in the Booth. The Booth is a doll. She's <em>down</em>.”</li></ul>"
                 "<p><em>Celmak never watched past hour one. When she realises what she sold, she drops the ratings by 1.</em></p>"))
    L.append(lot(8, "A Genuine Celmak Original", "icons/commodities/treasure/bust-carved-stone.webp",
                 "“A Genuine Celmak Original! Your portrait, by the artist herself.” (Open 1, rival max 3)",
                 "A flattering hologram portrait of the winner. It is also a camera drone that follows the winner everywhere: Celmak gains a +2 bonus on "
                 "Muse scans against them. Destroying it costs 1 rating; Celmak sulks for an hour."))
    L.append(lot(9, "Thirty Seconds of Silence", "icons/magic/time/hourglass-tilted-glowing-gold.webp",
                 "“Thirty Seconds of Silence. Well. One episode of it.” (Open 3, rival max 9)",
                 "A voucher. For one episode of the winner's choice, Celmak gives no commentary and opens no Mood Gas vents. She bids high on this herself; she hates silence."))
    L.append(lot(10, "The Cast's Original Contract", "icons/sundries/scrolls/scroll-bound-sealed-red-green.webp",
                 "“Paperwork! The cast's original contract.” (Open 2, rival max 5)",
                 "The deal Vlathherex's demons signed with Celmak. The fine print promises them roles “for the full run of the show,” which has no end "
                 "date. The winner gains a +4 bonus on Diplomacy and Intimidate checks with the cast."))
    L.append(lot(11, "The Mystery Box", "icons/containers/boxes/crate-wooden-brown.webp",
                 "“The Mystery Box. Nobody knows. Not even me.” (Open 1, rival max 2)",
                 "Roll 1d6 on the <strong>Mystery Box</strong> roll table."))
    L.append(lot(12, "Exhibit G (Stasis Cube)", "icons/commodities/stone/masonry-block-cube-grey-teal.webp",
                 "“Exhibit G. Feeds itself. Mostly harmless.” (Open 2, rival max 6)",
                 "A stasis cube holding <strong>Ivo Marrant</strong> (NE male human wizard 9), a Technic League initiate who came looking for the Garden two "
                 "years ago. Released, he is starving, terrified and still arrogant. He knows the League has a file on the Garden and has lost three agents "
                 "here; he will trade everything he knows about the League's presence in Starfall for his life, and will betray the party the moment it suits him."))
    L.append(lot(13, "A Front-Row Seat", "icons/sundries/gaming/chess-knight-white.webp",
                 "“A Front-Row Seat for the next episode. The best view in the house.” (Open 4, rival max 8)",
                 "The winner sits out the next episode in the Booth's guest box, completely safe. The Booth is lit, full of monitors, and empty except for a "
                 "single mannequin slumped in the director's chair with its eyes dark. Whenever Celmak speaks, its eyes glow and its head turns. A DC 20 "
                 "Perception check shows a thick data cable running from its spine into the floor."))
    L.append(lot(14, "A Second Act (Resuscitation Injector)", "icons/consumables/potions/flask-corked-blue-glow.webp",
                 "“A Second Act. Everyone deserves one.” (Open 3, rival max 7)",
                 f"An Androffan resuscitation injector that functions once as {spell('Breath of Life')} (CL 13th).", itype="consumable",
                 system={"subType": "misc", "uses": {"per": "single"},
                         "actions": [action("lot14", "Inject", actionType="heal", damage=[("5d8+13", ["untyped"])], notes=["Breath of life (CL 13th)"])]}))
    return L


def hoard():
    H = []

    def story(owner, extra=""):
        return f"<p><strong>Whose it was.</strong> {owner}</p>{extra}<p><em>From the hoard of the fallen, sorted by owner and labelled in Celmak's neat handwriting.</em></p>"

    lantern = copy.deepcopy(PF1["gear"]["Lantern of Revealing"])
    ls = lantern["system"]
    ls["description"]["value"] = story("Arclord Thessaly Vane, Technic League, who came to claim the Garden and was never seen again. Her personal seal is etched on the hood.") + ls["description"].get("value", "")
    H.append({"_id": hid("item", "hoard-lantern"), "_key": f"!items!{hid('item', 'hoard-lantern')}", "name": "Lantern of Revealing (Thessaly Vane's)",
              "type": lantern["type"], "img": lantern["img"], "folder": hid("folder", PACK, "hoard"), "sort": 100, "system": ls,
              "_stats": dict(stats(), compendiumSource=f"Compendium.pf1.items.Item.{lantern['_id']}")})

    def simple(key, name, itype, img, sort, price, owner, rules, system=None):
        sysd = {"price": price}
        sysd.update(system or {})
        return item(key, name, itype, core_icon(img), "hoard", sort, story(owner, f"<p>{rules}</p>"), sysd)

    H.append(simple("hoard-robe", "Robe of Scintillating Colors (Orsolya Fiorn's)", "equipment", "icons/equipment/chest/robe-layered-blue.webp", 200, 27000,
                    "Madame Orsolya Fiorn, a Taldan performer who thought she could out-dazzle Celmak. Celmak has been wearing it on her stand-ins. She is very upset to see it go.",
                    "Use the standard rules for a <em>robe of scintillating colors</em> (Core Rulebook).", {"subType": "wondrous", "slot": "body", "equipped": False}))
    H.append(simple("hoard-mask", "Mask of the Skull (Hrodna Ash-Eyes')", "equipment", "icons/equipment/head/mask-carved-wood-brown.webp", 300, 22000,
                    "Hrodna Ash-Eyes, a Kellid witch-hunter of the Sky Citadel, who came to burn “the machine witch.”",
                    "Use the standard rules for a <em>mask of the skull</em> (Core Rulebook).", {"subType": "wondrous", "slot": "head", "equipped": False}))
    H.append(simple("hoard-lyre", "Lyre of Building (Brannoc Deepsong's)", "loot", "icons/skills/trades/music-notes-sound-blue.webp", 400, 13000,
                    "Brannoc Deepsong, a dwarven bard who built a perfect tunnel out of the Garden. Celmak reconfigured it into a cupboard.",
                    "Use the standard rules for a <em>lyre of building</em> (Core Rulebook).", {"subType": "misc"}))
    H.append(simple("hoard-cape", "Cape of the Mountebank (Gaspard's)", "equipment", "icons/equipment/back/cape-layered-simple-brown.webp", 500, 10800,
                    "Gaspard the Uncanny, a Kyonin illusionist who tried to <em>dimension door</em> out. Scorch marks show where the dimensional lock caught him.",
                    "Use the standard rules for a <em>cape of the mountebank</em> (Core Rulebook). Its <em>dimension door</em> fails while the lock holds.",
                    {"subType": "wondrous", "slot": "shoulders", "equipped": False}))
    H.append(simple("hoard-coins", "Coins and Gems of the Fallen", "loot", "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp", 600, 9000,
                    "Dozens of victims: Numerian sovereigns, Taldan crowns, Androffan credit chips, a Chelish wedding ring.", "Worth 9,000 gp in total.",
                    {"subType": "tradeGoods"}))
    ls_ = copy.deepcopy(PF1["gear"]["Longsword"])
    lsys = ls_["system"]
    lsys["enh"] = 1
    lsys["masterwork"] = True
    lsys["price"] = 8315
    lsys["description"] = {"value": story("Ser Aldric Venn, a young Mendevian crusader who refused to kill anyone, even here. It hums softly when drawn.",
                                          "<p><strong>Merciful.</strong> The blade deals an extra 1d6 damage, and all damage it deals is nonlethal. "
                                          "On command, the merciful ability can be suppressed until reactivated.</p>")}
    for a in lsys.get("actions", []):
        a["nonlethal"] = True
        a.setdefault("damage", {}).setdefault("parts", []).append({"formula": "1d6", "types": ["slashing"]})
    H.append({"_id": hid("item", "hoard-lullaby"), "_key": f"!items!{hid('item', 'hoard-lullaby')}", "name": "“Lullaby” (+1 Merciful Longsword)",
              "type": "weapon", "img": ls_["img"], "folder": hid("folder", PACK, "hoard"), "sort": 700, "system": lsys,
              "_stats": dict(stats(), compendiumSource=f"Compendium.pf1.weapons-and-ammo.Item.{ls_['_id']}")})
    H.append(simple("hoard-bag", "Bag of Tricks, Tan (Pip Thornwhistle's)", "loot", "icons/containers/bags/sack-leather-tan.webp", 800, 6300,
                    "Pip Thornwhistle, a gnome animal trainer. Celmak “fixed” it: it now produces only small robotic animals with the same statistics.",
                    "Use the standard rules for a tan <em>bag of tricks</em> (Core Rulebook).", {"subType": "misc"}))
    H.append(simple("hoard-deck", "Deck of Illusions, 11 Cards Missing (Cressida Moor's)", "loot", "icons/sundries/gaming/playing-cards.webp", 900, 5600,
                    "Lady Cressida Moor, a Galtan card sharp. Celmak borrowed the missing cards to study; she has them in the Booth.",
                    "Use the standard rules for a <em>deck of illusions</em> (Core Rulebook), minus eleven cards.", {"subType": "misc"}))
    H.append(simple("hoard-wardstone", "Wardstone Sliver (Sister Embeth's)", "loot", "icons/commodities/treasure/stone-cracked-lightning-blue.webp", 1000, 5000,
                    "Sister Embeth of the Mendevian Crusade, who carried it through the Worldwound.",
                    "Once, as a standard action, its bearer can touch a demon, which must succeed at a DC 20 Will save or be staggered for 1d4 rounds. "
                    "Vlathherex's cast give it a wide berth.",
                    {"subType": "misc", "uses": {"per": "single"},
                     "actions": [action("wardstone", "Touch a demon", actionType="save", save=("will", 20, "Will negates"), duration=("1d4", "round"),
                                        notes=["Demon staggered 1d4 rounds"])]}))
    H.append(simple("hoard-candle", "Half-Burned Candle of Truth (Father Draske's)", "loot", "icons/sundries/lights/candle-lit-yellow.webp", 1100, 1250,
                    "Father Ilvan Draske, a priest of Pharasma who tried to make Celmak tell the truth. It worked for nine minutes.",
                    "Use the standard rules for a <em>candle of truth</em> (Core Rulebook); 30 minutes of burn time left.", {"subType": "misc"}))
    return H


def build():
    for key, (name, color, sort) in FOLDERS.items():
        fid = hid("folder", PACK, key)
        write_doc(PACK, {"_id": fid, "_key": f"!folders!{fid}", "name": name, "type": "Item", "color": color, "sorting": "m", "sort": sort,
                         "folder": None, "description": "", "flags": {}, "_stats": stats(False)})
    out = {}
    for group in (trinkets(), prizes(), lots(), hoard()):
        for d in group:
            write_doc(PACK, d)
            out[d["name"]] = d
    return out
