import { EPISODES, MODULE_ID, RATING_MAX, SHOW_RESPONSES, moodFor } from "./constants.js";
import { adjustContestant, adjustShow, getState, leader, toggleVisible } from "./state.js";
import { floatText } from "./fx.js";
import { esc, isGM, setting } from "./util.js";

/**
 * The on-screen ratings board ("the scoreboard"). A frameless HUD element that every client renders
 * from the shared world state. Only the GM can change values; everyone can collapse it locally.
 */
export class RatingsBoard {
  static #instance;

  static get instance() {
    return (this.#instance ??= new RatingsBoard());
  }

  constructor() {
    this.prev = null;
    this.root = null;
  }

  mount() {
    if (this.root?.isConnected) return;
    this.root = document.createElement("section");
    this.root.id = "hg-board";
    this.root.setAttribute("aria-label", "The Hollow Garden ratings board");
    document.body.appendChild(this.root);
    this.root.addEventListener("click", (ev) => this.#onClick(ev));
    this.root.addEventListener("contextmenu", (ev) => this.#onContext(ev));
    this.root.addEventListener("pointerdown", (ev) => this.#onDragStart(ev));
    this.#applyPosition();
    this.render(getState(), { initial: true });
  }

  #applyPosition() {
    const pos = setting("boardPos");
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      const maxL = Math.max(0, window.innerWidth - 120);
      const maxT = Math.max(0, window.innerHeight - 60);
      this.root.style.left = `${Math.min(Math.max(0, pos.left), maxL)}px`;
      this.root.style.top = `${Math.min(Math.max(0, pos.top), maxT)}px`;
      this.root.classList.add("hg-placed");
    } else {
      this.root.style.left = "";
      this.root.style.top = "";
      this.root.classList.remove("hg-placed");
    }
  }

  render(state, { initial = false } = {}) {
    if (!this.root) return;
    const gm = isGM();
    const compact = !!setting("boardCompact");
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

    const lead = leader(state);
    const ep = EPISODES.find((e) => e.id === state.current);
    const resp = SHOW_RESPONSES[state.show];
    const pips = [1, 2, 3, 4, 5]
      .map((n) => `<span class="hg-pip ${n <= state.show ? "on" : ""} hg-pip-${n}" ${gm ? `data-hg="setshow" data-value="${n}"` : ""}></span>`)
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
        return `<article class="${classes.join(" ")}" data-cid="${esc(c.id)}">
            ${lead?.id === c.id ? `<div class="hg-crown"><i class="fa-solid fa-crown"></i> FAN FAVOURITE</div>` : ""}
            ${c.rating <= 2 ? `<div class="hg-danger-tag">DANGER ZONE</div>` : ""}
            <div class="hg-portrait"><img src="${esc(img)}" alt="${esc(c.name)}" draggable="false"></div>
            <div class="hg-nameplate"><span class="hg-name">${esc(c.name)}</span><span class="hg-role">${esc(c.role ?? "")}</span></div>
            <div class="hg-meter" role="meter" aria-valuemin="0" aria-valuemax="${RATING_MAX}" aria-valuenow="${c.rating}" aria-label="Fans for ${esc(c.name)}">
              <div class="hg-meter-fill" style="width:${pct}%"></div>
              <div class="hg-meter-ticks"></div>
              <span class="hg-meter-value">${c.rating}</span>
            </div>
            ${gm ? `<div class="hg-gm-ctl">
                <button type="button" data-hg="minus" title="−1 fans (right-click: −1 without moving the Show Rating)">−</button>
                <button type="button" data-hg="plus" title="+1 fans (right-click: +1 without moving the Show Rating)">+</button>
              </div>` : ""}
          </article>`;
      })
      .join("");

    this.root.innerHTML = `
      <header class="hg-bar" data-drag>
        <span class="hg-live"><span class="hg-dot"></span>LIVE</span>
        <span class="hg-brand">THE HOLLOW GARDEN<small>Season of Horrors</small></span>
        ${ep ? `<span class="hg-now">NOW SHOWING · <strong>${esc(ep.title)}</strong></span>` : ""}
        <span class="hg-tools">
          ${gm ? `<button type="button" data-hg="console" title="Producer Console"><i class="fa-solid fa-tower-broadcast"></i></button>
                  <button type="button" data-hg="hide" title="Take the board off air"><i class="fa-solid fa-eye-slash"></i></button>` : ""}
          <button type="button" data-hg="compact" title="${compact ? "Expand" : "Collapse"}"><i class="fa-solid ${compact ? "fa-up-right-and-down-left-from-center" : "fa-down-left-and-up-right-to-center"}"></i></button>
        </span>
      </header>
      <div class="hg-show hg-show-${state.show}">
        <div class="hg-show-label">SHOW RATING</div>
        <div class="hg-pips">${pips}</div>
        <div class="hg-show-value">${state.show}<small>/5</small></div>
        ${gm ? `<div class="hg-show-ctl"><button type="button" data-hg="showminus">−</button><button type="button" data-hg="showplus">+</button></div>` : ""}
        <div class="hg-show-resp" title="${esc(resp.text)}"><strong>${esc(resp.label)}</strong>${gm ? ` · ${esc(resp.text)}` : ""}</div>
      </div>
      <div class="hg-cards">${cards || `<div class="hg-empty">No contestants on stage.</div>`}</div>`;

    if (!initial) this.#animateDiff(state);
    this.prev = this.#snapshot(state);
  }

  #snapshot(state) {
    return { show: state.show, ratings: Object.fromEntries(state.contestants.map((c) => [c.id, c.rating])) };
  }

  #animateDiff(state) {
    if (!this.prev) return;
    for (const c of state.contestants) {
      const before = this.prev.ratings[c.id];
      if (before == null || before === c.rating) continue;
      const card = this.root.querySelector(`.hg-card[data-cid="${CSS.escape(c.id)}"]`);
      if (!card) continue;
      const up = c.rating > before;
      card.classList.add(up ? "hg-bump-up" : "hg-bump-down");
      if (moodFor(before) !== moodFor(c.rating)) card.classList.add("hg-mood-swap");
      floatText(card.querySelector(".hg-meter") ?? card, `${up ? "+" : ""}${c.rating - before}`, up ? "hg-up" : "hg-down");
    }
    if (this.prev.show !== state.show) {
      const show = this.root.querySelector(".hg-show");
      show?.classList.add(state.show > this.prev.show ? "hg-bump-up" : "hg-bump-down");
    }
  }

  async #onClick(ev) {
    const btn = ev.target.closest("[data-hg]");
    if (!btn || this.dragMoved) return;
    const act = btn.dataset.hg;
    const cid = btn.closest(".hg-card")?.dataset.cid;
    const api = game.modules.get(MODULE_ID)?.api;
    switch (act) {
      case "compact":
        await game.settings.set(MODULE_ID, "boardCompact", !setting("boardCompact"));
        return this.render(getState(), { initial: true });
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
    }
  }

  async #onContext(ev) {
    const btn = ev.target.closest("[data-hg='plus'],[data-hg='minus']");
    if (!btn || !isGM()) return;
    ev.preventDefault();
    const cid = btn.closest(".hg-card")?.dataset.cid;
    return adjustContestant(cid, btn.dataset.hg === "plus" ? 1 : -1, "Board", { link: false });
  }

  #onDragStart(ev) {
    const bar = ev.target.closest("[data-drag]");
    if (!bar || ev.button !== 0 || ev.target.closest("button")) return;
    ev.preventDefault();
    const rect = this.root.getBoundingClientRect();
    const dx = ev.clientX - rect.left;
    const dy = ev.clientY - rect.top;
    this.dragMoved = false;
    this.root.classList.add("hg-dragging");
    const move = (e) => {
      this.dragMoved = true;
      this.root.classList.add("hg-placed");
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
      }
      setTimeout(() => (this.dragMoved = false), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async resetPosition() {
    await game.settings.set(MODULE_ID, "boardPos", {});
    this.#applyPosition();
  }
}
