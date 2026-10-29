import { CUES, HOST_NAME, MOOD_GAS, PERSONAS, SEASON_TITLE, SHOW_TITLE, sticker as stickerPath } from "./constants.js";
import { playSfx } from "./audio.js";
import { esc, reduceMotion, setting } from "./util.js";

let layer;

export function fxLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement("div");
  layer.id = "hg-fx";
  layer.setAttribute("aria-live", "polite");
  document.body.appendChild(layer);
  return layer;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function removeLater(node, ms) {
  setTimeout(() => {
    node.classList.add("hg-out");
    setTimeout(() => node.remove(), 650);
  }, ms);
}

/* ------------------------------------------------------------------ */
/*  Stickers                                                           */
/* ------------------------------------------------------------------ */

const SIDES = ["left", "right", "right-top", "left-top"];
let sideIndex = 0;

export function popSticker({ sticker, caption = "", side = null, duration = 3600, sound = null } = {}) {
  if (sound) playSfx(sound);
  if (setting("stickers") === false || !sticker) return;
  const where = side ?? SIDES[sideIndex++ % SIDES.length];
  const src = sticker.includes("/") ? sticker : stickerPath(sticker);
  const node = el(`<div class="hg-sticker hg-from-${where}">
      <img src="${esc(src)}" alt="">
      ${caption ? `<div class="hg-sticker-bubble">${esc(caption)}</div>` : ""}
    </div>`);
  fxLayer().appendChild(node);
  removeLater(node, duration);
}

export function playCue(id) {
  const cue = CUES.find((c) => c.id === id);
  if (!cue) return;
  popSticker({ sticker: cue.sticker, sound: cue.sound });
  if (cue.fx === "confetti") confetti();
  if (cue.fx === "shake") shake();
}

/* ------------------------------------------------------------------ */
/*  "Celmak says" lower-third caption                                  */
/* ------------------------------------------------------------------ */

let captionNode = null;
let captionTimer = null;

export function caption({ persona = "Host", text = "", sticker = null, sound = "on-air" } = {}) {
  const p = PERSONAS[persona] ?? PERSONAS.Host;
  const img = sticker ?? p.stickers[0];
  if (sound) playSfx(sound, { volume: 0.5 });
  captionNode?.remove();
  clearTimeout(captionTimer);
  const node = el(`<div class="hg-caption" style="--persona:${esc(p.color)}">
      ${setting("stickers") === false ? "" : `<img class="hg-caption-host" src="${esc(stickerPath(img))}" alt="">`}
      <div class="hg-caption-box">
        <div class="hg-caption-tag"><span class="hg-rec"></span>${esc(HOST_NAME.toUpperCase())} · ${esc(p.tag)}</div>
        <div class="hg-caption-text"></div>
      </div>
    </div>`);
  fxLayer().appendChild(node);
  captionNode = node;
  const target = node.querySelector(".hg-caption-text");
  const full = String(text);
  if (reduceMotion()) target.textContent = full;
  else {
    let i = 0;
    const step = () => {
      if (!node.isConnected) return;
      i = Math.min(full.length, i + 2);
      target.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(step, 28);
    };
    step();
  }
  const ms = Math.max(4500, 2600 + full.length * 55);
  captionTimer = setTimeout(() => {
    node.classList.add("hg-out");
    setTimeout(() => node.remove(), 650);
  }, ms);
}

/* ------------------------------------------------------------------ */
/*  Full-screen title cards                                            */
/* ------------------------------------------------------------------ */

const SHOW_UP = SHOW_TITLE.toUpperCase();
const TITLE_DEFAULTS = {
  episode: { kicker: `СЕГОДНЯ В ШОУ «${SHOW_UP}»`, sound: "on-air", sticker: "mic-welcome", theme: "episode" },
  intermission: { kicker: SHOW_UP, title: "РЕКЛАМНАЯ ПАУЗА", subtitle: "Не переключайтесь. (Вы всё равно не сможете.)", sound: "jingle", sticker: "this-is-fine", theme: "break" },
  previously: { kicker: "РАНЕЕ В ШОУ…", title: SHOW_UP, subtitle: SEASON_TITLE, sound: "whoosh", sticker: "shocked", theme: "vhs" },
  finale: { kicker: SHOW_UP, title: "ФИНАЛ СЕЗОНА", subtitle: "В каждом сезоне есть финал, а в каждом финале — неожиданный поворот.", sound: "fanfare", sticker: "champion", theme: "finale" },
  peak: { kicker: "РЕЙТИНГИ", title: "ПИК РЕЙТИНГА!", subtitle: "", sound: "cheer", sticker: "ratings", theme: "peak" },
  escalation: { kicker: "РЕЙТИНГИ", title: "ЭСКАЛАЦИЯ!", subtitle: `Зрителям скучно. ${HOST_NAME} — нет.`, sound: "alarm", sticker: "angry", theme: "alarm" },
  announce: { kicker: "РЕЙТИНГИ", title: "ВНИМАНИЕ!", subtitle: "", sound: "on-air", sticker: "ratings", theme: "episode" },
  back: { kicker: SHOW_UP, title: "МЫ СНОВА В ЭФИРЕ!", subtitle: "Благодарим наших спонсоров. То есть меня!", sound: "on-air", sticker: "mic-welcome", theme: "episode", duration: 3400 },
  lockfalls: { kicker: "СРОЧНЫЕ НОВОСТИ", title: "ЗАМОК ПАЛ", subtitle: "«Вы не можете уйти до финала!»", sound: "suspense", sticker: "nervous", theme: "alarm" }
};

export function titleCard(data = {}) {
  const d = { ...(TITLE_DEFAULTS[data.kind] ?? TITLE_DEFAULTS.episode), ...Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && v !== "")) };
  if (d.sound) playSfx(d.sound);
  fxLayer().querySelectorAll(".hg-title").forEach((n) => n.remove());
  const node = el(`<div class="hg-title hg-theme-${esc(d.theme)}">
      <div class="hg-title-bg"></div>
      <div class="hg-title-inner">
        <div class="hg-title-kicker">${esc(d.kicker ?? "")}</div>
        <div class="hg-title-main" data-text="${esc(d.title ?? "")}">${esc(d.title ?? "")}</div>
        ${d.subtitle ? `<div class="hg-title-sub">${esc(d.subtitle)}</div>` : ""}
        ${d.starring ? `<div class="hg-title-starring">в главной роли: <strong>${esc(d.starring)}</strong></div>` : ""}
      </div>
      ${setting("stickers") === false || !d.sticker ? "" : `<img class="hg-title-host" src="${esc(stickerPath(d.sticker))}" alt="">`}
      <div class="hg-title-ticker"><span>ПРЯМОЙ ЭФИР ИЗ СУВЕРЕННОГО ПРЕДЕЛА · ЕДИНСТВЕННЫЙ ВЫХОД — ФИНАЛ · ГОЛОСУЙТЕ СЕЙЧАС · РЕЙТИНГ РЕШАЕТ ВСЁ · НИКТО НЕ УХОДИТ РАНЬШЕ ВРЕМЕНИ · </span></div>
    </div>`);
  fxLayer().appendChild(node);
  removeLater(node, d.duration ?? 5600);
}

/* ------------------------------------------------------------------ */
/*  Confetti, glitch, shake, Mood Gas                                  */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ["#ff3cac", "#2de2e6", "#ffd166", "#7b5cff", "#ffffff", "#5cff9d"];

export function confetti({ amount = 140, sound = null } = {}) {
  if (sound) playSfx(sound);
  const n = reduceMotion() ? Math.min(30, amount) : amount;
  const box = el(`<div class="hg-confetti"></div>`);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    s.style.cssText = `--x:${Math.random() * 100}vw;--d:${(Math.random() * 1.6 + 2.2).toFixed(2)}s;--delay:${(Math.random() * 0.6).toFixed(2)}s;`
      + `--r:${Math.floor(Math.random() * 720 - 360)}deg;--drift:${Math.floor(Math.random() * 160 - 80)}px;background:${c};`
      + `width:${6 + Math.random() * 7}px;height:${8 + Math.random() * 10}px;`;
    frag.appendChild(s);
  }
  box.appendChild(frag);
  fxLayer().appendChild(box);
  setTimeout(() => box.remove(), 4800);
}

export function glitch({ sound = "glitch", duration = 1500 } = {}) {
  if (sound) playSfx(sound);
  const node = el(`<div class="hg-glitch"><div></div><div></div><div></div><span class="hg-glitch-text">СИГНАЛ ПОТЕРЯН</span></div>`);
  fxLayer().appendChild(node);
  if (!reduceMotion()) shake({ sound: null, strength: 2 });
  setTimeout(() => node.remove(), duration);
}

export function shake({ sound = null, strength = 1 } = {}) {
  if (sound) playSfx(sound);
  if (reduceMotion()) return;
  const targets = [document.getElementById("board"), document.getElementById("hg-board")].filter(Boolean);
  for (const t of targets) {
    t.classList.remove("hg-shake", "hg-shake-2");
    void t.offsetWidth;
    t.classList.add(strength > 1 ? "hg-shake-2" : "hg-shake");
    setTimeout(() => t.classList.remove("hg-shake", "hg-shake-2"), 700);
  }
}

export function gas({ roll = 1, dc = 22 } = {}) {
  const g = MOOD_GAS[roll] ?? MOOD_GAS[1];
  playSfx("gas");
  const blobs = Array.from({ length: 7 }, (_, i) =>
    `<i style="--x:${10 + Math.random() * 80}%;--y:${20 + Math.random() * 70}%;--s:${30 + Math.random() * 40}vmax;--t:${(4 + Math.random() * 3).toFixed(1)}s;--delay:${(i * 0.15).toFixed(2)}s"></i>`).join("");
  const node = el(`<div class="hg-gas" style="--gas:${g.color}">${blobs}
      <div class="hg-gas-label"><small>ГАЗ НАСТРОЕНИЯ · СТОЙКОСТЬ СЛ ${dc} · ВОЛЯ СЛ ${dc}</small><strong>${esc(g.ru)}</strong></div>
    </div>`);
  fxLayer().appendChild(node);
  removeLater(node, 6500);
}

/* ------------------------------------------------------------------ */
/*  Board helpers                                                      */
/* ------------------------------------------------------------------ */

export function floatText(anchor, text, cls = "") {
  if (!anchor?.isConnected) return;
  const r = anchor.getBoundingClientRect();
  const node = el(`<div class="hg-float ${cls}">${esc(text)}</div>`);
  node.style.left = `${r.left + r.width / 2}px`;
  node.style.top = `${r.top + 10}px`;
  fxLayer().appendChild(node);
  setTimeout(() => node.remove(), 1500);
}

/** Dispatch table for socket/remote FX. */
export const FX = {
  sticker: popSticker,
  cue: (d) => playCue(d.id),
  caption,
  title: titleCard,
  confetti,
  glitch,
  shake,
  gas,
  sound: (d) => playSfx(d.key, d)
};
