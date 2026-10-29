import { CUES, EPISODES, HOST_STICKERS, PERSONAS, RATING_REASONS, SHOW_RESPONSES, TABLES, moodFor, sticker } from "../constants.js";
import { broadcast } from "../socket.js";
import { FX } from "../fx.js";
import { adjustContestant, adjustShow, getState, resetSeason, setCurrentEpisode, setEpisodesDone, toggleVisible } from "../state.js";
import { awardTrinket, moodGas } from "../rules.js";
import { drawTable, esc, resultText } from "../util.js";
import { HGApplication } from "./base.js";

const TABS = [
  ["ratings", "fa-solid fa-chart-simple", "Ratings"],
  ["sound", "fa-solid fa-volume-high", "Soundboard"],
  ["stickers", "fa-solid fa-note-sticky", "Stickers"],
  ["broadcast", "fa-solid fa-tower-broadcast", "Broadcast"],
  ["games", "fa-solid fa-dice", "Games"]
];

export class ProducerConsole extends HGApplication {
  static #instance;

  static get instance() {
    return (this.#instance ??= new ProducerConsole());
  }

  static DEFAULT_OPTIONS = {
    id: "hg-console",
    classes: ["hg-app", "hg-console"],
    window: { title: "The Hollow Garden · Producer Console", icon: "fa-solid fa-tower-broadcast", resizable: true },
    position: { width: 800, height: 680 },
    actions: {
      hgTab: ProducerConsole.#onTab,
      toggleBoard: () => toggleVisible(),
      contestants: () => game.modules.get("hollow-garden").api.openContestants(),
      resetPos: () => game.modules.get("hollow-garden").api.resetBoardPosition(),
      resetSeason: ProducerConsole.#onResetSeason,
      show: ProducerConsole.#onShow,
      reason: ProducerConsole.#onReason,
      fans: ProducerConsole.#onFans,
      trinket: (_e, t) => awardTrinket(t.dataset.cid),
      cue: ProducerConsole.#onCue,
      sticker: ProducerConsole.#onSticker,
      persona: ProducerConsole.#onPersona,
      pickSticker: ProducerConsole.#onPickSticker,
      randomLine: ProducerConsole.#onRandomLine,
      say: ProducerConsole.#onSay,
      title: ProducerConsole.#onTitle,
      effect: ProducerConsole.#onEffect,
      roulette: () => game.modules.get("hollow-garden").api.openRoulette(),
      vote: () => game.modules.get("hollow-garden").api.openVote(),
      honeypot: () => game.modules.get("hollow-garden").api.openHoneypot(),
      epDone: ProducerConsole.#onEpDone,
      epCurrent: ProducerConsole.#onEpCurrent,
      epOpen: ProducerConsole.#onEpOpen,
      epTitle: (_e, t) => game.modules.get("hollow-garden").api.episodeTitle(t.dataset.id)
    }
  };

  tab = "ratings";
  draft = { persona: "Host", sticker: null, text: "" };

  setTab(tab) {
    if (tab && TABS.some(([id]) => id === tab)) this.tab = tab;
  }

  async _prepareContext() {
    return { state: getState() };
  }

  _body({ state }) {
    const nav = TABS.map(([id, icon, label]) =>
      `<button type="button" class="hg-tab ${this.tab === id ? "active" : ""}" data-action="hgTab" data-tab="${id}"><i class="${icon}"></i><span>${label}</span></button>`).join("");
    return `<nav class="hg-tabs">${nav}</nav><div class="hg-tab-body">${this[`_${this.tab}`](state)}</div>`;
  }

  /* ---------------- Ratings ---------------- */
  _ratings(state) {
    const resp = SHOW_RESPONSES[state.show];
    const pips = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="hg-pip ${n <= state.show ? "on" : ""} hg-pip-${n}" data-action="show" data-set="${n}" title="Set to ${n}"></button>`).join("");
    const up = RATING_REASONS.up.map((r) => `<button type="button" class="hg-chip hg-up" data-action="reason" data-delta="1" data-reason="${esc(r)}">+1 ${esc(r)}</button>`).join("");
    const down = RATING_REASONS.down.map((r) => `<button type="button" class="hg-chip hg-down" data-action="reason" data-delta="-1" data-reason="${esc(r)}">−1 ${esc(r)}</button>`).join("");
    const rows = state.contestants.map((c) => {
      const mood = moodFor(c.rating);
      return `<li class="hg-crow ${c.visible ? "" : "hg-dim"}">
          <img src="${esc(c.art?.[mood] ?? "")}" alt="">
          <div class="hg-cname"><strong>${esc(c.name)}</strong><small>${esc(c.role ?? "")}${c.visible ? "" : " · off stage"}</small></div>
          <div class="hg-cmeter"><div style="width:${c.rating * 10}%"></div></div>
          <button type="button" data-action="fans" data-cid="${esc(c.id)}" data-delta="-1" title="−1 fans">−</button>
          <span class="hg-cval">${c.rating}</span>
          <button type="button" data-action="fans" data-cid="${esc(c.id)}" data-delta="1" title="+1 fans">+</button>
          <button type="button" class="hg-icon" data-action="trinket" data-cid="${esc(c.id)}" title="Award a Trinket"><i class="fa-solid fa-gift"></i></button>
        </li>`;
    }).join("");
    return `
      <div class="hg-row hg-wrap">
        <button type="button" class="hg-big ${state.visible ? "hg-live-btn" : ""}" data-action="toggleBoard">
          <i class="fa-solid ${state.visible ? "fa-eye-slash" : "fa-satellite-dish"}"></i> ${state.visible ? "Take board off air" : "Show board to players"}</button>
        <button type="button" data-action="contestants"><i class="fa-solid fa-users"></i> Contestants…</button>
        <button type="button" data-action="resetPos"><i class="fa-solid fa-arrows-to-dot"></i> Re-centre board</button>
        <button type="button" data-action="resetSeason"><i class="fa-solid fa-rotate-left"></i> Reset season</button>
      </div>
      <section class="hg-showctl hg-show-${state.show}">
        <div class="hg-showctl-num"><button type="button" data-action="show" data-delta="-1">−</button><span>${state.show}</span><button type="button" data-action="show" data-delta="1">+</button></div>
        <div class="hg-showctl-pips">${pips}</div>
        <div class="hg-showctl-resp"><strong>${esc(resp.label)}</strong> ${esc(resp.text)}</div>
      </section>
      <h4>Raise the ratings</h4><div class="hg-chips">${up}</div>
      <h4>Lower the ratings</h4><div class="hg-chips">${down}</div>
      <h4>Fan meters <small>(linked fans also move the Show Rating; change this in module settings)</small></h4>
      <ul class="hg-clist">${rows}</ul>`;
  }

  /* ---------------- Soundboard ---------------- */
  _sound() {
    const cues = CUES.map((c) => `<button type="button" class="hg-cue" data-action="cue" data-cue="${c.id}" title="${esc(c.label)} (shift-click: preview only for you)">
        <img src="${sticker(c.sticker)}" alt=""><span>${esc(c.label)}</span></button>`).join("");
    return `<p class="hg-hint">Every cue plays for everyone and pops up a sticker. <kbd>Shift</kbd>-click to preview it only for yourself.</p><div class="hg-cues">${cues}</div>`;
  }

  /* ---------------- Stickers ---------------- */
  _stickers() {
    const all = HOST_STICKERS.map((s) => `<button type="button" class="hg-stk" data-action="sticker" data-sticker="${s}" title="${s} (shift-click: preview)"><img src="${sticker(s)}" alt="${s}"></button>`).join("");
    return `<p class="hg-hint">Pop a sticker of the host on everyone's screen, silently. <kbd>Shift</kbd>-click to preview.</p><div class="hg-stks">${all}</div>`;
  }

  /* ---------------- Broadcast ---------------- */
  _broadcast(state) {
    const p = PERSONAS[this.draft.persona] ?? PERSONAS.Host;
    const sel = this.draft.sticker && p.stickers.includes(this.draft.sticker) ? this.draft.sticker : p.stickers[0];
    const personas = Object.entries(PERSONAS).map(([k, v]) =>
      `<button type="button" class="hg-persona ${k === this.draft.persona ? "active" : ""}" style="--persona:${v.color}" data-action="persona" data-persona="${k}">
        <img src="${sticker(v.stickers[0])}" alt=""><span>${v.label}</span></button>`).join("");
    const pstick = p.stickers.map((s) => `<button type="button" class="hg-stk small ${s === sel ? "active" : ""}" data-action="pickSticker" data-sticker="${s}"><img src="${sticker(s)}" alt="${s}"></button>`).join("");
    const eps = EPISODES.map((e) => `<option value="${e.id}" ${state.current === e.id ? "selected" : ""}>${esc(e.title)} · ${esc(e.spotlight)}</option>`).join("");
    return `
      <section class="hg-card-panel">
        <h4>Celmak says…</h4>
        <div class="hg-personas">${personas}</div>
        <div class="hg-row">${pstick}</div>
        <textarea name="hg-say" rows="3" placeholder="Contestants, the doors are open and the stakes are personal!">${esc(this.draft.text)}</textarea>
        <div class="hg-row">
          <button type="button" data-action="randomLine"><i class="fa-solid fa-shuffle"></i> Random line</button>
          <button type="button" class="hg-big" data-action="say"><i class="fa-solid fa-microphone-lines"></i> Broadcast</button>
        </div>
      </section>
      <section class="hg-card-panel">
        <h4>Title cards</h4>
        <div class="hg-row hg-wrap">
          <select name="hg-ep">${eps}</select>
          <button type="button" data-action="title" data-kind="episode"><i class="fa-solid fa-clapperboard"></i> Episode opener</button>
        </div>
        <div class="hg-row hg-wrap">
          <button type="button" data-action="title" data-kind="intermission"><i class="fa-solid fa-mug-hot"></i> Commercial break</button>
          <label class="hg-check"><input type="checkbox" name="hg-intermission" checked> Intermission: −1 rating</label>
          <button type="button" data-action="title" data-kind="previously"><i class="fa-solid fa-backward"></i> Previously on…</button>
          <button type="button" data-action="title" data-kind="lockfalls"><i class="fa-solid fa-lock-open"></i> The lock falls</button>
          <button type="button" data-action="title" data-kind="finale"><i class="fa-solid fa-trophy"></i> Season finale</button>
        </div>
      </section>
      <section class="hg-card-panel">
        <h4>Effects</h4>
        <div class="hg-row hg-wrap">
          <button type="button" data-action="effect" data-fx="confetti"><i class="fa-solid fa-champagne-glasses"></i> Confetti</button>
          <button type="button" data-action="effect" data-fx="glitch"><i class="fa-solid fa-tv"></i> The Gap (glitch)</button>
          <button type="button" data-action="effect" data-fx="shake"><i class="fa-solid fa-house-crack"></i> Screen shake</button>
          <button type="button" data-action="effect" data-fx="gas22"><i class="fa-solid fa-smog"></i> Mood Gas vent (DC 22)</button>
          <button type="button" data-action="effect" data-fx="gas25"><i class="fa-solid fa-smog"></i> Mood release (DC 25)</button>
        </div>
      </section>`;
  }

  /* ---------------- Games ---------------- */
  _games(state) {
    const rows = EPISODES.map((e, i) => {
      const st = state.episodes.find((x) => x.id === e.id);
      return `<li class="${st?.done ? "hg-done" : ""} ${state.current === e.id ? "hg-current" : ""}">
          <span class="hg-epnum">${i + 1}</span>
          <div><strong>${esc(e.title)}</strong><small>${esc(e.spotlight)}</small></div>
          <label class="hg-check" title="Already aired"><input type="checkbox" data-action="epDone" data-id="${e.id}" ${st?.done ? "checked" : ""}> aired</label>
          <button type="button" class="hg-icon" data-action="epCurrent" data-id="${e.id}" title="Mark as now showing"><i class="fa-solid fa-tv"></i></button>
          <button type="button" class="hg-icon" data-action="epTitle" data-id="${e.id}" title="Roll the title card"><i class="fa-solid fa-clapperboard"></i></button>
          <button type="button" class="hg-icon" data-action="epOpen" data-id="${e.id}" title="Open the journal page"><i class="fa-solid fa-book-open"></i></button>
        </li>`;
    }).join("");
    return `
      <div class="hg-games">
        <button type="button" class="hg-game" data-action="roulette"><img src="${sticker("presenting")}" alt=""><strong>Spin the Episode Wheel</strong><small>Random for them, rigged for you.</small></button>
        <button type="button" class="hg-game" data-action="vote"><img src="${sticker("countdown")}" alt=""><strong>Audience Vote</strong><small>Audience votes are final.</small></button>
        <button type="button" class="hg-game" data-action="honeypot"><img src="${sticker("thinking")}" alt=""><strong>Honeypot Check</strong><small>Knowledge (engineering) bands.</small></button>
      </div>
      <h4>Celmak's schedule</h4>
      <ol class="hg-eplist">${rows}</ol>`;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const ta = this.element.querySelector("textarea[name='hg-say']");
    ta?.addEventListener("input", () => (this.draft.text = ta.value));
  }

  /* ---------------- Handlers ---------------- */
  static #onTab(_e, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static async #onResetSeason() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Reset the season?" },
      content: "<p>All fan meters go back to 5, the Show Rating to 3, and every episode is marked as not yet aired. The cast and linked actors are kept.</p>"
    });
    if (ok) await resetSeason();
  }

  static #onShow(_e, t) {
    if (t.dataset.set) return adjustShow(Number(t.dataset.set) - getState().show, "Console");
    return adjustShow(Number(t.dataset.delta), "Console");
  }

  static #onReason(_e, t) {
    return adjustShow(Number(t.dataset.delta), t.dataset.reason);
  }

  static #onFans(_e, t) {
    return adjustContestant(t.dataset.cid, Number(t.dataset.delta), "Console");
  }

  static #onCue(e, t) {
    if (e.shiftKey) return FX.cue({ id: t.dataset.cue });
    broadcast("cue", { id: t.dataset.cue });
  }

  static #onSticker(e, t) {
    if (e.shiftKey) return FX.sticker({ sticker: t.dataset.sticker });
    broadcast("sticker", { sticker: t.dataset.sticker });
  }

  static #onPersona(_e, t) {
    this.draft.persona = t.dataset.persona;
    this.draft.sticker = null;
    this.render();
  }

  static #onPickSticker(_e, t) {
    this.draft.sticker = t.dataset.sticker;
    this.render();
  }

  static async #onRandomLine() {
    const uuid = TABLES[`quips-${this.draft.persona.toLowerCase()}`];
    const drawn = uuid ? await drawTable(uuid) : null;
    const text = resultText(drawn?.results?.[0]).replace(/<[^>]+>/g, "");
    if (text) {
      this.draft.text = text;
      this.render();
    }
  }

  static #onSay() {
    const text = (this.element.querySelector("textarea[name='hg-say']")?.value ?? "").trim();
    if (!text) return ui.notifications.info("Type something for Celmak to say, or draw a random line.");
    const p = PERSONAS[this.draft.persona] ?? PERSONAS.Host;
    const st = this.draft.sticker && p.stickers.includes(this.draft.sticker) ? this.draft.sticker : p.stickers[0];
    broadcast("caption", { persona: this.draft.persona, text, sticker: st });
    ChatMessage.create({ speaker: { alias: `Celmak (${p.label})` }, content: `<div class="hg-chat-quote" style="--persona:${p.color}">${esc(text)}</div>` });
  }

  static async #onTitle(_e, t) {
    const kind = t.dataset.kind;
    if (kind === "episode") {
      const id = this.element.querySelector("select[name='hg-ep']")?.value;
      return game.modules.get("hollow-garden").api.episodeTitle(id);
    }
    broadcast("title", { kind });
    if (kind === "intermission" && this.element.querySelector("input[name='hg-intermission']")?.checked) {
      await adjustShow(-1, "Intermission");
    }
  }

  static #onEffect(_e, t) {
    const fx = t.dataset.fx;
    if (fx === "confetti") broadcast("confetti", { sound: "confetti" });
    else if (fx === "glitch") broadcast("glitch", {});
    else if (fx === "shake") broadcast("shake", { sound: "rimshot" });
    else if (fx === "gas22") moodGas({ dc: 22 });
    else if (fx === "gas25") moodGas({ dc: 25 });
  }

  static #onEpDone(_e, t) {
    return setEpisodesDone({ [t.dataset.id]: t.checked });
  }

  static #onEpCurrent(_e, t) {
    return setCurrentEpisode(t.dataset.id);
  }

  static async #onEpOpen(_e, t) {
    const ep = EPISODES.find((x) => x.id === t.dataset.id);
    const page = ep ? await fromUuid(ep.page) : null;
    if (!page) return ui.notifications.warn("Journal page not found.");
    page.parent.sheet.render(true, { pageId: page.id, anchor: ep.anchor ?? undefined });
  }
}
