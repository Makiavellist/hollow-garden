import { CUES, HOST_STICKERS, SHOW_RESPONSES, sticker } from "../constants.js";
import { broadcast } from "../socket.js";
import { getState, setShow, topContestants } from "../state.js";
import { ESCALATIONS, awardTrinket, runEscalation } from "../rules.js";
import { chatCard, esc } from "../util.js";
import { HGApplication } from "./base.js";

/** Pre-filled (Russian) announcements; the GM edits them before anything reaches the players. */
function presets(state) {
  const top = topContestants(state);
  const fav = top.length === 1 ? top[0].name : "";
  return {
    peak: { theme: "peak", kicker: "РЕЙТИНГИ", title: "ПИК РЕЙТИНГА!", subtitle: fav ? `Приз получает ${fav}!` : "Приз получает любимец публики!",
      sticker: "ratings", sound: "cheer", confetti: true, shake: false, reset: 3, trinket: true },
    escalation: { theme: "alarm", kicker: "РЕЙТИНГИ", title: "ЭСКАЛАЦИЯ!", subtitle: "Зрителям скучно. Сельмак — нет.",
      sticker: "angry", sound: "alarm", confetti: false, shake: true, reset: 2, trinket: false, response: "none" },
    custom: { theme: "episode", kicker: "РЕЙТИНГИ", title: "", subtitle: "", sticker: "ratings", sound: "on-air", confetti: false, shake: false,
      reset: 0, trinket: false }
  };
}

const THEMES = { episode: "Studio (violet)", peak: "Celebration (spinning rays)", alarm: "Alarm (red stripes)", break: "Calm (teal)", vhs: "VHS replay", finale: "Gold finale" };
const SOUNDS = ["", "cheer", "applause", "fanfare", "alarm", "suspense", "on-air", "drumroll", "rating-up", "rating-down", "sad-trombone", "boo", "crowd-ooh", "crowd-aww", "airhorn"];

/**
 * GM approval desk for ratings announcements. Nothing is shown to players until the GM presses Broadcast.
 */
export class AnnounceDesk extends HGApplication {
  static DEFAULT_OPTIONS = {
    id: "hg-announce",
    classes: ["hg-app", "hg-announce"],
    window: { title: "Ratings Announcement", icon: "fa-solid fa-bullhorn", resizable: true },
    position: { width: 560 },
    actions: { go: AnnounceDesk.#onGo, kind: AnnounceDesk.#onKind, cancel: function () { this.close(); } }
  };

  kind = "custom";
  draft = null;

  setKind(kind, extra = {}) {
    this.kind = ["peak", "escalation", "custom"].includes(kind) ? kind : "custom";
    this.draft = { ...presets(getState())[this.kind], ...extra };
  }

  async _prepareContext() {
    if (!this.draft) this.setKind(this.kind);
    return { state: getState(), d: this.draft };
  }

  _body({ state, d }) {
    const tabs = [["peak", "Ratings peak (5)"], ["escalation", "Escalation (1)"], ["custom", "Custom"]]
      .map(([k, l]) => `<button type="button" class="hg-chip ${this.kind === k ? "hg-up" : ""}" data-action="kind" data-kind="${k}">${l}</button>`).join("");
    const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
    const stickers = HOST_STICKERS.map((s) => [s, s]);
    const people = state.contestants.map((c) => [c.id, c.name]);
    const top = topContestants(state)[0]?.id ?? "";
    const esc_ = Object.entries(ESCALATIONS).map(([k, v]) => [k, v.label]);
    const resp = SHOW_RESPONSES[this.kind === "peak" ? 5 : this.kind === "escalation" ? 1 : state.show];
    return `<p class="hg-hint">Nothing reaches the players until you press <strong>Broadcast</strong>. Current Show Rating: <strong>${state.show}</strong>. ${esc(resp.text)}</p>
      <div class="hg-chips">${tabs}</div>
      <div class="hg-form-grid">
        <label>Small line (kicker)<input type="text" name="kicker" value="${esc(d.kicker)}"></label>
        <label>Style<select name="theme">${opt(Object.entries(THEMES), d.theme)}</select></label>
        <label class="hg-span2">Headline<input type="text" name="title" value="${esc(d.title)}" placeholder="ВНИМАНИЕ!"></label>
        <label class="hg-span2">Text<input type="text" name="subtitle" value="${esc(d.subtitle)}"></label>
        <label>Sticker<select name="sticker"><option value="">— none —</option>${opt(stickers, d.sticker)}</select></label>
        <label>Sound<select name="sound">${opt(SOUNDS.map((s) => [s, s || "— none —"]), d.sound)}</select></label>
        <label class="hg-check"><input type="checkbox" name="confetti" ${d.confetti ? "checked" : ""}> Confetti</label>
        <label class="hg-check"><input type="checkbox" name="shake" ${d.shake ? "checked" : ""}> Screen shake</label>
        <label class="hg-check"><input type="checkbox" name="chat" ${d.chat === false ? "" : "checked"}> Also post it in chat</label>
        <label>Then set the Show Rating to<select name="reset">${opt([["0", "— leave it —"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]], String(d.reset ?? 0))}</select></label>
        ${this.kind === "peak" ? `<label class="hg-check"><input type="checkbox" name="trinket" ${d.trinket ? "checked" : ""}> Award a Trinket to</label>
          <label><select name="who">${opt(people, d.who ?? top)}</select></label>` : ""}
        ${this.kind === "escalation" ? `<label class="hg-span2">Celmak's response<select name="response">${opt(esc_, d.response ?? "none")}</select></label>` : ""}
      </div>
      <footer class="hg-row hg-footer">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" class="hg-big" data-action="go"><i class="fa-solid fa-tower-broadcast"></i> Broadcast</button>
      </footer>`;
  }

  #collect() {
    const f = this.element;
    const v = (n) => f.querySelector(`[name="${n}"]`);
    this.draft = {
      ...this.draft,
      kicker: v("kicker")?.value ?? "", title: v("title")?.value ?? "", subtitle: v("subtitle")?.value ?? "",
      theme: v("theme")?.value, sticker: v("sticker")?.value ?? "", sound: v("sound")?.value ?? "",
      confetti: !!v("confetti")?.checked, shake: !!v("shake")?.checked, chat: !!v("chat")?.checked,
      reset: Number(v("reset")?.value ?? 0), trinket: !!v("trinket")?.checked, who: v("who")?.value, response: v("response")?.value
    };
  }

  static #onKind(_e, t) {
    this.setKind(t.dataset.kind);
    this.render();
  }

  static async #onGo() {
    this.#collect();
    const d = this.draft;
    if (!d.title.trim() && !d.subtitle.trim()) return ui.notifications.warn("Write a headline or some text first.");
    broadcast("title", { kind: "announce", theme: d.theme, kicker: d.kicker, title: d.title, subtitle: d.subtitle, sticker: d.sticker || false, sound: d.sound || false });
    if (d.confetti) broadcast("confetti", {});
    if (d.shake) broadcast("shake", {});
    if (d.chat) await chatCard({ title: esc(d.title || d.kicker), sticker: d.sticker ? sticker(d.sticker) : null, body: d.subtitle ? `<p>${esc(d.subtitle)}</p>` : "" });
    if (this.kind === "peak" && d.trinket) await awardTrinket(d.who, { announce: false });
    if (this.kind === "escalation" && d.response && d.response !== "none") await runEscalation(d.response);
    if (d.reset) await setShow(d.reset, "Announcement", { quiet: true });
    this.draft = null;
    this.close();
  }
}

export { CUES };
