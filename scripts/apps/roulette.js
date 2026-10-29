import { EPISODES, starring, sticker } from "../constants.js";
import { playSfx } from "../audio.js";
import { broadcast, registerHandler } from "../socket.js";
import { confetti, fxLayer, popSticker } from "../fx.js";
import { getState, setCurrentEpisode, setEpisodesDone } from "../state.js";
import { chatCard, esc, isGM, reduceMotion } from "../util.js";
import { HGApplication } from "./base.js";

const COLORS = ["#ff3cac", "#2de2e6", "#7b5cff", "#ffd166", "#ff7a3c", "#3cff9e", "#ff5f7e", "#5cb8ff"];

/* ------------------------------------------------------------------ */
/*  The rigging desk (GM)                                              */
/* ------------------------------------------------------------------ */

export class RouletteDesk extends HGApplication {
  static DEFAULT_OPTIONS = {
    id: "hg-roulette-desk",
    classes: ["hg-app", "hg-roulette-desk"],
    window: { title: "Episode Wheel · Rigging Desk", icon: "fa-solid fa-dharmachakra", resizable: false },
    position: { width: 520 },
    actions: { spin: RouletteDesk.#onSpin, toggle: RouletteDesk.#onToggle }
  };

  async _prepareContext() {
    const state = getState();
    const pending = EPISODES.filter((e) => !state.episodes.find((x) => x.id === e.id)?.done);
    return { state, pending };
  }

  _body({ state, pending }) {
    const list = EPISODES.map((e) => {
      const done = state.episodes.find((x) => x.id === e.id)?.done;
      return `<li><label class="hg-check"><input type="checkbox" data-action="toggle" data-id="${e.id}" ${done ? "" : "checked"}> ${esc(e.title)}</label><small>${esc(e.ru)} · ${esc(starring(e, state.contestants))}</small></li>`;
    }).join("");
    const target = pending[0]?.id;
    const opts = pending.map((e) => `<option value="${e.id}" ${e.id === target ? "selected" : ""}>${esc(e.title)}</option>`).join("");
    return `<p class="hg-hint">Ticked episodes go on the wheel. The audience sees a fair spin; it lands where you say. The default is the next episode on Celmak's schedule.</p>
      <ul class="hg-wheel-eps">${list}</ul>
      <div class="hg-form-grid">
        <label>Land on <select name="target">${opts}</select></label>
        <label>Spin time <select name="duration"><option value="6">Short (6 s)</option><option value="9" selected>Dramatic (9 s)</option><option value="13">Agonising (13 s)</option></select></label>
        <label class="hg-check"><input type="checkbox" name="nearmiss" checked> Near-miss tease</label>
        <label class="hg-check"><input type="checkbox" name="current" checked> Mark as “now showing”</label>
      </div>
      <footer class="hg-row hg-footer"><button type="button" class="hg-big" data-action="spin" ${pending.length ? "" : "disabled"}><i class="fa-solid fa-dharmachakra"></i> Spin!</button></footer>`;
  }

  static async #onToggle(_e, t) {
    await setEpisodesDone({ [t.dataset.id]: !t.checked });
    this.render();
  }

  static async #onSpin() {
    const root = this.element;
    const state = getState();
    const segments = EPISODES.filter((e) => !state.episodes.find((x) => x.id === e.id)?.done).map((e) => {
      return { id: e.id, title: e.ru, spotlight: starring(e, state.contestants) };
    });
    if (!segments.length) return;
    const targetId = root.querySelector("[name='target']")?.value ?? segments[0].id;
    const index = Math.max(0, segments.findIndex((s) => s.id === targetId));
    const near = root.querySelector("[name='nearmiss']")?.checked;
    const jitter = near ? (Math.random() < 0.5 ? -1 : 1) * (0.34 + Math.random() * 0.1) : (Math.random() - 0.5) * 0.5;
    const duration = Number(root.querySelector("[name='duration']")?.value ?? 9);
    const markCurrent = root.querySelector("[name='current']")?.checked;
    const spins = Math.round(duration * 0.75) + 3;
    broadcast("roulette", { segments, index, jitter, duration, spins });
    this.close();
    setTimeout(async () => {
      const ep = EPISODES.find((e) => e.id === targetId);
      if (markCurrent) await setCurrentEpisode(targetId);
      await chatCard({
        title: `The wheel has spoken: ${esc(ep.title)}`,
        sticker: sticker("presenting"),
        whisper: true,
        body: `<p>Next up: <strong>${esc(ep.title)}</strong> (${esc(ep.ru)}).</p><p>@UUID[${ep.page}]{Open the episode}</p>`,
        buttons: [{ action: "titlecard", label: "Roll the title card", icon: "fa-solid fa-clapperboard", data: { episode: ep.id } }]
      });
    }, (duration + 1.5) * 1000);
  }
}

/* ------------------------------------------------------------------ */
/*  The wheel overlay (everyone)                                       */
/* ------------------------------------------------------------------ */

function wheelSVG(segments) {
  const n = segments.length;
  const R = 200;
  const a = (2 * Math.PI) / n;
  const pt = (ang, r = R) => [r * Math.sin(ang), -r * Math.cos(ang)];
  let paths = "";
  let labels = "";
  segments.forEach((s, i) => {
    const [x1, y1] = pt(i * a);
    const [x2, y2] = pt((i + 1) * a);
    const large = a > Math.PI ? 1 : 0;
    const color = COLORS[i % COLORS.length];
    paths += n === 1
      ? `<circle r="${R}" fill="${color}"/>`
      : `<path d="M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" data-seg="${i}"/>`;
    const mid = (i + 0.5) * a;
    const deg = (mid * 180) / Math.PI;
    const title = s.title.length > 26 ? `${s.title.slice(0, 25)}…` : s.title;
    const fit = title.length > 11 ? ` textLength="${Math.min(136, title.length * 9.5)}" lengthAdjust="spacingAndGlyphs"` : "";
    labels += `<g transform="rotate(${deg.toFixed(2)})"><text x="0" y="${-R + 18}" class="hg-wl" transform="rotate(90 0 ${-R + 18})" text-anchor="start" dominant-baseline="middle"${fit}>${esc(title)}</text></g>`;
  });
  let bulbs = "";
  for (let i = 0; i < 24; i++) {
    const [x, y] = pt((i / 24) * 2 * Math.PI, R + 16);
    bulbs += `<circle class="hg-bulb ${i % 2 ? "b" : "a"}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`;
  }
  return `<svg class="hg-wheel-svg" viewBox="-240 -240 480 480" aria-hidden="true">
      <circle r="${R + 28}" class="hg-wheel-rim"/>
      ${bulbs}
      <g class="hg-wheel-rot">${paths}${labels}
        ${segments.map((_, i) => { const [x, y] = pt(i * a); return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="hg-wheel-div"/>`; }).join("")}
      </g>
      <circle r="44" class="hg-wheel-hub"/>
    </svg>`;
}

export function runRoulette({ segments, index, jitter = 0, duration = 9, spins = 8 }) {
  const n = segments.length;
  const segDeg = 360 / n;
  const finalOffset = 360 - (index + 0.5 + jitter) * segDeg;
  const total = spins * 360 + finalOffset;
  const layer = fxLayer();
  layer.querySelectorAll(".hg-roulette").forEach((x) => x.remove());
  const target = segments[index];
  const node = document.createElement("div");
  node.className = "hg-roulette";
  node.innerHTML = `
    <div class="hg-roulette-backdrop"></div>
    <div class="hg-roulette-stage">
      <div class="hg-roulette-title">КТО СЛЕДУЮЩИЙ?<small>Решают зрители! (Зрители — голограммы.)</small></div>
      <div class="hg-wheel">
        <div class="hg-pointer"></div>
        ${wheelSVG(segments)}
        <img class="hg-wheel-host" src="${sticker("presenting")}" alt="">
      </div>
      <div class="hg-roulette-result hg-pending"></div>
      ${isGM() ? `<div class="hg-rigged"><i class="fa-solid fa-user-secret"></i> Rigged → ${esc(target.title)}</div>` : ""}
    </div>`;
  layer.appendChild(node);
  const rot = node.querySelector(".hg-wheel-rot");
  const ms = (reduceMotion() ? Math.min(duration, 3) : duration) * 1000;
  playSfx("spin-start", { volume: 0.6 });
  setTimeout(() => playSfx("drumroll", { volume: 0.5 }), Math.max(0, ms - 2700));
  const start = performance.now();
  let lastSeg = 0;
  let lastTick = 0;
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  const frame = (now) => {
    if (!node.isConnected) return;
    const t = Math.min(1, (now - start) / ms);
    const ang = total * ease(t);
    rot.setAttribute("transform", `rotate(${ang.toFixed(3)})`);
    const seg = Math.floor(ang / segDeg);
    if (seg !== lastSeg && now - lastTick > 45) {
      lastSeg = seg;
      lastTick = now;
      playSfx("tick", { volume: 0.35 });
      node.querySelector(".hg-pointer")?.classList.remove("hg-flick");
      void node.offsetWidth;
      node.querySelector(".hg-pointer")?.classList.add("hg-flick");
    }
    if (t < 1) requestAnimationFrame(frame);
    else land();
  };
  const land = () => {
    node.querySelector(`[data-seg="${index}"]`)?.classList.add("hg-winner");
    const res = node.querySelector(".hg-roulette-result");
    res.classList.remove("hg-pending");
    res.innerHTML = `<small>СЛЕДУЮЩИЙ ЭПИЗОД</small><strong>${esc(target.title)}</strong>${target.spotlight ? `<span>в главной роли: ${esc(target.spotlight)}</span>` : ""}`;
    playSfx("fanfare");
    confetti();
    popSticker({ sticker: "mic-welcome", caption: `${target.title}!`, side: "right" });
    setTimeout(() => {
      node.classList.add("hg-out");
      setTimeout(() => node.remove(), 700);
    }, 6500);
  };
  requestAnimationFrame(frame);
  node.addEventListener("click", () => {
    if (isGM()) node.remove();
  });
}

registerHandler("roulette", runRoulette);
