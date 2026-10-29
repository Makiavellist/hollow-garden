import { sticker } from "../constants.js";
import { playSfx } from "../audio.js";
import { broadcast, registerHandler } from "../socket.js";
import { confetti, fxLayer, popSticker } from "../fx.js";
import { chatCard, esc, isGM, setting } from "../util.js";
import { getState } from "../state.js";
import { HGApplication } from "./base.js";

/** Presets in Russian (shown to the audience). Names come from the current cast. */
function presets() {
  const names = getState().contestants.filter((c) => c.visible).map((c) => c.name);
  return [
    { q: "Кого Сельмак просканирует следующим?", o: names.slice(0, 4) },
    { q: "Разделить команду?", o: ["Да! Драма!", "Нет, пусть держатся вместе"] },
    { q: "Чей эпизод следующий?", o: names.slice(4, 7).length >= 2 ? names.slice(4, 7) : names.slice(0, 3) },
    { q: "Чем порадовать зрителей?", o: ["Газом настроения", "Демоном из труппы", "Перестройкой комнаты", "Закусками"] }
  ];
}

/** Make up believable percentages that put `winner` on top. */
function rigPercentages(n, winner) {
  const raw = Array.from({ length: n }, () => 10 + Math.random() * 30);
  raw[winner] = Math.max(...raw) + 8 + Math.random() * 20;
  const sum = raw.reduce((a, b) => a + b, 0);
  const pct = raw.map((v) => Math.round((v / sum) * 100));
  pct[winner] += 100 - pct.reduce((a, b) => a + b, 0);
  return pct;
}

export class VoteDesk extends HGApplication {
  static DEFAULT_OPTIONS = {
    id: "hg-vote-desk",
    classes: ["hg-app", "hg-vote-desk"],
    window: { title: "Audience Vote · Control Room", icon: "fa-solid fa-square-poll-horizontal", resizable: false },
    position: { width: 540 },
    actions: { preset: VoteDesk.#onPreset, rig: VoteDesk.#onRig, go: VoteDesk.#onGo }
  };

  draft = null;

  async _prepareContext() {
    if (!this.draft) {
      const p = presets()[0];
      this.draft = { q: p.q, o: [...p.o], pct: rigPercentages(p.o.length, 0), winner: 0 };
    }
    return {};
  }

  _body() {
    const d = this.draft;
    const list = presets().map((p, i) => `<button type="button" class="hg-chip" data-action="preset" data-i="${i}">${esc(p.q)}</button>`).join("");
    const rows = [0, 1, 2, 3].map((i) => `<li>
        <label class="hg-radio" title="Winner"><input type="radio" name="winner" value="${i}" ${d.winner === i ? "checked" : ""}></label>
        <input type="text" name="o${i}" value="${esc(d.o[i] ?? "")}" placeholder="Option ${i + 1}${i > 1 ? " (optional)" : ""}">
        <input type="number" name="p${i}" min="0" max="100" value="${d.pct[i] ?? 0}"><span>%</span>
      </li>`).join("");
    return `<p class="hg-hint">The audience votes live (write the question and options in Russian, players see them as typed). You decide the result. Pick a winner and press <em>Rig it</em> to invent believable numbers, or type your own.</p>
      <div class="hg-chips">${list}</div>
      <label class="hg-block">Question<input type="text" name="q" value="${esc(d.q)}"></label>
      <ul class="hg-vote-opts">${rows}</ul>
      <footer class="hg-row hg-footer">
        <button type="button" data-action="rig"><i class="fa-solid fa-user-secret"></i> Rig it</button>
        <button type="button" class="hg-big" data-action="go"><i class="fa-solid fa-tower-broadcast"></i> Open the vote</button>
      </footer>`;
  }

  #collect() {
    const f = this.element;
    const d = this.draft;
    d.q = f.querySelector("[name='q']").value.trim();
    d.o = [0, 1, 2, 3].map((i) => f.querySelector(`[name='o${i}']`).value.trim());
    d.pct = [0, 1, 2, 3].map((i) => Number(f.querySelector(`[name='p${i}']`).value) || 0);
    d.winner = Number(f.querySelector("[name='winner']:checked")?.value ?? 0);
  }

  static #onPreset(_e, t) {
    const p = presets()[Number(t.dataset.i)];
    this.draft = { q: p.q, o: [...p.o], pct: rigPercentages(p.o.length, 0), winner: 0 };
    this.render();
  }

  static #onRig() {
    this.#collect();
    const n = this.draft.o.filter(Boolean).length;
    const w = Math.min(this.draft.winner, n - 1);
    const pct = rigPercentages(n, w);
    this.draft.pct = [0, 1, 2, 3].map((i) => pct[i] ?? 0);
    this.draft.winner = w;
    this.render();
  }

  static async #onGo() {
    this.#collect();
    const d = this.draft;
    const options = d.o.map((label, i) => ({ label, pct: d.pct[i], picked: i === d.winner })).filter((o) => o.label);
    if (options.length < 2) return ui.notifications.warn("A vote needs at least two options.");
    // The ticked winner always wins: if the typed numbers disagree, rig them.
    let winner = Math.max(0, options.findIndex((o) => o.picked));
    if (options.some((o, i) => i !== winner && o.pct >= options[winner].pct)) {
      const pct = rigPercentages(options.length, winner);
      options.forEach((o, i) => (o.pct = pct[i]));
    }
    for (const o of options) delete o.picked;
    broadcast("vote", { question: d.q || "Голосование зрителей", options, winner });
    this.close();
    setTimeout(() => chatCard({
      title: "Решение зрителей окончательно",
      sticker: sticker("ratings"),
      body: `<p><strong>${esc(d.q)}</strong></p><ul>${options.map((o, i) => `<li>${i === winner ? "<strong>" : ""}${esc(o.label)}: ${o.pct}%${i === winner ? "</strong>" : ""}</li>`).join("")}</ul>`
    }), 10500);
  }
}

export function runVote({ question, options, winner }) {
  const layer = fxLayer();
  layer.querySelectorAll(".hg-vote").forEach((x) => x.remove());
  const node = document.createElement("div");
  node.className = "hg-vote";
  node.innerHTML = `
    <div class="hg-vote-panel">
      <div class="hg-vote-head"><span class="hg-live"><span class="hg-dot"></span>ГОЛОСОВАНИЕ ЗРИТЕЛЕЙ</span><span class="hg-vote-timer">5</span></div>
      <div class="hg-vote-q">${esc(question)}</div>
      <ul>${options.map((o, i) => `<li data-i="${i}"><span class="hg-vote-label">${esc(o.label)}</span><div class="hg-vote-bar"><div></div></div><span class="hg-vote-pct">0%</span></li>`).join("")}</ul>
      ${isGM() ? `<div class="hg-rigged"><i class="fa-solid fa-user-secret"></i> Rigged → ${esc(options[winner].label)}</div>` : ""}
    </div>
    ${setting("stickers") === false ? "" : `<img class="hg-vote-host" src="${sticker("countdown")}" alt="">`}`;
  layer.appendChild(node);
  const bars = [...node.querySelectorAll("li")];
  const timer = node.querySelector(".hg-vote-timer");
  playSfx("countdown", { volume: 0.6 });
  let left = 5;
  const jiggle = setInterval(() => {
    for (const li of bars) {
      const v = 8 + Math.random() * 60;
      li.querySelector(".hg-vote-bar div").style.width = `${v}%`;
      li.querySelector(".hg-vote-pct").textContent = `${Math.round(v)}%`;
    }
  }, 380);
  const count = setInterval(() => {
    left -= 1;
    timer.textContent = String(Math.max(0, left));
    if (left <= 0) {
      clearInterval(count);
      clearInterval(jiggle);
      reveal();
    }
  }, 1000);
  const reveal = () => {
    timer.textContent = "ИТОГИ";
    node.classList.add("hg-revealed");
    playSfx("drumroll", { volume: 0.5 });
    bars.forEach((li, i) => {
      li.querySelector(".hg-vote-bar div").style.width = `${options[i].pct}%`;
      li.querySelector(".hg-vote-pct").textContent = `${options[i].pct}%`;
    });
    setTimeout(() => {
      bars[winner]?.classList.add("hg-winner");
      confetti();
      popSticker({ sticker: "correct", caption: `${options[winner].label}!`, side: "left" });
    }, 2700);
    setTimeout(() => {
      node.classList.add("hg-out");
      setTimeout(() => node.remove(), 700);
    }, 8500);
  };
  node.addEventListener("click", () => {
    if (isGM()) node.remove();
  });
}

registerHandler("vote", runVote);
