import { CUES, EPISODES, HOST_NAME, HOST_STICKERS, PERSONAS, QUIPS, RATING_REASONS, SHOW_RESPONSES, moodFor, starring, sticker } from "../constants.js";
import { broadcast } from "../socket.js";
import { FX } from "../fx.js";
import { adjustContestant, adjustShow, getState, resetSeason, setCurrentEpisode, setEpisodesDone, toggleVisible } from "../state.js";
import { awardTrinket, moodGas } from "../rules.js";
import { FX_EXTRA } from "../fx-extra.js";
import { COMMERCIALS, adConfig, adLength, adPool, commercialBreak, previewAds, setAdConfig } from "../commercials.js";
import { esc } from "../util.js";
import { HGApplication } from "./base.js";

const TABS = [
  ["ratings", "fa-solid fa-chart-simple", "Ratings"],
  ["sound", "fa-solid fa-volume-high", "Soundboard"],
  ["stickers", "fa-solid fa-note-sticky", "Stickers"],
  ["broadcast", "fa-solid fa-tower-broadcast", "Broadcast"],
  ["effects", "fa-solid fa-wand-magic-sparkles", "Effects"],
  ["ads", "fa-solid fa-rectangle-ad", "Ads"],
  ["games", "fa-solid fa-dice", "Games"]
];

/** Effects tab: [id, icon, label, hint]. Ids map to socket handlers (see #fxPayload). */
const FX_GROUPS = [
  ["Malfunctions", "Studio systems failing on cue.", [
    ["blackout", "fa-solid fa-power-off", "Blackout", "Lights flicker and die; red emergency beacon; power comes back."],
    ["static", "fa-solid fa-tv", "TV static", "Snow and hiss over the whole screen."],
    ["nosignal", "fa-solid fa-signal", "No signal", "Colour bars and a test tone."],
    ["glitch", "fa-solid fa-display", "The Gap (glitch)", "Short, violent signal glitch with shake."],
    ["desync", "fa-solid fa-wave-square", "Hologram desync", "Tearing bands, a rolling bar and colour fringing on the map."],
    ["sparks", "fa-solid fa-fire-flame-simple", "Short circuit", "Bursts of sparks from the light rig with flashes."],
    ["arcs", "fa-solid fa-bolt-lightning", "Electric arcs", "Lightning crackles across the screen (overloads, nanite fields)."],
    ["buffering", "fa-solid fa-spinner", "Buffering…", "The feed freezes; the spinner stalls at 99%."],
    ["gravity", "fa-solid fa-arrow-down-up-across-line", "Gravity failure", "The whole view tilts and sways."],
    ["crash", "fa-solid fa-bug", "System crash", "Error screen, memory dump, reboot. Celmak cries."],
    ["redalert", "fa-solid fa-bell", "Red alert", "Klaxon, red vignette, rotating beacons, hazard banner."],
    ["lockdown", "fa-solid fa-door-closed", "Lockdown", "Blast doors slam shut, hold, and open again."]
  ]],
  ["Studio", "The show's own lights, signs and cameras.", [
    ["sign-applause", "fa-solid fa-hands-clapping", "АПЛОДИСМЕНТЫ sign", "Neon applause sign with applause."],
    ["sign-silence", "fa-solid fa-volume-xmark", "ТИШИНА sign", "Neon «ТИШИНА В СТУДИИ» sign, no sound."],
    ["sign-custom", "fa-solid fa-sign-hanging", "Custom sign", "Neon sign with your text and colour (below)."],
    ["countdown", "fa-solid fa-hourglass-half", "Countdown", "Big on-screen timer (seconds below), buzzer at zero."],
    ["spotlight", "fa-solid fa-crosshairs", "Spotlight", "Darkness with beams on your selected (or targeted) tokens."],
    ["camera", "fa-solid fa-video", "Camera feed", "Celmak's surveillance camera overlay."],
    ["ticker", "fa-solid fa-newspaper", "Breaking news", "A crawl along the bottom with your text (below)."],
    ["confetti", "fa-solid fa-champagne-glasses", "Confetti", "Confetti cannon."],
    ["shake", "fa-solid fa-house-crack", "Screen shake", "A quick jolt."]
  ]],
  ["Garden & scenes", "Episode set pieces.", [
    ["season-spring", "fa-solid fa-seedling", "Spring", "Petals and pollen (the Garden episode: three Mood Gas bursts)."],
    ["season-summer", "fa-solid fa-sun", "Summer", "Heat lamps, glare and cicadas."],
    ["season-autumn", "fa-solid fa-leaf", "Autumn", "Leaf-blades sweep across the screen."],
    ["season-winter", "fa-solid fa-snowflake", "Winter", "Snow and coolant frost."],
    ["smoke", "fa-solid fa-cloud", "Stage smoke", "Smoke rolls up from the floor."],
    ["warp", "fa-solid fa-rocket", "Drift jump", "Star streaks and a white-out."],
    ["lockpulse", "fa-solid fa-anchor", "Dimensional lock", "Shockwave rings: «ИЗМЕРЕНИЯ ЗАПЕРТЫ»."],
    ["gas22", "fa-solid fa-smog", "Mood Gas vent (DC 22)", "Rolls the d6 table and posts the saves."],
    ["gas25", "fa-solid fa-smog", "Mood release (DC 25)", "As above, DC 25."]
  ]]
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
      announce: (_e, t) => game.modules.get("hollow-garden").api.openAnnounce(t.dataset.kind ?? "custom",
        t.dataset.cid ? ProducerConsole.contestantAnnouncement(t.dataset.cid) : {}),
      cue: ProducerConsole.#onCue,
      sticker: ProducerConsole.#onSticker,
      persona: ProducerConsole.#onPersona,
      pickSticker: ProducerConsole.#onPickSticker,
      randomLine: ProducerConsole.#onRandomLine,
      say: ProducerConsole.#onSay,
      title: ProducerConsole.#onTitle,
      fx: ProducerConsole.#onFx,
      fxStop: () => broadcast("fx-stop", {}),
      adToggle: ProducerConsole.#onAdToggle,
      adAll: ProducerConsole.#onAdAll,
      adPreview: (_e, t) => previewAds([t.dataset.id]),
      adAir: (_e, t) => commercialBreak({ ids: [t.dataset.id], intro: false, outro: false }),
      adBreak: ProducerConsole.#onAdBreak,
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
  fxDraft = { duration: "", signText: "ВСЕ ВСТАЮТ!", signColor: "#2de2e6", seconds: 30, countdownLabel: "", ticker: "", seasonRules: true };

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
          <div class="hg-cname"><strong>${esc(c.name)}</strong><small>${c.actorUuid ? `<i class="fa-solid fa-link"></i> linked` : "not linked"}${c.visible ? "" : " · off stage"}</small></div>
          <div class="hg-cmeter"><div style="width:${c.rating * 10}%"></div></div>
          <button type="button" data-action="fans" data-cid="${esc(c.id)}" data-delta="-1" title="−1 fans">−</button>
          <span class="hg-cval">${c.rating}</span>
          <button type="button" data-action="fans" data-cid="${esc(c.id)}" data-delta="1" title="+1 fans">+</button>
          <button type="button" class="hg-icon" data-action="trinket" data-cid="${esc(c.id)}" title="Award a Trinket"><i class="fa-solid fa-gift"></i></button>
          <button type="button" class="hg-icon" data-action="announce" data-cid="${esc(c.id)}" title="Announce something about ${esc(c.name)}"><i class="fa-solid fa-bullhorn"></i></button>
        </li>`;
    }).join("");
    return `
      <div class="hg-row hg-wrap">
        <button type="button" class="hg-big ${state.visible ? "hg-live-btn" : ""}" data-action="toggleBoard">
          <i class="fa-solid ${state.visible ? "fa-eye-slash" : "fa-satellite-dish"}"></i> ${state.visible ? "Take board off air" : "Show board to players"}</button>
        <button type="button" data-action="contestants"><i class="fa-solid fa-users"></i> Contestants…</button>
        <button type="button" data-action="resetPos"><i class="fa-solid fa-arrows-to-dot"></i> Reset board position</button>
        <button type="button" data-action="resetSeason"><i class="fa-solid fa-rotate-left"></i> Reset season</button>
      </div>
      <section class="hg-showctl hg-show-${state.show}">
        <div class="hg-showctl-num"><button type="button" data-action="show" data-delta="-1">−</button><span>${state.show}</span><button type="button" data-action="show" data-delta="1">+</button></div>
        <div class="hg-showctl-pips">${pips}</div>
        <div class="hg-showctl-resp"><strong>${esc(resp.label)}</strong> ${esc(resp.text)}</div>
      </section>
      <h4>Announcements <small>(players see nothing until you broadcast)</small></h4>
      <div class="hg-row hg-wrap">
        <button type="button" class="hg-big" data-action="announce" data-kind="escalation"><i class="fa-solid fa-triangle-exclamation"></i> Escalation…</button>
        <button type="button" data-action="announce" data-kind="peak"><i class="fa-solid fa-trophy"></i> Ratings peak…</button>
        <button type="button" data-action="announce" data-kind="custom"><i class="fa-solid fa-bullhorn"></i> Custom announcement…</button>
      </div>
      <h4>Raise the ratings <small>(silent: only the board changes)</small></h4><div class="hg-chips">${up}</div>
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
    const eps = EPISODES.map((e) => `<option value="${e.id}" ${state.current === e.id ? "selected" : ""}>${esc(e.title)} · ${esc(e.ru)}</option>`).join("");
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
          <label class="hg-check" title="Play adverts after the break card (choose them on the Ads tab)"><input type="checkbox" data-action="adToggle" data-key="enabled" ${adConfig().enabled ? "checked" : ""}> + commercials</label>
          <button type="button" data-action="title" data-kind="previously"><i class="fa-solid fa-backward"></i> Previously on…</button>
          <button type="button" data-action="title" data-kind="lockfalls"><i class="fa-solid fa-lock-open"></i> The lock falls</button>
          <button type="button" data-action="title" data-kind="finale"><i class="fa-solid fa-trophy"></i> Season finale</button>
        </div>
      </section>`;
  }

  /* ---------------- Effects ---------------- */
  _effects() {
    const d = this.fxDraft;
    const groups = FX_GROUPS.map(([title, hint, items]) => {
      const btns = items.map(([id, icon, label, tip]) =>
        `<button type="button" class="hg-fxbtn" data-action="fx" data-fx="${id}" title="${esc(tip)} (Shift-click: preview only for you)"><i class="${icon}"></i><span>${esc(label)}</span></button>`).join("");
      return `<section class="hg-card-panel"><h4>${esc(title)} <small>${esc(hint)}</small></h4><div class="hg-fxgrid">${btns}</div></section>`;
    }).join("");
    return `
      <p class="hg-hint">Every effect plays for everyone. <kbd>Shift</kbd>-click to preview it only for yourself. Players with <em>Reduce motion</em> get calmer versions.</p>
      <div class="hg-row hg-wrap hg-fxopts">
        <label>Duration <input type="number" name="fx-duration" min="1" max="120" step="1" placeholder="auto" value="${esc(d.duration)}"> s</label>
        <button type="button" class="hg-danger" data-action="fxStop" title="Stop every running effect, looped sound and advert for everyone"><i class="fa-solid fa-ban"></i> Stop all effects</button>
      </div>
      ${groups}
      <section class="hg-card-panel">
        <h4>Options <small>for signs, countdowns, the ticker and seasons</small></h4>
        <div class="hg-row hg-wrap hg-fxopts">
          <label>Sign text <input type="text" name="fx-signText" value="${esc(d.signText)}" maxlength="40"></label>
          <label>Colour <input type="color" name="fx-signColor" value="${esc(d.signColor)}"></label>
          <label>Countdown <input type="number" name="fx-seconds" min="1" max="600" value="${esc(d.seconds)}"> s</label>
          <label>Countdown caption <input type="text" name="fx-countdownLabel" value="${esc(d.countdownLabel)}" placeholder="ДО ЗАКРЫТИЯ ДВЕРЕЙ" maxlength="40"></label>
        </div>
        <div class="hg-row hg-wrap hg-fxopts">
          <label class="hg-grow">Ticker <input type="text" name="fx-ticker" value="${esc(d.ticker)}" placeholder="Сельмак напоминает: никто не уходит раньше финала!" maxlength="200"></label>
          <label class="hg-check"><input type="checkbox" name="fx-seasonRules" ${d.seasonRules ? "checked" : ""}> Seasons show their rules line</label>
        </div>
      </section>`;
  }

  /* ---------------- Ads ---------------- */
  _ads() {
    const cfg = adConfig();
    const pool = new Set(adPool(cfg));
    const cards = COMMERCIALS.map((ad) => `<li class="hg-adcard ${pool.has(ad.id) ? "" : "hg-dim"}" style="--ad-bg:${esc(ad.theme?.bg ?? "#222")};--ad-accent:${esc(ad.theme?.accent ?? "#fff")}">
        <div class="hg-adthumb"><i class="${esc(ad.icon)}"></i></div>
        <div class="hg-adinfo"><strong>${esc(ad.label)}</strong><small>${esc(ad.about)} · ${Math.round(adLength(ad) / 1000)} s</small></div>
        <label class="hg-check" title="Include in the rotation"><input type="checkbox" data-action="adToggle" data-id="${ad.id}" ${pool.has(ad.id) ? "checked" : ""}> in rotation</label>
        <button type="button" class="hg-icon" data-action="adPreview" data-id="${ad.id}" title="Preview (only you)"><i class="fa-solid fa-eye"></i></button>
        <button type="button" class="hg-icon" data-action="adAir" data-id="${ad.id}" title="Air this advert now for everyone"><i class="fa-solid fa-tower-broadcast"></i></button>
      </li>`).join("");
    const per = [1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(cfg.perBreak) === n ? "selected" : ""}>${n}</option>`).join("");
    return `
      <section class="hg-card-panel">
        <h4>Commercial break</h4>
        <div class="hg-row hg-wrap">
          <button type="button" class="hg-big" data-action="adBreak"><i class="fa-solid fa-mug-hot"></i> Commercial break</button>
          <label class="hg-check"><input type="checkbox" name="hg-intermission" checked> Intermission: −1 rating</label>
        </div>
        <div class="hg-row hg-wrap hg-fxopts">
          <label class="hg-check"><input type="checkbox" data-action="adToggle" data-key="enabled" ${cfg.enabled ? "checked" : ""}> Play commercials after the break card</label>
          <label>Per break <select name="ad-perBreak">${per}</select></label>
          <label>Order <select name="ad-order">
            <option value="random" ${cfg.order !== "sequence" ? "selected" : ""}>Random (no repeats)</option>
            <option value="sequence" ${cfg.order === "sequence" ? "selected" : ""}>In turn</option></select></label>
          <label class="hg-check"><input type="checkbox" data-action="adToggle" data-key="outro" ${cfg.outro ? "checked" : ""}> «Мы снова в эфире!» card</label>
        </div>
        <p class="hg-hint">The break card plays first, then ${cfg.enabled ? `<strong>${Math.min(Number(cfg.perBreak) || 0, pool.size)}</strong> advert(s) from the ${pool.size} in rotation` : "<strong>no adverts</strong> (commercials are off)"}. During the break you get <em>Skip</em> and <em>End break</em> buttons in the corner of the screen.</p>
      </section>
      <div class="hg-row hg-wrap"><h4 class="hg-grow">Adverts</h4>
        <button type="button" data-action="adAll" data-on="1"><i class="fa-solid fa-square-check"></i> All</button>
        <button type="button" data-action="adAll" data-on="0"><i class="fa-regular fa-square"></i> None</button></div>
      <ul class="hg-adlist">${cards}</ul>`;
  }

  /* ---------------- Games ---------------- */
  _games(state) {
    const rows = EPISODES.map((e, i) => {
      const st = state.episodes.find((x) => x.id === e.id);
      return `<li class="${st?.done ? "hg-done" : ""} ${state.current === e.id ? "hg-current" : ""}">
          <span class="hg-epnum">${i + 1}</span>
          <div><strong>${esc(e.title)}</strong><small>${esc(e.ru)} · ${esc(starring(e, state.contestants))}</small></div>
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
    for (const input of this.element.querySelectorAll("[name^='fx-']")) {
      const key = input.name.slice(3);
      input.addEventListener("change", () => (this.fxDraft[key] = input.type === "checkbox" ? input.checked : input.value));
      if (input.type !== "checkbox") input.addEventListener("input", () => (this.fxDraft[key] = input.value));
    }
    this.element.querySelector("select[name='ad-perBreak']")?.addEventListener("change", (ev) => setAdConfig({ perBreak: Number(ev.target.value) }));
    this.element.querySelector("select[name='ad-order']")?.addEventListener("change", (ev) => setAdConfig({ order: ev.target.value }));
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

  static #onRandomLine() {
    const lines = QUIPS[this.draft.persona] ?? QUIPS.Host;
    const pool = lines.filter((l) => l !== this.draft.text);
    this.draft.text = pool[Math.floor(Math.random() * pool.length)] ?? lines[0];
    this.render();
  }

  /** Pre-filled custom announcement about one contestant. */
  static contestantAnnouncement(cid) {
    const c = getState().contestants.find((x) => x.id === cid);
    if (!c) return {};
    const art = c.art?.[moodFor(c.rating)];
    return { kicker: "РЕЙТИНГИ", title: c.name.toUpperCase(), subtitle: c.rating >= 7 ? "Зрители в восторге!" : c.rating <= 3 ? "Зрители недовольны…" : "Зрители следят за каждым шагом.",
      theme: c.rating <= 3 ? "alarm" : "episode", sticker: c.rating >= 7 ? "heart-eyes" : c.rating <= 3 ? "bored" : "ratings", sound: "on-air", art };
  }

  static #onSay() {
    const text = (this.element.querySelector("textarea[name='hg-say']")?.value ?? "").trim();
    if (!text) return ui.notifications.info("Type something for Celmak to say, or draw a random line.");
    const p = PERSONAS[this.draft.persona] ?? PERSONAS.Host;
    const st = this.draft.sticker && p.stickers.includes(this.draft.sticker) ? this.draft.sticker : p.stickers[0];
    broadcast("caption", { persona: this.draft.persona, text, sticker: st });
    ChatMessage.create({ speaker: { alias: `${HOST_NAME} (${p.tag.toLowerCase()})` }, content: `<div class="hg-chat-quote" style="--persona:${p.color}">${esc(text)}</div>` });
  }

  static async #onTitle(_e, t) {
    const kind = t.dataset.kind;
    if (kind === "episode") {
      const id = this.element.querySelector("select[name='hg-ep']")?.value;
      return game.modules.get("hollow-garden").api.episodeTitle(id);
    }
    if (kind === "intermission") return ProducerConsole.#onAdBreak.call(this);
    broadcast("title", { kind });
  }

  /** Commercial break: the break card, then adverts if they are switched on. */
  static async #onAdBreak() {
    const cost = this.element.querySelector("input[name='hg-intermission']")?.checked;
    await commercialBreak({ intro: true });
    if (cost) await adjustShow(-1, "Intermission");
  }

  static async #onAdToggle(_e, t) {
    if (t.dataset.key) return setAdConfig({ [t.dataset.key]: t.checked });
    const off = new Set(adConfig().off ?? []);
    if (t.checked) off.delete(t.dataset.id);
    else off.add(t.dataset.id);
    return setAdConfig({ off: [...off] });
  }

  static #onAdAll(_e, t) {
    return setAdConfig({ off: t.dataset.on === "1" ? [] : COMMERCIALS.map((a) => a.id) });
  }

  /** Build the socket message for an Effects-tab button. */
  #fxPayload(id) {
    const d = this.fxDraft;
    const duration = Number(d.duration) || undefined;
    if (id.startsWith("season-")) return ["season", { kind: id.slice(7), duration, showRules: !!d.seasonRules }];
    switch (id) {
      case "sign-applause": return ["sign", { text: "АПЛОДИСМЕНТЫ", color: "#ff3cac", sound: "applause", duration }];
      case "sign-silence": return ["sign", { text: "ТИШИНА В СТУДИИ", color: "#2de2e6", sound: null, duration }];
      case "sign-custom": return ["sign", { text: (d.signText || "ВНИМАНИЕ").toUpperCase(), color: d.signColor || "#2de2e6", sound: null, duration }];
      case "countdown": return ["countdown", { seconds: Number(d.seconds) || 30, label: d.countdownLabel || "" }];
      case "ticker": return ["ticker", { text: d.ticker || "", duration }];
      case "confetti": return ["confetti", { sound: "confetti" }];
      case "shake": return ["shake", { sound: "rimshot", strength: 2 }];
      case "glitch": return ["glitch", { duration: duration ? duration * 1000 : undefined }];
      case "spotlight": {
        const toks = canvas?.tokens?.controlled?.length ? canvas.tokens.controlled : [...(game.user.targets ?? [])];
        const points = toks.map((tk) => ({ x: tk.center.x, y: tk.center.y, r: Math.max(tk.w, tk.h) * 0.75 }));
        if (!points.length) ui.notifications.info("No tokens selected or targeted: the spotlight finds the middle of the screen.");
        return ["spotlight", { points, duration }];
      }
      default: return [id, { duration }];
    }
  }

  static #onFx(e, t) {
    const id = t.dataset.fx;
    if (id === "gas22" || id === "gas25") return moodGas({ dc: id === "gas22" ? 22 : 25 });
    const [type, data] = this.#fxPayload(id);
    if (e.shiftKey) {
      const fn = FX_EXTRA[type] ?? FX[type];
      return fn?.(data);
    }
    broadcast(type, data);
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
