import { EPISODES, MODULE_ID, RATING_MAX, SEASON_TITLE, SHOW_RESPONSES, SHOW_TITLE, moodFor } from "./constants.js";
import { adjustContestant, adjustShow, getState, toggleVisible, updateContestants } from "./state.js";
import { playSfx } from "./audio.js";
import { esc, isGM, setting } from "./util.js";

const DOCKS = ["top-right", "bottom-right", "bottom-left", "top-left"];
const DOCK_LABEL = { "top-right": "вверху справа", "bottom-right": "внизу справа", "bottom-left": "внизу слева", "top-left": "вверху слева" };

/**
 * The on-screen ratings board. A small frameless HUD that every client renders from the shared world state.
 * Only the GM changes values; everyone can dock it to a corner, drag it, collapse it and set their own volume.
 */
export class RatingsBoard {
  static #instance;

  static get instance() {
    return (this.#instance ??= new RatingsBoard());
  }

  constructor() {
    this.prev = null;
    this.root = null;
    this.volumeOpen = false;
  }

  mount() {
    if (this.root?.isConnected) return;
    this.root = document.createElement("section");
    this.root.id = "hg-board";
    this.root.setAttribute("aria-label", "Рейтинги шоу");
    document.body.appendChild(this.root);
    this.root.addEventListener("click", (ev) => this.#onClick(ev));
    this.root.addEventListener("contextmenu", (ev) => this.#onContext(ev));
    this.root.addEventListener("pointerdown", (ev) => this.#onDragStart(ev));
    this.root.addEventListener("input", (ev) => this.#onInput(ev));
    this.root.addEventListener("change", (ev) => this.#onVolumeCommit(ev));
    this.root.addEventListener("dragover", (ev) => this.#onDragOver(ev));
    this.root.addEventListener("dragleave", (ev) => ev.target.closest?.(".hg-card")?.classList.remove("hg-drop"));
    this.root.addEventListener("drop", (ev) => this.#onDrop(ev));
    document.addEventListener("pointerdown", (ev) => {
      if (this.volumeOpen && !ev.target.closest?.(".hg-vol")) {
        this.volumeOpen = false;
        this.render(getState(), { initial: true });
      }
    });
    this.applyPosition();
    this.render(getState(), { initial: true });
  }

  applyPosition() {
    if (!this.root) return;
    const dock = setting("boardDock") || "top-right";
    const pos = setting("boardPos");
    for (const d of DOCKS) this.root.classList.remove(`hg-dock-${d}`);
    this.root.style.left = this.root.style.top = "";
    if (dock === "free" && pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      this.root.classList.add("hg-placed");
      this.root.style.left = `${Math.min(Math.max(0, pos.left), Math.max(0, window.innerWidth - 120))}px`;
      this.root.style.top = `${Math.min(Math.max(0, pos.top), Math.max(0, window.innerHeight - 60))}px`;
    } else {
      this.root.classList.remove("hg-placed");
      this.root.classList.add(`hg-dock-${DOCKS.includes(dock) ? dock : "top-right"}`);
    }
  }

  #volumeHTML() {
    const vol = Math.round(Number(setting("sfxVolume") ?? 0.8) * 100);
    return `<span class="hg-vol ${this.volumeOpen ? "open" : ""}">
        <button type="button" data-hg="volume" title="Громкость студии (только у вас)"><i class="fa-solid ${vol === 0 ? "fa-volume-xmark" : vol < 50 ? "fa-volume-low" : "fa-volume-high"}"></i></button>
        ${this.volumeOpen ? `<span class="hg-vol-pop"><input type="range" min="0" max="100" step="5" value="${vol}" data-hg-volume aria-label="Громкость"><span class="hg-vol-val">${vol}%</span></span>` : ""}
      </span>`;
  }

  render(state, { initial = false } = {}) {
    if (!this.root) return;
    const gm = isGM();
    const compact = setting("boardCompact") !== false;
    const visible = state.visible;
    this.root.classList.toggle("hg-gm", gm);
    this.root.classList.toggle("hg-compact", compact);
    this.root.classList.toggle("hg-offair", !visible);
    this.root.hidden = !visible && !gm;

    if (!visible) {
      this.root.innerHTML = gm
        ? `<div class="hg-offair-tab">
             <button type="button" data-hg="golive" title="Show the ratings board to everyone"><span class="hg-dot"></span>OFF AIR · go live</button>
             <button type="button" data-hg="console" title="Producer Console"><i class="fa-solid fa-tower-broadcast"></i></button>
           </div>`
        : "";
      this.prev = this.#snapshot(state);
      return;
    }

    const lead = leaderOf(state);
    const ep = EPISODES.find((e) => e.id === state.current);
    const resp = SHOW_RESPONSES[state.show];
    const pips = [1, 2, 3, 4, 5]
      .map((n) => `<span class="hg-pip ${n <= state.show ? "on" : ""} hg-pip-${n}" ${gm ? `data-hg="setshow" data-value="${n}" title="Set to ${n}"` : ""}></span>`)
      .join("");
    const cards = state.contestants
      .filter((c) => c.visible)
      .map((c) => {
        const mood = moodFor(c.rating);
        const img = c.art?.[mood] || c.art?.neutral || "";
        const pct = Math.round((c.rating / RATING_MAX) * 100);
        const classes = ["hg-card", `hg-mood-${mood}`];
        if (lead?.id === c.id) classes.push("hg-leader");
        if (c.rating <= 2) classes.push("hg-danger");
        return `<article class="${classes.join(" ")}" data-cid="${esc(c.id)}" title="${esc(c.name)}: ${c.rating}/${RATING_MAX}">
            ${lead?.id === c.id ? `<div class="hg-crown"><i class="fa-solid fa-crown"></i> ЛЮБИМЕЦ ПУБЛИКИ</div>` : ""}
            ${c.rating <= 2 ? `<div class="hg-danger-tag">ЗОНА РИСКА</div>` : ""}
            ${gm && c.actorUuid ? `<span class="hg-linked" title="Linked actor (click the portrait to open it)"><i class="fa-solid fa-link"></i></span>` : ""}
            <div class="hg-portrait" ${gm ? `data-hg="actor"` : ""}><img src="${esc(img)}" alt="${esc(c.name)}" draggable="false"></div>
            <div class="hg-nameplate"><span class="hg-name">${esc(c.name)}</span></div>
            <div class="hg-meter" role="meter" aria-valuemin="1" aria-valuemax="${RATING_MAX}" aria-valuenow="${c.rating}" aria-label="${esc(c.name)}">
              <div class="hg-meter-fill" style="width:${pct}%"></div>
              <div class="hg-meter-ticks"></div>
              <span class="hg-meter-value">${c.rating}</span>
            </div>
            ${gm ? `<div class="hg-gm-ctl">
                <button type="button" data-hg="minus" title="−1 fans (right-click: without moving the Show Rating)">−</button>
                <button type="button" data-hg="plus" title="+1 fans (right-click: without moving the Show Rating)">+</button>
              </div>` : ""}
          </article>`;
      })
      .join("");

    this.root.innerHTML = `
      <header class="hg-bar" data-drag title="Перетащите, чтобы переместить">
        <span class="hg-live"><span class="hg-dot"></span>ЭФИР</span>
        <span class="hg-brand">${esc(SHOW_TITLE.toUpperCase())}<small>${esc(SEASON_TITLE)}</small></span>
        ${ep ? `<span class="hg-now">СЕЙЧАС: <strong>${esc(ep.ru)}</strong></span>` : ""}
        <span class="hg-tools">
          ${this.#volumeHTML()}
          ${gm ? `<button type="button" data-hg="console" title="Producer Console"><i class="fa-solid fa-tower-broadcast"></i></button>
                  <button type="button" data-hg="hide" title="Take the board off air"><i class="fa-solid fa-eye-slash"></i></button>` : ""}
          <button type="button" data-hg="dock" title="Переместить в угол (сейчас: ${esc(DOCK_LABEL[setting("boardDock")] ?? "свободно")})"><i class="fa-solid fa-table-cells-large"></i></button>
          <button type="button" data-hg="compact" title="${compact ? "Развернуть" : "Свернуть"}"><i class="fa-solid ${compact ? "fa-up-right-and-down-left-from-center" : "fa-down-left-and-up-right-to-center"}"></i></button>
        </span>
      </header>
      <div class="hg-show hg-show-${state.show}">
        <div class="hg-show-label">РЕЙТИНГ</div>
        <div class="hg-pips">${pips}</div>
        <div class="hg-show-value">${state.show}<small>/5</small></div>
        ${gm ? `<div class="hg-show-ctl"><button type="button" data-hg="showminus">−</button><button type="button" data-hg="showplus">+</button></div>` : ""}
        <div class="hg-show-resp" title="${gm ? esc(resp.text) : ""}"><strong>${esc(resp.label)}</strong></div>
      </div>
      <div class="hg-cards">${cards || `<div class="hg-empty">На сцене никого нет.</div>`}</div>`;

    if (!initial) this.#animateDiff(state);
    this.prev = this.#snapshot(state);
  }

  #snapshot(state) {
    return { show: state.show, ratings: Object.fromEntries(state.contestants.map((c) => [c.id, c.rating])) };
  }

  /** A gentle in-place highlight; nothing outside the board moves. */
  #animateDiff(state) {
    if (!this.prev) return;
    for (const c of state.contestants) {
      const before = this.prev.ratings[c.id];
      if (before == null || before === c.rating) continue;
      const card = this.root.querySelector(`.hg-card[data-cid="${CSS.escape(c.id)}"]`);
      card?.classList.add(c.rating > before ? "hg-bump-up" : "hg-bump-down");
    }
  }

  async #onClick(ev) {
    const btn = ev.target.closest("[data-hg]");
    if (!btn || this.dragMoved) return;
    const act = btn.dataset.hg;
    const cid = btn.closest(".hg-card")?.dataset.cid;
    const api = game.modules.get(MODULE_ID)?.api;
    switch (act) {
      case "volume":
        this.volumeOpen = !this.volumeOpen;
        return this.render(getState(), { initial: true });
      case "compact":
        await game.settings.set(MODULE_ID, "boardCompact", !(setting("boardCompact") !== false));
        return this.render(getState(), { initial: true });
      case "dock": {
        const cur = setting("boardDock");
        const next = DOCKS[(DOCKS.indexOf(cur) + 1) % DOCKS.length] ?? DOCKS[0];
        await game.settings.set(MODULE_ID, "boardDock", next);
        this.applyPosition();
        return this.render(getState(), { initial: true });
      }
      case "console":
        return api?.openConsole();
      case "golive":
      case "hide":
        return toggleVisible();
      case "plus":
        return adjustContestant(cid, 1, "Board");
      case "minus":
        return adjustContestant(cid, -1, "Board");
      case "showplus":
        return adjustShow(1, "Board");
      case "showminus":
        return adjustShow(-1, "Board");
      case "setshow":
        return adjustShow(Number(btn.dataset.value) - getState().show, "Board");
      case "actor": {
        const c = getState().contestants.find((x) => x.id === cid);
        if (!c?.actorUuid) return ui.notifications.info(`No actor linked to ${c?.name}. Drag an actor from the sidebar onto the card to link it.`);
        const actor = await fromUuid(c.actorUuid);
        return actor ? actor.sheet.render(true) : ui.notifications.warn("The linked actor no longer exists.");
      }
    }
  }

  #onInput(ev) {
    const range = ev.target.closest("[data-hg-volume]");
    if (!range) return;
    const val = this.root.querySelector(".hg-vol-val");
    if (val) val.textContent = `${range.value}%`;
  }

  async #onVolumeCommit(ev) {
    const range = ev.target.closest("[data-hg-volume]");
    if (!range) return;
    await game.settings.set(MODULE_ID, "sfxVolume", Number(range.value) / 100);
    playSfx("correct", { volume: 0.8 });
  }

  async #onContext(ev) {
    const btn = ev.target.closest("[data-hg='plus'],[data-hg='minus']");
    if (!btn || !isGM()) return;
    ev.preventDefault();
    const cid = btn.closest(".hg-card")?.dataset.cid;
    return adjustContestant(cid, btn.dataset.hg === "plus" ? 1 : -1, "Board", { link: false });
  }

  /* GM: drop an Actor from the sidebar onto a card to link it. */
  #onDragOver(ev) {
    if (!isGM()) return;
    const card = ev.target.closest?.(".hg-card");
    if (!card) return;
    ev.preventDefault();
    card.classList.add("hg-drop");
  }

  async #onDrop(ev) {
    const card = ev.target.closest?.(".hg-card");
    if (!card || !isGM()) return;
    ev.preventDefault();
    card.classList.remove("hg-drop");
    const actor = await actorFromDrop(ev);
    if (!actor) return ui.notifications.warn("Drop an Actor from the Actors sidebar.");
    await linkActor(card.dataset.cid, actor);
  }

  #onDragStart(ev) {
    const bar = ev.target.closest("[data-drag]");
    if (!bar || ev.button !== 0 || ev.target.closest("button, input")) return;
    ev.preventDefault();
    const rect = this.root.getBoundingClientRect();
    const dx = ev.clientX - rect.left;
    const dy = ev.clientY - rect.top;
    this.dragMoved = false;
    this.root.classList.add("hg-dragging");
    const move = (e) => {
      if (!this.dragMoved) {
        for (const d of DOCKS) this.root.classList.remove(`hg-dock-${d}`);
        this.root.classList.add("hg-placed");
      }
      this.dragMoved = true;
      this.root.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dx))}px`;
      this.root.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy))}px`;
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.root.classList.remove("hg-dragging");
      if (this.dragMoved) {
        const r = this.root.getBoundingClientRect();
        await game.settings.set(MODULE_ID, "boardPos", { left: Math.round(r.left), top: Math.round(r.top) });
        await game.settings.set(MODULE_ID, "boardDock", "free");
      }
      setTimeout(() => (this.dragMoved = false), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async resetPosition() {
    await game.settings.set(MODULE_ID, "boardDock", "top-right");
    this.applyPosition();
  }
}

function leaderOf(state) {
  const vis = state.contestants.filter((c) => c.visible);
  if (!vis.length) return null;
  const max = Math.max(...vis.map((c) => c.rating));
  const top = vis.filter((c) => c.rating === max);
  return top.length === 1 ? top[0] : null;
}

/** Resolve an Actor from a drag-and-drop event (sidebar, compendium or token drag data). */
export async function actorFromDrop(ev) {
  let data;
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    data = TE?.getDragEventData ? TE.getDragEventData(ev) : JSON.parse(ev.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
  if (data?.type !== "Actor" || !data.uuid) return null;
  const actor = await fromUuid(data.uuid);
  return actor?.documentName === "Actor" ? actor : null;
}

/** Link an actor to a contestant (stores the UUID; keeps the contestant's name and art). */
export async function linkActor(cid, actor) {
  const list = foundry.utils.deepClone(getState().contestants);
  const c = list.find((x) => x.id === cid);
  if (!c) return;
  c.actorUuid = actor.uuid;
  await updateContestants(list);
  ui.notifications.info(`${actor.name} is now linked to ${c.name}.`);
}
