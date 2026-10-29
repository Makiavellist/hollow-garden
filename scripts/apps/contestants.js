import { RATING_MAX, defaultContestants, moodFor } from "../constants.js";
import { getState, updateContestants } from "../state.js";
import { actorFromDrop } from "../board.js";
import { clamp, esc, randomId } from "../util.js";
import { HGApplication } from "./base.js";

/** GM form for casting the show: names, linked actors, portraits and starting fans. */
export class ContestantsConfig extends HGApplication {
  static DEFAULT_OPTIONS = {
    id: "hg-contestants",
    classes: ["hg-app", "hg-contestants"],
    window: { title: "The Hollow Garden · Contestants", icon: "fa-solid fa-users", resizable: true },
    position: { width: 860, height: 640 },
    actions: {
      save: ContestantsConfig.#onSave,
      add: ContestantsConfig.#onAdd,
      remove: ContestantsConfig.#onRemove,
      up: ContestantsConfig.#onMove,
      down: ContestantsConfig.#onMove,
      browse: ContestantsConfig.#onBrowse,
      defaults: ContestantsConfig.#onDefaults,
      useActorArt: ContestantsConfig.#onActorArt,
      openActor: ContestantsConfig.#onOpenActor,
      unlink: ContestantsConfig.#onUnlink
    }
  };

  rows = null;

  async _prepareContext() {
    if (!this.rows) this.rows = foundry.utils.deepClone(getState().contestants);
    const actors = game.actors.contents
      .filter((a) => a.type === "character" || a.hasPlayerOwner)
      .concat(game.actors.contents.filter((a) => !(a.type === "character" || a.hasPlayerOwner)))
      .map((a) => ({ uuid: a.uuid, name: a.name, pc: a.type === "character" || a.hasPlayerOwner }));
    return { rows: this.rows, actors };
  }

  _body({ rows, actors }) {
    const opts = (sel) => `<option value="">— none —</option>`
      + (sel && !actors.some((a) => a.uuid === sel) ? `<option value="${esc(sel)}" selected>(linked) ${esc(sel)}</option>` : "")
      + actors.map((a) => `<option value="${esc(a.uuid)}" ${a.uuid === sel ? "selected" : ""}>${a.pc ? "★ " : ""}${esc(a.name)}</option>`).join("");
    const art = (i, mood, val) => `<div class="hg-artpick">
        <img src="${esc(val)}" alt="${mood}" title="${mood}">
        <input type="text" name="art-${i}-${mood}" value="${esc(val)}" placeholder="${mood} image">
        <button type="button" class="hg-icon" data-action="browse" data-index="${i}" data-mood="${mood}" title="Browse"><i class="fa-solid fa-folder-open"></i></button>
      </div>`;
    const list = rows.map((c, i) => `
      <li class="hg-cast-row ${c.visible ? "" : "hg-dim"}" data-index="${i}">
        <div class="hg-cast-head">
          <img class="hg-cast-thumb" src="${esc(c.art?.[moodFor(c.rating)] ?? "")}" alt="">
          <label>Name<input type="text" name="name-${i}" value="${esc(c.name)}"></label>
          <label>Linked actor<select name="actor-${i}">${opts(c.actorUuid)}</select></label>
          <span class="hg-link-state">${c.actorUuid
            ? `<button type="button" class="hg-icon" data-action="openActor" data-index="${i}" title="Open the linked actor"><i class="fa-solid fa-link"></i></button><button type="button" class="hg-icon" data-action="unlink" data-index="${i}" title="Unlink"><i class="fa-solid fa-link-slash"></i></button>`
            : `<span class="hg-muted" title="Pick an actor or drop one on this row">not linked</span>`}</span>
          <label class="hg-num">Fans<input type="number" name="rating-${i}" min="0" max="${RATING_MAX}" value="${c.rating}"></label>
          <label class="hg-check"><input type="checkbox" name="visible-${i}" ${c.visible ? "checked" : ""}> on stage</label>
          <span class="hg-cast-ctl">
            <button type="button" class="hg-icon" data-action="up" data-index="${i}" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="hg-icon" data-action="down" data-index="${i}" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" class="hg-icon" data-action="remove" data-index="${i}" title="Remove"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>
        <div class="hg-cast-art">${art(i, "sad", c.art?.sad ?? "")}${art(i, "neutral", c.art?.neutral ?? "")}${art(i, "happy", c.art?.happy ?? "")}
          <button type="button" data-action="useActorArt" data-index="${i}" title="Use the linked actor's portrait for all three moods"><i class="fa-solid fa-user"></i> Actor portrait</button>
        </div>
      </li>`).join("");
    return `<p class="hg-hint">Link each contestant to a character (pick it, or drag an actor from the Actors sidebar onto the row, or onto their card on the board) so Trinkets and honeypot rolls use their sheet. Names are what the players see. Portraits swap with the fans' mood: <strong>sad</strong> at 0–3, <strong>neutral</strong> at 4–6, <strong>happy</strong> at 7–10. Untick <em>on stage</em> for anyone sitting in the Box.</p>
      <ol class="hg-cast-list">${list}</ol>
      <footer class="hg-row hg-footer">
        <button type="button" data-action="add"><i class="fa-solid fa-user-plus"></i> Add contestant</button>
        <button type="button" data-action="defaults"><i class="fa-solid fa-rotate-left"></i> Restore default cast</button>
        <button type="button" class="hg-big" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Save cast</button>
      </footer>`;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const row of this.element.querySelectorAll("[data-drop-row]")) {
      row.addEventListener("dragover", (ev) => { ev.preventDefault(); row.classList.add("hg-drop"); });
      row.addEventListener("dragleave", () => row.classList.remove("hg-drop"));
      row.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        row.classList.remove("hg-drop");
        const actor = await actorFromDrop(ev);
        if (!actor) return ui.notifications.warn("Drop an Actor from the Actors sidebar.");
        this.#collect();
        this.rows[Number(row.dataset.dropRow)].actorUuid = actor.uuid;
        this.render();
      });
    }
    // Picking from the list updates the link indicator straight away.
    for (const sel of this.element.querySelectorAll("select[name^='actor-']")) {
      sel.addEventListener("change", () => {
        this.#collect();
        this.render();
      });
    }
  }

  /** Read the current form values back into this.rows. */
  #collect() {
    const f = this.element;
    const val = (n) => f.querySelector(`[name="${n}"]`);
    this.rows = this.rows.map((c, i) => ({
      ...c,
      name: val(`name-${i}`)?.value?.trim() || c.name,
      actorUuid: val(`actor-${i}`)?.value || null,
      rating: clamp(Number(val(`rating-${i}`)?.value ?? c.rating), 0, RATING_MAX),
      visible: !!val(`visible-${i}`)?.checked,
      art: {
        sad: val(`art-${i}-sad`)?.value?.trim() || c.art?.sad,
        neutral: val(`art-${i}-neutral`)?.value?.trim() || c.art?.neutral,
        happy: val(`art-${i}-happy`)?.value?.trim() || c.art?.happy
      }
    }));
  }

  static async #onSave() {
    this.#collect();
    await updateContestants(this.rows);
    ui.notifications.info("The Hollow Garden: cast saved.");
    this.rows = null;
    this.close();
  }

  static #onAdd() {
    this.#collect();
    const fallback = "icons/svg/mystery-man.svg";
    this.rows.push({ id: randomId(), name: "Новый участник", actorUuid: null, rating: 5, visible: true,
      art: { sad: fallback, neutral: fallback, happy: fallback } });
    this.render();
  }

  static #onRemove(_e, t) {
    this.#collect();
    this.rows.splice(Number(t.dataset.index), 1);
    this.render();
  }

  static #onMove(_e, t) {
    this.#collect();
    const i = Number(t.dataset.index);
    const j = t.dataset.action === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= this.rows.length) return;
    [this.rows[i], this.rows[j]] = [this.rows[j], this.rows[i]];
    this.render();
  }

  static async #onOpenActor(_e, t) {
    const actor = await fromUuid(this.rows[Number(t.dataset.index)]?.actorUuid ?? "");
    if (actor) actor.sheet.render(true);
    else ui.notifications.warn("The linked actor no longer exists.");
  }

  static #onUnlink(_e, t) {
    this.#collect();
    this.rows[Number(t.dataset.index)].actorUuid = null;
    this.render();
  }

  static #onDefaults() {
    this.rows = defaultContestants();
    this.render();
  }

  static async #onActorArt(_e, t) {
    this.#collect();
    const i = Number(t.dataset.index);
    const row = this.rows[i];
    const actor = row.actorUuid ? await fromUuid(row.actorUuid) : null;
    if (!actor) return ui.notifications.warn("Link an actor first.");
    row.art = { sad: actor.img, neutral: actor.img, happy: actor.img };
    this.render();
  }

  static #onBrowse(_e, t) {
    this.#collect();
    const i = Number(t.dataset.index);
    const mood = t.dataset.mood;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    const picker = new FP({
      type: "image",
      current: this.rows[i].art?.[mood] ?? "",
      callback: (path) => {
        this.rows[i].art = { ...(this.rows[i].art ?? {}), [mood]: path };
        this.render();
      }
    });
    picker.render(true);
  }
}
