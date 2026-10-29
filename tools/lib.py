"""Shared helpers for building the Hollow Garden compendium sources."""
import hashlib
import json
import os
import re

MODULE_ID = "hollow-garden"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_OUT = os.path.join(ROOT, "packs-src")
CORE_VERSION = "13.351"
SYSTEM_VERSION = "11.9"
_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"


def hid(*parts, n=16):
    """Deterministic Foundry-style id."""
    h = hashlib.sha256(("|".join(str(p) for p in parts)).encode()).digest()
    return "".join(_ALPHA[b % len(_ALPHA)] for b in h[:n])


def cid(*parts):
    """8 character id for changes."""
    return hid("change", *parts, n=8)


def stats(system=True):
    s = {"coreVersion": CORE_VERSION}
    if system:
        s.update({"systemId": "pf1", "systemVersion": SYSTEM_VERSION})
    return s


def asset(path):
    return f"modules/{MODULE_ID}/{path}"


def uuid(pack, doc_type, _id, page=None):
    u = f"Compendium.{MODULE_ID}.{pack}.{doc_type}.{_id}"
    if page:
        u += f".JournalEntryPage.{page}"
    return u


def link(pack, doc_type, _id, label):
    return f"@UUID[{uuid(pack, doc_type, _id)}]{{{label}}}"


def p(*paras):
    return "".join(f"<p>{x}</p>" for x in paras)


SEASON = "Звёздные Искатели"
# The adventure refers to the PCs by role ("Swap in their names"); this table uses their names.
TEXT_SUBS = [
    ("This module refers to the PCs by role. Swap in their names.", "This module refers to the PCs by name."),
    ("Season of Horrors", SEASON),
]
ROLES = [("Technologist", "Bodnar"), ("Merchant", "Ryuz"), ("Chronicler", "Altronus"), ("Ghaltan", "Yoshea")]
_ROLE_RES = []
for role, name in ROLES:
    _ROLE_RES.append((re.compile(r"\b[Tt]he " + role + r"\b"), name))
    _ROLE_RES.append((re.compile(r"\b" + role + r"\b"), name))
SKIP_KEYS = {"_id", "_key", "img", "path", "src", "documentUuid", "documentId", "documentCollection", "folder", "type"}


def rename_text(text):
    for a, b in TEXT_SUBS:
        text = text.replace(a, b)
    for rx, name in _ROLE_RES:
        text = rx.sub(name, text)
    return text


def _rename(obj):
    if isinstance(obj, dict):
        return {k: (v if k in SKIP_KEYS else _rename(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_rename(v) for v in obj]
    if isinstance(obj, str):
        return rename_text(obj)
    return obj


def write_doc(pack, doc):
    doc = _rename(doc)
    d = os.path.join(SRC_OUT, pack)
    os.makedirs(d, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", doc.get("name", doc["_id"]).lower()).strip("-")[:48]
    kind = doc["_key"].split("!")[1]
    with open(os.path.join(d, f"{kind}_{slug}_{doc['_id']}.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)


_CORE_ICONS = None


def core_icon(path):
    """Validate a core icon path against the list harvested from the PF1 system packs."""
    global _CORE_ICONS
    if _CORE_ICONS is None:
        fn = os.path.join(os.path.dirname(__file__), "core-icons.txt")
        _CORE_ICONS = set(open(fn).read().split()) if os.path.exists(fn) else set()
    if _CORE_ICONS and path.startswith("icons/") and path not in _CORE_ICONS:
        raise ValueError(f"Unverified core icon: {path}")
    return path
