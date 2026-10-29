/**
 * Keep the GM's material away from players: the adventure journal, the Producer's Guide,
 * stat blocks, tables, items, macros and sounds stay GM-only, wherever they end up.
 */
import { MODULE_ID } from "./constants.js";
import { isActiveGM } from "./util.js";

const GM_PACKS = ["hg-adventure", "hg-bestiary", "hg-items", "hg-tables", "hg-macros", "hg-sounds"];
const GM_ONLY = { PLAYER: "NONE", TRUSTED: "NONE", ASSISTANT: "OWNER" };

/** Is this journal entry (or a copy imported into the world) one of the GM-only journals? */
export function isGmJournal(doc) {
  const entry = doc?.documentName === "JournalEntryPage" ? doc.parent : doc;
  if (!entry) return false;
  if (entry.flags?.[MODULE_ID]?.gmOnly || entry.flags?.[MODULE_ID]?.adventure) return true;
  const src = entry._stats?.compendiumSource ?? entry.flags?.core?.sourceId ?? "";
  return typeof src === "string" && src.startsWith(`Compendium.${MODULE_ID}.hg-adventure.`);
}

const levels = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

/** Strip every grant to non-GM users; keep GM owners. */
function gmOnlyOwnership(ownership = {}) {
  const out = { default: levels().NONE };
  for (const [id, lvl] of Object.entries(ownership)) {
    if (id === "default") continue;
    if (game.users.get(id)?.isGM) out[id] = lvl;
  }
  return out;
}

function leaksToPlayers(ownership = {}) {
  if ((ownership.default ?? 0) > levels().NONE) return true;
  return Object.entries(ownership).some(([id, lvl]) => id !== "default" && lvl > levels().NONE && !game.users.get(id)?.isGM);
}

/** Active GM, on ready: lock the packs and any imported copies of the GM journals. */
export async function enforceSecrecy() {
  if (!isActiveGM()) return;
  for (const name of GM_PACKS) {
    const pack = game.packs.get(`${MODULE_ID}.${name}`);
    if (!pack) continue;
    const cur = pack.ownership ?? pack.config?.ownership ?? {};
    if (cur.PLAYER === "NONE" && cur.TRUSTED === "NONE") continue;
    try {
      await pack.configure({ ownership: { ...GM_ONLY } });
    } catch (err) {
      console.warn(`Hollow Garden | could not lock ${pack.collection}`, err);
    }
  }
  const fixes = [];
  for (const entry of game.journal ?? []) {
    if (!isGmJournal(entry)) continue;
    if (leaksToPlayers(entry.ownership)) fixes.push({ _id: entry.id, ownership: gmOnlyOwnership(entry.ownership) });
    const pages = entry.pages?.filter((p) => leaksToPlayers(p.ownership)) ?? [];
    if (pages.length) {
      await entry.updateEmbeddedDocuments("JournalEntryPage", pages.map((p) => ({ _id: p.id, ownership: { default: levels().INHERIT } })), { diff: false, recursive: false });
    }
  }
  if (fixes.length) {
    await JournalEntry.updateDocuments(fixes, { diff: false, recursive: false });
    ui.notifications.info(`The Hollow Garden: ${fixes.length} GM journal(s) were visible to players and are now GM-only again.`);
  }
}

/** Refuse to share the GM journals: ownership changes and "Show to players". */
export function registerSecrecyHooks() {
  const guard = (doc, data) => {
    if (!isGmJournal(doc) || !data?.ownership) return;
    if (!leaksToPlayers({ ...(doc.ownership ?? {}), ...data.ownership })) return;
    data.ownership = doc.documentName === "JournalEntryPage" ? { default: levels().INHERIT } : gmOnlyOwnership({ ...(doc.ownership ?? {}), ...data.ownership });
    ui.notifications?.warn("The Hollow Garden: the adventure journal and the Producer's Guide stay GM-only. Share a handout instead.");
  };
  Hooks.on("preUpdateJournalEntry", (doc, changes) => guard(doc, changes));
  Hooks.on("preUpdateJournalEntryPage", (doc, changes) => guard(doc, changes));
  Hooks.on("preCreateJournalEntry", (doc, data) => {
    if (!isGmJournal(doc)) return;
    const own = data.ownership ?? doc.ownership ?? {};
    if (leaksToPlayers(own)) doc.updateSource({ ownership: gmOnlyOwnership(own) });
  });

  // "Show to players" bypasses ownership, so wrap it for the GM journals.
  const Journal = foundry.documents?.collections?.Journal ?? globalThis.Journal;
  if (Journal?.show && !Journal.show.hgWrapped) {
    const original = Journal.show;
    const wrapped = function (doc, options) {
      if (isGmJournal(doc)) {
        ui.notifications?.warn("The Hollow Garden: this journal is GM-only and can't be shown to players.");
        return Promise.resolve(doc);
      }
      return original.call(this, doc, options);
    };
    wrapped.hgWrapped = true;
    Journal.show = wrapped;
  }
}
