import { MODULE_ID, RATING_MAX, SHOW_MAX, SHOW_MIN, defaultState, EPISODES } from "./constants.js";
import { clamp, isGM, randomId, setting } from "./util.js";

const listeners = new Set();
let lastSeenEvent = null;

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Normalise stored state so older/partial data never breaks the board. */
export function normalize(raw) {
  const base = defaultState();
  const s = foundry.utils.mergeObject(base, raw ?? {}, { inplace: false, insertKeys: true, insertValues: true });
  if (!Array.isArray(raw?.contestants)) s.contestants = base.contestants;
  s.contestants = s.contestants.map((c) => ({ ...c, rating: clamp(Number(c.rating ?? 5), 0, RATING_MAX), art: { ...(c.art ?? {}) } }));
  const eps = Array.isArray(raw?.episodes) ? raw.episodes : base.episodes;
  s.episodes = EPISODES.map((e) => ({ id: e.id, done: !!eps.find((x) => x.id === e.id)?.done }));
  s.show = clamp(Number(s.show ?? 3), SHOW_MIN, SHOW_MAX);
  return s;
}

export function getState() {
  return normalize(setting("state"));
}

export async function setState(next) {
  if (!isGM()) {
    ui.notifications?.warn("Only the GM can change the show.");
    return;
  }
  await game.settings.set(MODULE_ID, "state", foundry.utils.deepClone(next));
}

/** Called by the setting's onChange on every client. */
export function handleStateChange(raw) {
  const state = normalize(raw);
  const ev = state.lastEvent;
  const isNew = ev && ev.id !== lastSeenEvent;
  if (ev) lastSeenEvent = ev.id;
  for (const fn of listeners) {
    try {
      fn(state, isNew ? ev : null);
    } catch (err) {
      console.error("Hollow Garden | state listener failed", err);
    }
  }
}

export function markSeen(state) {
  lastSeenEvent = state?.lastEvent?.id ?? null;
}

function event(type, data = {}) {
  return { id: randomId(), type, t: Date.now(), ...data };
}

/* ------------------------------------------------------------------ */
/*  Mutations (GM only)                                                */
/* ------------------------------------------------------------------ */

export async function adjustShow(delta, reason = "", { quiet = false, type = "show" } = {}) {
  const s = getState();
  const from = s.show;
  s.show = clamp(from + delta, SHOW_MIN, SHOW_MAX);
  s.lastEvent = event(quiet ? "reset" : type, { show: { from, to: s.show }, delta: s.show - from, reason });
  await setState(s);
}

export async function setShow(value, reason = "", opts = {}) {
  const s = getState();
  return adjustShow(clamp(value, SHOW_MIN, SHOW_MAX) - s.show, reason, opts);
}

export async function adjustContestant(cid, delta, reason = "", { link = undefined } = {}) {
  const s = getState();
  const c = s.contestants.find((x) => x.id === cid);
  if (!c) return;
  const from = c.rating;
  c.rating = clamp(from + delta, 0, RATING_MAX);
  const useLink = link ?? setting("linkRatings") !== false;
  const showFrom = s.show;
  if (useLink && c.rating !== from) s.show = clamp(s.show + Math.sign(delta), SHOW_MIN, SHOW_MAX);
  s.lastEvent = event("contestant", { cid, from, to: c.rating, delta: c.rating - from, reason, show: { from: showFrom, to: s.show } });
  await setState(s);
}

export async function setVisible(visible) {
  const s = getState();
  s.visible = !!visible;
  s.lastEvent = event("visibility", { visible: s.visible });
  await setState(s);
}

export async function toggleVisible() {
  return setVisible(!getState().visible);
}

export async function setCurrentEpisode(id, { done = null } = {}) {
  const s = getState();
  s.current = id;
  if (done != null) {
    const e = s.episodes.find((x) => x.id === id);
    if (e) e.done = done;
  }
  s.lastEvent = event("episode", { episode: id });
  await setState(s);
}

export async function setEpisodesDone(map) {
  const s = getState();
  for (const e of s.episodes) if (e.id in map) e.done = !!map[e.id];
  s.lastEvent = event("episodes", {});
  await setState(s);
}

export async function updateContestants(list) {
  const s = getState();
  s.contestants = list;
  s.lastEvent = event("cast", {});
  await setState(s);
}

export async function resetSeason({ keepCast = true } = {}) {
  const s = getState();
  const fresh = defaultState();
  if (keepCast) fresh.contestants = s.contestants.map((c) => ({ ...c, rating: 5 }));
  fresh.visible = s.visible;
  fresh.lastEvent = event("reset", { season: true });
  await setState(fresh);
}

export function leader(state) {
  const vis = state.contestants.filter((c) => c.visible);
  if (!vis.length) return null;
  const max = Math.max(...vis.map((c) => c.rating));
  const top = vis.filter((c) => c.rating === max);
  return top.length === 1 ? top[0] : null;
}

export function topContestants(state) {
  const vis = state.contestants.filter((c) => c.visible);
  if (!vis.length) return [];
  const max = Math.max(...vis.map((c) => c.rating));
  return vis.filter((c) => c.rating === max);
}
