import { getState } from "../state.js";
import { resolveHoneypot } from "../rules.js";
import { esc } from "../util.js";
import { HGApplication } from "./base.js";

/** GM helper for "The Tinkerer's Honeypots": sorts a Knowledge (engineering) result into its band. */
export class HoneypotDesk extends HGApplication {
  static DEFAULT_OPTIONS = {
    id: "hg-honeypot",
    classes: ["hg-app", "hg-honeypot"],
    window: { title: "Honeypot Check", icon: "fa-solid fa-microchip", resizable: false },
    position: { width: 460 },
    actions: { roll: HoneypotDesk.#onRoll, resolve: HoneypotDesk.#onResolve }
  };

  values = { who: "", total: "", natural: "" };

  async _prepareContext() {
    const state = getState();
    const token = canvas?.tokens?.controlled?.[0]?.actor;
    const options = state.contestants.map((c) => ({ value: `c:${c.id}`, label: c.name + (c.actorUuid ? "" : " (no actor)") }));
    if (token) options.unshift({ value: `a:${token.uuid}`, label: `Selected token: ${token.name}` });
    return { options };
  }

  _body({ options }) {
    const v = this.values;
    const sel = options.map((o) => `<option value="${esc(o.value)}" ${o.value === v.who ? "selected" : ""}>${esc(o.label)}</option>`).join("");
    return `<p class="hg-hint">Whenever anyone uses <strong>Knowledge (engineering)</strong> on the Garden's systems: 61+ is the real answer; 60 or lower with a natural 1–10 is an amusing fake (+1 rating); 11–20 is a convincing, detrimental fake. Results are whispered to you.</p>
      <label class="hg-block">Who is reading the machine?<select name="who">${sel}</select></label>
      <div class="hg-row"><button type="button" data-action="roll"><i class="fa-solid fa-dice-d20"></i> Roll Knowledge (engineering)</button></div>
      <div class="hg-form-grid">
        <label>Total<input type="number" name="total" value="${esc(v.total)}"></label>
        <label>Natural d20<input type="number" name="natural" min="1" max="20" value="${esc(v.natural)}"></label>
      </div>
      <footer class="hg-row hg-footer"><button type="button" class="hg-big" data-action="resolve"><i class="fa-solid fa-microchip"></i> Sort into band</button></footer>`;
  }

  #collect() {
    const f = this.element;
    this.values = {
      who: f.querySelector("[name='who']")?.value ?? "",
      total: f.querySelector("[name='total']")?.value ?? "",
      natural: f.querySelector("[name='natural']")?.value ?? ""
    };
  }

  async #actorFor(who) {
    if (who.startsWith("a:")) return fromUuid(who.slice(2));
    const c = getState().contestants.find((x) => x.id === who.slice(2));
    return c?.actorUuid ? fromUuid(c.actorUuid) : null;
  }

  static async #onRoll() {
    this.#collect();
    const actor = await this.#actorFor(this.values.who);
    if (!actor?.rollSkill) return ui.notifications.warn("No linked actor to roll for. Enter the total and natural die by hand.");
    let res;
    try {
      res = await actor.rollSkill("ken", { skipDialog: true });
    } catch (err) {
      console.warn(err);
    }
    const roll = res?.rolls?.[0] ?? (res instanceof Roll ? res : null);
    if (!roll) return ui.notifications.info("Roll made. Enter the total and the natural d20 from the chat card.");
    const d20 = roll.dice?.find((d) => d.faces === 20);
    const natural = d20?.results?.find((r) => r.active)?.result ?? d20?.total ?? "";
    this.values.total = String(roll.total);
    this.values.natural = String(natural);
    this.render();
  }

  static async #onResolve() {
    this.#collect();
    const { who, total, natural } = this.values;
    if (total === "" || natural === "") return ui.notifications.warn("Enter the total and the natural d20.");
    const cid = who.startsWith("c:") ? who.slice(2) : null;
    const actor = await this.#actorFor(who);
    const name = actor?.name ?? getState().contestants.find((c) => c.id === cid)?.name ?? "";
    await resolveHoneypot({ total, natural, cid, actorName: name });
    this.values.total = "";
    this.values.natural = "";
    this.render();
  }
}
