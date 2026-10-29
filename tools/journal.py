"""Journal entries: the adventure itself (converted from the PDF), player handouts and the producer's guide."""
import html as _html
import json
import os
import re

from lib import MODULE_ID, ROOT, asset, hid, stats, uuid, write_doc

ADV_PACK = "hg-adventure"
HANDOUT_PACK = "hg-handouts"
SRC = os.path.join(ROOT, "src", "journal")

DIAGRAM = """
<div class="hg-flow">
  <div class="hg-flow-row">
    <div class="hg-node">Foyer<small>doors seal, Muse scan</small></div>
    <span class="hg-arrow">&#8594;</span>
    <div class="hg-node hg-hub">Green Room<small>hub, the only place to rest</small></div>
    <span class="hg-arrow hg-dashed">cast sent in &#8672;</span>
    <div class="hg-node hg-cast">Cast Quarters<small>Vlathherex and his demons</small></div>
  </div>
  <div class="hg-flow-row hg-episodes">
    <div class="hg-node">The Showroom<small>Technologist</small></div>
    <div class="hg-node">The Auction<small>Merchant</small></div>
    <div class="hg-node">Companions<small>3 short scenes</small></div>
    <div class="hg-node">Reruns<small>Chronicler</small></div>
    <div class="hg-node hg-garden">Hollow Garden<small>Ghaltan, Lock Tree</small></div>
  </div>
  <div class="hg-flow-row">
    <div class="hg-node hg-vault">Core Vault<small>spare stand-ins, the Core</small></div>
    <span class="hg-arrow">&#8592;</span>
    <div class="hg-node hg-booth">Booth and Studio Zero<small>stand-in and the Doppel-cast</small></div>
    <span class="hg-arrow hg-dashed">&#8592; lock falls, Booth opens</span>
  </div>
  <div class="hg-flow-row">
    <span class="hg-arrow hg-dashed">power conduit &#8595;</span>
    <div class="hg-node hg-hidden">The Cutting Room<small>hidden: Celmak's real body</small></div>
    <span class="hg-arrow hg-dashed">&#8593; hatch under the lake</span>
  </div>
  <p class="hg-flow-caption">Every episode runs through the Green Room; Celmak hides below them all.</p>
</div>"""

EPISODES = [
    # key, title, spotlight label, contestant id, journal chapter file prefix, anchor heading
    ("showroom", "The Showroom", "The Technologist", "bodnar", "03", None),
    ("auction", "The Auction", "The Merchant", "ryuz", "04", None),
    ("take113", "The 113th Take", "Casandalee", "casandalee", "07", "The 113th Take (Casandalee, CR 14)"),
    ("reruns", "Reruns of Tomorrow", "The Chronicler", "altronus", "05", None),
    ("ambassadors", "The Ambassadors", "Isuma", "isuma", "07", "The Ambassadors (Isuma)"),
    ("mint", "Mint Condition", "Meyanda", "meyanda", "07", "Mint Condition (Meyanda)"),
    ("garden", "The Hollow Garden", "The Ghaltan", "yoshea", "06", None),
    ("finale", "Season Finale", "Everyone", None, "09", None),
]


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def enrich(html, links):
    """Link the first plain-text mention of each known name, skipping headings, tables headers, links and statblock titles."""
    used = set()
    out = []
    stack = []
    for tok in re.split(r"(<[^>]+>)", html):
        if tok.startswith("<"):
            m = re.match(r"<(/?)(\w+)", tok)
            if m:
                name = m.group(2).lower()
                if m.group(1):
                    if name in stack:
                        while stack and stack.pop() != name:
                            pass
                elif not tok.endswith("/>") and name not in ("br", "img", "hr"):
                    stack.append(name)
            out.append(tok)
            continue
        if any(t in stack for t in ("h1", "h2", "h3", "h4", "h5", "th", "a", "blockquote")):
            out.append(tok)
            continue
        for pattern, ref, label_fn in links:
            if ref in used:
                continue
            m = re.search(pattern, tok)
            if m:
                text = m.group(0)
                tok = tok[:m.start()] + f"@UUID[{ref}]{{{label_fn(text)}}}" + tok[m.end():]
                used.add(ref)
        out.append(tok)
    return "".join(out)


def build_link_table(actors, items, tables):
    A = {a["name"]: a for a in actors}
    I = items
    L = []

    def add(pat, ref):
        L.append((pat, ref, lambda t: t))
    add(r"\bPrize Sentinel\b", uuid("hg-bestiary", "Actor", A["Prize Sentinel"]["_id"]))
    add(r"\bStagehand Drones?\b", uuid("hg-bestiary", "Actor", A["Stagehand Drone"]["_id"]))
    add(r"\bTopiary Hounds?\b", uuid("hg-bestiary", "Actor", A["Topiary Hound"]["_id"]))
    add(r"\bCourtier Mannequins?\b", uuid("hg-bestiary", "Actor", A["Courtier Mannequin"]["_id"]))
    add(r"\bHard-Light Actors?\b", uuid("hg-bestiary", "Actor", A["Hard-Light Actor"]["_id"]))
    add(r"\bGardener Colossus\b", uuid("hg-bestiary", "Actor", A["Gardener Colossus"]["_id"]))
    add(r"\bVlathherex\b", uuid("hg-bestiary", "Actor", A["Vlathherex"]["_id"]))
    add(r"\b[Cc]elmak[’']s stand-in\b", uuid("hg-bestiary", "Actor", A["Celmak's Stand-In"]["_id"]))
    add(r"\bCelmak Toysiel\b", uuid("hg-bestiary", "Actor", A["Celmak Toysiel"]["_id"]))
    for pat, name in [(r"\bnanite resonance lattice\b", "Nanite Resonance Lattice"), (r"\bhard-light emitter bracer\b", "Hard-Light Emitter Bracer"),
                      (r"\bapplause injectors?\b", "Applause Injector"), (r"\bledger of the fallen\b", "Ledger of the Fallen"),
                      (r"\banchor array schematic\b", "Anchor Array Schematic"), (r"\bambassador[’']s recording crystal\b", "Ambassador's Recording Crystal"),
                      (r"\btemporal rewind cartridge\b", "Temporal Rewind Cartridge"), (r"\bseed of the Hollow Garden\b", "Seed of the Hollow Garden"),
                      (r"\bandroid service cradle\b", "Android Service Cradle"), (r"\bmonofilament fans?\b", "Monofilament Fan"),
                      (r"\bMuse visor\b", "Muse Visor"), (r"\bGarden Credits\b", "Garden Credit"), (r"\bcue card\b", "Cue Card")]:
        add(pat, uuid("hg-items", "Item", I[name]["_id"]))
    for pat, key in [(r"\bAmusing Fakes table\b", "amusing"), (r"\bDetrimental Fakes table\b", "detrimental"), (r"\bMystery Box table\b", "mystery")]:
        add(pat, uuid("hg-tables", "RollTable", tables[key]["_id"]))
    return L


TABLE_BUTTONS = [  # (chapter prefix, header first cell, table key, label)
    ("00", "d6", "mood-gas", "Roll Mood Gas"),
    ("00", "d10", "amusing", "Roll Amusing Fakes"),
    ("00", "d8", "detrimental", "Roll Detrimental Fakes"),
    ("04", "d6", "mystery", "Roll the Mystery Box"),
    ("05", "d8", "mistakes", "Roll Celmak's Mistakes"),
    ("07", "d4", "catalogue", "Roll Meyanda's Catalogue"),
    ("11", "d8", "trinkets", "Draw a Trinket"),
]


def add_table_buttons(prefix, html, tables):
    for pre, first, key, label in TABLE_BUTTONS:
        if pre != prefix:
            continue
        pat = re.compile(r"(<table class=\"hg-table\"><thead><tr><th>(?:<strong>)?" + re.escape(first) + r"(?:</strong>)?</th>.*?</table>)", re.S)
        ref = uuid("hg-tables", "RollTable", tables[key]["_id"])
        html = pat.sub(lambda m: m.group(1) + f'<p class="hg-roll-link">&#127922; @UUID[{ref}]{{{label}}}</p>', html, count=1)
    return html


def fix_statblocks(html):
    html = re.sub(r"\s(Constant|At will|\d+/day) —", r"<br>\1 —", html)
    return html


def episode_cards(prefix, host_img):
    return ""


def build(actors, items, tables, host):
    index = json.load(open(os.path.join(SRC, "index.json")))
    links = build_link_table(actors, items, tables)
    jid = hid("journal", "adventure")
    pages = []
    page_ids = {}
    chapter_quick = {
        "03": ["Prize Sentinel", "Stagehand Drone"], "04": ["Courtier Mannequin", "Vlathherex"], "05": ["Hard-Light Actor"],
        "06": ["Gardener Colossus", "Topiary Hound"], "07": ["Hard-Light Actor"], "08": ["Vlathherex"],
        "09": ["Celmak's Stand-In", "Celmak Toysiel"], "01": ["Celmak's Stand-In", "Celmak Toysiel"], "10": [
            "Stagehand Drone", "Topiary Hound", "Courtier Mannequin", "Hard-Light Actor", "Prize Sentinel", "Gardener Colossus"],
    }
    A = {a["name"]: a for a in actors}
    for n, entry in enumerate(index):
        prefix = entry["file"][:2]
        raw = open(os.path.join(SRC, entry["file"]), encoding="utf-8").read()
        raw = raw.replace("@@DIAGRAM@@", DIAGRAM)
        raw = fix_statblocks(raw)
        raw = add_table_buttons(prefix, raw, tables)
        body = enrich(raw, links)
        quick = chapter_quick.get(prefix)
        if quick:
            chips = " ".join(f"@UUID[{uuid('hg-bestiary', 'Actor', A[q]['_id'])}]{{{q}}}" for q in quick)
            body = f'<aside class="hg-quick"><strong>On set:</strong> {chips}</aside>' + body
        pid = hid(jid, "page", entry["file"])
        page_ids[prefix] = pid
        pages.append({"_id": pid, "_key": f"!journal.pages!{jid}.{pid}", "name": entry["title"], "type": "text",
                      "title": {"show": True, "level": 1}, "text": {"format": 1, "content": f'<div class="hg-journal">{body}</div>'},
                      "sort": (n + 1) * 100000, "ownership": {"default": -1}, "flags": {}, "_stats": stats(False)})
    adv = {"_id": jid, "_key": f"!journal!{jid}", "name": "The Hollow Garden: Season of Horrors", "pages": pages,
           "folder": None, "sort": 0, "flags": {MODULE_ID: {"adventure": True}}, "_stats": stats(False)}
    write_doc(ADV_PACK, adv)

    # ----- Producer's guide (GM) -----
    gid = hid("journal", "guide")
    guide_pages = []
    for i, (title, content) in enumerate(GUIDE):
        pid = hid(gid, "page", title)
        guide_pages.append({"_id": pid, "_key": f"!journal.pages!{gid}.{pid}", "name": title, "type": "text", "title": {"show": True, "level": 1},
                            "text": {"format": 1, "content": f'<div class="hg-journal">{content}</div>'}, "sort": (i + 1) * 100000,
                            "_stats": stats(False)})
    write_doc(ADV_PACK, {"_id": gid, "_key": f"!journal!{gid}", "name": "Producer's Guide (module controls)", "pages": guide_pages,
                         "folder": None, "sort": 100, "flags": {}, "_stats": stats(False)})

    # ----- Player handouts -----
    hidj = hid("journal", "handouts")
    rules = ('<div class="hg-handout hg-rules"><div class="hg-handout-head"><img src="' + host("mic-welcome") + '" alt="">'
             '<h2>THE HOLLOW GARDEN</h2><p class="hg-sub">Season of Horrors · Official Rules of the Show</p></div>'
             "<ol><li>Every contestant gets an episode of their own.</li><li>Rest only in the Green Room. Intermissions cost ratings.</li>"
             "<li>Nobody leaves early.</li><li>Heroic, brave, vile or debased acts earn prizes.</li><li>Audience votes are final.</li></ol>"
             '<p class="hg-fine">Contestants, the doors are open and the stakes are personal!</p></div>')
    cast = ['<div class="hg-handout"><div class="hg-handout-head"><h2>TONIGHT’S CONTESTANTS</h2><p class="hg-sub">Who will be the fan favourite?</p></div><div class="hg-cast-grid">']
    for cid_, name, role in CONTESTANTS:
        cast.append(f'<figure><img src="{asset(f"assets/contestants/{cid_}-happy.webp")}" alt="{name}"><figcaption><strong>{name}</strong><span>{role}</span></figcaption></figure>')
    cast.append("</div></div>")
    hp = []
    for i, (title, content) in enumerate((("The Rules of the Show", rules), ("Tonight's Contestants", "".join(cast)))):
        pid = hid(hidj, "page", title)
        hp.append({"_id": pid, "_key": f"!journal.pages!{hidj}.{pid}", "name": title, "type": "text", "title": {"show": False, "level": 1},
                   "text": {"format": 1, "content": content}, "sort": (i + 1) * 100000, "_stats": stats(False)})
    write_doc(HANDOUT_PACK, {"_id": hidj, "_key": f"!journal!{hidj}", "name": "The Hollow Garden: Contestant Handouts", "pages": hp,
                             "folder": None, "sort": 0, "flags": {}, "ownership": {"default": 2}, "_stats": stats(False)})

    # episodes -> page uuids for the JS side
    eps = []
    for key, title, spotlight, contestant, prefix, anchor in EPISODES:
        page_uuid = f"Compendium.{MODULE_ID}.{ADV_PACK}.JournalEntry.{jid}.JournalEntryPage.{page_ids[prefix]}"
        eps.append({"id": key, "title": title, "spotlight": spotlight, "contestant": contestant, "page": page_uuid,
                    "anchor": slugify(anchor) if anchor else None})
    return {"journal": jid, "episodes": eps, "pages": page_ids}


CONTESTANTS = [
    ("bodnar", "Bodnar", "The Technologist"),
    ("ryuz", "Ryuz", "The Merchant"),
    ("altronus", "Altronus", "The Chronicler"),
    ("yoshea", "Yoshea", "The Ghaltan"),
    ("casandalee", "Casandalee", "Companion · android oracle"),
    ("meyanda", "Meyanda", "Companion · android"),
    ("isuma", "Isuma", "Companion · kasatha"),
]

GUIDE = [
    ("Quick Start", """
<p>Welcome to the Booth, producer. This module turns your table into Celmak's studio. Everything below is <strong>GM-only</strong> unless it says otherwise.</p>
<ol>
<li><strong>Open the Producer Console</strong>: the <em>broadcast tower</em> button in the Token controls (left toolbar), the button on the ratings board, or the <em>Producer Console</em> macro in the <em>Producer Macros</em> compendium.</li>
<li><strong>Cast the contestants</strong>: Console → <em>Ratings</em> → <em>Contestants…</em>. Link each card to a player's actor, rename it, or hide companions who are sitting in the Box. Portraits default to the supplied chibi art.</li>
<li><strong>Go live</strong>: press <em>Show board</em> (or the ON AIR tab at the top of the screen). Every connected player now sees the ratings board.</li>
</ol>
<p>Import the actors, items and tables you need from the <em>The Hollow Garden: Season of Horrors</em> compendium folder; the journal links open them directly.</p>"""),
    ("The Ratings Board", """
<p>The board shows two things:</p>
<ul>
<li><strong>Show Rating (1–5)</strong>, the adventure's own ratings track. It starts at 3. Use the console's quick reasons (heroic sacrifice, betrayal, honeypot swallowed, off-script…) or the +/– buttons.</li>
<li><strong>Fan meters (0–10)</strong> for every contestant. Portraits change with the fans' mood: crying at 3 or less, cool at 4–6, cheering at 7+. The leader wears the <em>Fan Favourite</em> crown; anyone at 2 or less is in the <em>Danger Zone</em>.</li>
</ul>
<p>With <em>Link fan meters to the Show Rating</em> enabled (module settings), raising a contestant also nudges the Show Rating the same way.</p>
<h3>Automatic rules</h3>
<ul>
<li><strong>Rating hits 5</strong>: the studio erupts, a GM-only chat card offers <em>Award Trinket</em> to the highest-rated contestant (drawn from <em>Celmak's Trinkets</em> and added to the linked actor), and the rating resets to 3.</li>
<li><strong>Rating hits 1</strong>: alarms, and a GM card lists Celmak's escalation options (Mood Gas vent, demon cast member, room reconfiguration, audience vote). The rating resets to 2.</li>
<li>At 2 and 4 you get a whispered reminder of Celmak's response.</li>
</ul>
<p>Turn the automation off in module settings if you prefer to run the track by hand.</p>"""),
    ("Episode Roulette", """
<p>Celmak's schedule is fixed, but the audience doesn't need to know that. <em>Games → Spin the Episode Wheel</em> opens the rigging desk:</p>
<ul>
<li>Tick which episodes are already done (they drop off the wheel).</li>
<li>Choose where the wheel will land. The default is the next episode on Celmak's schedule.</li>
<li>Pick a spin length and press <strong>Spin</strong>. Every client sees the same wheel slow down and land on your choice, with ticks, a drumroll and a fanfare.</li>
</ul>
<p>When it lands you get a GM chat card with a link to the episode's journal page and a <em>Roll title card</em> button.</p>"""),
    ("Soundboard, Stickers & Broadcast", """
<ul>
<li><strong>Soundboard</strong>: each cue plays a sound for everyone and pops up a sticker of the host. <em>Shift-click</em> previews it only for you.</li>
<li><strong>Stickers</strong>: pop any of the host's 28 stickers silently.</li>
<li><strong>Celmak says</strong>: pick a persona (Host, Critic, Lover, Child), type a line or draw a random one, and it appears as a broadcast caption with the matching sticker.</li>
<li><strong>Title cards</strong>: episode openers, <em>Commercial Break</em> (intermission; optionally −1 rating), <em>Previously On…</em>, and the <em>Season Finale</em>.</li>
<li><strong>Effects</strong>: confetti, The Gap glitch, screen shake, and <em>Mood Gas</em>, which rolls the d6 table, fogs everyone's screen in the effect's colour and posts the DCs.</li>
</ul>
<p>Each player can lower the module's sound volume, turn off stickers, or reduce motion in their own module settings.</p>"""),
    ("Audience Votes & Honeypots", """
<p><strong>Audience vote</strong>: enter a question and up to four options, then set the rigged percentages (or pick a winner and let the console invent believable numbers). Players watch a live vote with a countdown before the result is revealed.</p>
<p><strong>Honeypot check</strong>: when someone reads one of the Garden's machines with Knowledge (engineering), open <em>Games → Honeypot check</em>. Roll from the linked actor's sheet or type in the total and the natural d20. The console sorts the result into the bands (61+ real answer; 60 or less with a natural 1–10 is an amusing fake, with a laugh and +1 rating; 11–20 is a detrimental fake) and whispers you the table result. Players only see what you tell them.</p>"""),
]
