import { MODULE_ID } from "./constants.js";

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function randomId() {
  return foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);
}

export function setting(key) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return undefined;
  }
}

export const isGM = () => !!game.user?.isGM;

/** Only one GM should run automation and post cards. */
export function isActiveGM() {
  if (!game.user?.isGM) return false;
  const active = game.users?.activeGM;
  return active ? active.id === game.user.id : true;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function reduceMotion() {
  return !!setting("reduceMotion") || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/** Draw from a RollTable by UUID without posting the default chat card. */
export async function drawTable(uuid) {
  const table = await fromUuid(uuid);
  if (!table) {
    ui.notifications?.warn(`The Hollow Garden: roll table not found (${uuid}).`);
    return null;
  }
  const { roll, results } = await table.roll();
  return { table, roll, results };
}

export function resultText(result) {
  if (!result) return "";
  return result.description || result.text || result.name || "";
}

export function resultUuid(result) {
  if (!result) return null;
  if (result.documentUuid) return result.documentUuid;
  if (result.documentCollection && result.documentId) {
    const coll = result.documentCollection;
    return coll.includes(".") ? `Compendium.${coll}.Item.${result.documentId}` : `${coll}.${result.documentId}`;
  }
  return null;
}

export function gmWhisper() {
  return game.users.filter((u) => u.isGM).map((u) => u.id);
}

export async function chatCard({ title, body, sticker, whisper = false, flags = {}, buttons = [] }) {
  const btns = buttons
    .map((b) => `<button type="button" class="hg-chat-btn" data-hg-action="${esc(b.action)}" ${Object.entries(b.data ?? {})
      .map(([k, v]) => `data-${k}="${esc(v)}"`)
      .join(" ")}><i class="${esc(b.icon ?? "fa-solid fa-star")}"></i> ${esc(b.label)}</button>`)
    .join("");
  const content = `<div class="hg-chat-card">
    <header>${sticker ? `<img src="${esc(sticker)}" alt="">` : ""}<h3>${title}</h3></header>
    <div class="hg-chat-body">${body}</div>
    ${btns ? `<footer>${btns}</footer>` : ""}
  </div>`;
  const data = {
    content,
    speaker: { alias: "Сельмак" },
    flags: { [MODULE_ID]: { card: true, ...flags } }
  };
  if (whisper) data.whisper = gmWhisper();
  return ChatMessage.create(data);
}
