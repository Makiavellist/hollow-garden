/**
 * Extra broadcast effects: studio malfunctions, signs, countdowns, spotlights and scene effects.
 * Every effect takes plain data (so it can be sent over the socket) and cleans up after itself.
 * All text shown here is audience-facing and therefore in Russian.
 */
import { HOST_NAME, SHOW_TITLE, sticker as stickerPath } from "./constants.js";
import { playSfx, stopSfx } from "./audio.js";
import { fxLayer } from "./fx.js";
import { esc, reduceMotion, setting } from "./util.js";

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function mount(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const node = t.content.firstElementChild;
  fxLayer().appendChild(node);
  return node;
}

function finish(node, ms, outMs = 600, onEnd = null) {
  setTimeout(() => {
    node.classList.add("hg-out");
    setTimeout(() => {
      node.remove();
      onEnd?.();
    }, outMs);
  }, ms);
}

const secs = (d, def) => Math.max(1, Number(d) || def) * 1000;

/* Looped sounds are tracked so "Stop all effects" can silence them. */
const loops = new Set();
function loopSfx(key, opts = {}) {
  const h = playSfx(key, { ...opts, loop: true });
  if (h) loops.add(h);
  return h;
}
function endLoop(h) {
  if (!h) return;
  loops.delete(h);
  stopSfx(h);
}

/* ------------------------------------------------------------------ */
/*  Particle canvas (sparks, petals, leaves, snow, stars)              */
/* ------------------------------------------------------------------ */

function particles({ duration, spawn, step, draw, composite = "source-over", className = "" }) {
  const cv = document.createElement("canvas");
  cv.className = `hg-particles ${className}`;
  const ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => {
    cv.width = Math.floor(innerWidth * dpr);
    cv.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  fxLayer().appendChild(cv);
  const parts = [];
  const t0 = performance.now();
  let last = t0;
  const frame = (now) => {
    if (!cv.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const el = now - t0;
    if (el < duration) spawn(parts, dt, el / duration);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = composite;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (step(p, dt) === false || p.y > innerHeight + 80 || p.y < -200 || p.x < -200 || p.x > innerWidth + 200) {
        parts.splice(i, 1);
        continue;
      }
      draw(ctx, p);
    }
    if (el < duration || (parts.length && el < duration + 6000)) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
  return cv;
}

const density = (n) => (reduceMotion() ? Math.ceil(n / 4) : n);

/* ------------------------------------------------------------------ */
/*  Malfunctions                                                       */
/* ------------------------------------------------------------------ */

/** Power outage: flicker, darkness with an emergency beacon, then the lights come back. */
export function blackout({ duration } = {}) {
  const ms = secs(duration, 6);
  playSfx("power-down");
  const node = mount(`<div class="hg-blackout">
      <div class="hg-beacon"></div>
      <div class="hg-blackout-label"><i class="fa-solid fa-triangle-exclamation"></i> АВАРИЙНОЕ ПИТАНИЕ</div>
    </div>`);
  setTimeout(() => {
    node.classList.add("hg-restoring");
    playSfx("power-up");
  }, ms);
  setTimeout(() => node.remove(), ms + 1600);
}

/** TV snow drawn on a low-resolution canvas. */
export function staticNoise({ duration } = {}) {
  const ms = secs(duration, 3);
  const snd = loopSfx("static", { volume: 0.7 });
  const cv = document.createElement("canvas");
  cv.className = "hg-static";
  cv.width = 240;
  cv.height = 135;
  fxLayer().appendChild(cv);
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(cv.width, cv.height);
  const t0 = performance.now();
  let lastDraw = 0;
  const frame = (now) => {
    if (!cv.isConnected) return;
    if (now - lastDraw > 45) {
      lastDraw = now;
      const d = img.data;
      const roll = ((now - t0) / 6) % cv.height;
      for (let y = 0; y < cv.height; y++) {
        const band = Math.abs(y - roll) < 6 ? 60 : 0;
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          const v = Math.min(255, (Math.random() * 255) | 0) + band;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    if (now - t0 < ms) requestAnimationFrame(frame);
    else {
      cv.classList.add("hg-out");
      endLoop(snd);
      setTimeout(() => cv.remove(), 400);
    }
  };
  requestAnimationFrame(frame);
}

/** Colour bars test card with a 1 kHz tone. */
export function noSignal({ duration } = {}) {
  const ms = secs(duration, 5);
  playSfx("tv-tone", { volume: 0.5 });
  const node = mount(`<div class="hg-nosignal">
      <div class="hg-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="hg-bars-low"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="hg-nosignal-box"><strong>НЕТ СИГНАЛА</strong><small>${esc(SHOW_TITLE.toUpperCase())} · ПОЖАЛУЙСТА, НЕ ПЕРЕКЛЮЧАЙТЕСЬ</small></div>
    </div>`);
  finish(node, ms, 300);
}

/** Short circuit: bursts of sparks from the light rig with white flashes. */
export function sparks({ duration } = {}) {
  const ms = secs(duration, 3);
  const bursts = [];
  const count = Math.max(2, Math.round(ms / 900));
  for (let i = 0; i < count; i++) bursts.push({ at: i === 0 ? 0 : rand(0.1, 0.9) * ms, x: rand(0.08, 0.92) * innerWidth, y: rand(0.02, 0.35) * innerHeight, done: false });
  const flash = mount(`<div class="hg-flash"></div>`);
  particles({
    duration: ms,
    composite: "lighter",
    spawn(parts, _dt, life) {
      const el = life * ms;
      for (const b of bursts) {
        if (b.done || el < b.at) continue;
        b.done = true;
        playSfx("sparks", { volume: 0.8 });
        flash.classList.remove("on");
        void flash.offsetWidth;
        flash.classList.add("on");
        parts.push({ glow: true, x: b.x, y: b.y, vx: 0, vy: 0, life: 0.35 });
        for (let k = 0; k < density(120); k++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(200, 800);
          parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220, life: rand(0.6, 1.6), hue: rand(30, 58), w: rand(1.5, 3.5) });
        }
      }
    },
    step(p, dt) {
      if (p.glow) {
        p.life -= dt;
        return p.life > 0;
      }
      p.px = p.x;
      p.py = p.y;
      p.vy += 900 * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    },
    draw(ctx, p) {
      if (p.glow) {
        const r = 40 + (0.35 - p.life) * 500;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,250,220,${p.life * 2.6})`);
        g.addColorStop(0.3, `rgba(255,190,60,${p.life * 1.4})`);
        g.addColorStop(1, "rgba(255,120,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.strokeStyle = `hsla(${p.hue}, 100%, ${60 + p.life * 25}%, ${Math.min(1, p.life * 1.5)})`;
      ctx.lineWidth = p.w * Math.min(1, p.life + 0.3);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.px ?? p.x, p.py ?? p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  });
  setTimeout(() => flash.remove(), ms + 500);
}

/** Electric arcs crackling across the screen (nanite resonance field, overloads). */
export function arcs({ duration } = {}) {
  const ms = secs(duration, 3);
  const hum = loopSfx("buzz", { volume: 0.5 });
  const node = mount(`<div class="hg-arcs"><svg viewBox="0 0 ${innerWidth} ${innerHeight}" preserveAspectRatio="none"></svg></div>`);
  const svg = node.querySelector("svg");
  const edge = () => {
    const s = Math.floor(Math.random() * 4);
    const W = innerWidth, H = innerHeight;
    return s === 0 ? [rand(0, W), 0] : s === 1 ? [W, rand(0, H)] : s === 2 ? [rand(0, W), H] : [0, rand(0, H)];
  };
  const bolt = (a, b) => {
    let pts = [a, b];
    for (let g = 0; g < 6; g++) {
      const next = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        next.push(pts[i], [(x1 + x2) / 2 + rand(-0.25, 0.25) * len * 0.5, (y1 + y2) / 2 + rand(-0.25, 0.25) * len * 0.5]);
      }
      next.push(pts[pts.length - 1]);
      pts = next;
    }
    return pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  };
  const t0 = performance.now();
  let lastZap = 0;
  const timer = setInterval(() => {
    const el = performance.now() - t0;
    if (el > ms || !node.isConnected) {
      clearInterval(timer);
      endLoop(hum);
      node.remove();
      return;
    }
    const n = Math.floor(rand(2, 5));
    let html = "";
    const line = (pts, fork = false) => `<polyline points="${pts}" class="hg-bolt-glow${fork ? " hg-fork" : ""}"/><polyline points="${pts}" class="hg-bolt${fork ? " hg-fork" : ""}"/>`;
    for (let i = 0; i < n; i++) {
      const a = edge();
      const b = Math.random() < 0.5 ? edge() : [rand(0.25, 0.75) * innerWidth, rand(0.25, 0.75) * innerHeight];
      html += line(bolt(a, b));
      if (Math.random() < 0.6) {
        const t = rand(0.3, 0.7);
        const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        html += line(bolt(m, [m[0] + rand(-0.25, 0.25) * innerWidth, m[1] + rand(-0.25, 0.25) * innerHeight]), true);
      }
    }
    svg.innerHTML = Math.random() < 0.9 ? html : "";
    if (el - lastZap > 450) {
      lastZap = el;
      playSfx("zap", { volume: 0.6 });
      node.classList.remove("hg-zap");
      void node.offsetWidth;
      node.classList.add("hg-zap");
    }
  }, 75);
}

/** Hologram desync: tearing bands, a rolling bar and colour fringing on the canvas. */
export function desync({ duration } = {}) {
  const ms = secs(duration, 3);
  playSfx("glitch", { volume: 0.7 });
  const bands = Array.from({ length: 7 }, () =>
    `<i style="--top:${rand(0, 95).toFixed(1)}%;--h:${rand(1.5, 9).toFixed(1)}vh;--d:${rand(0.12, 0.4).toFixed(2)}s;--hue:${Math.floor(rand(60, 300))}deg"></i>`).join("");
  const node = mount(`<div class="hg-desync">${bands}<div class="hg-roll"></div><div class="hg-desync-label">РАССИНХРОНИЗАЦИЯ ГОЛОГРАММ</div></div>`);
  const canvasEl = document.getElementById("board");
  if (canvasEl && !reduceMotion()) canvasEl.classList.add("hg-rgbsplit");
  setTimeout(() => {
    canvasEl?.classList.remove("hg-rgbsplit");
    node.remove();
  }, ms);
}

/** System crash: an error screen, a memory dump and a reboot. */
export function crash({ duration } = {}) {
  const ms = secs(duration, 7);
  playSfx("error");
  const lines = [
    "КРИТИЧЕСКАЯ ОШИБКА ЯДРА САДА",
    "",
    "Исключение 0xC31MAK: STAND_IN_NOT_RESPONDING",
    "Модуль: entertainment.core / divinity-deck-7",
    "Рейтинг зрителей: НЕ ОПРЕДЕЛЁН",
    "Попытка удержать участников… УСПЕШНО",
    "",
    "Выполняется дамп памяти:"
  ];
  const node = mount(`<div class="hg-crash">
      <div class="hg-crash-inner">
        <div class="hg-crash-face">:(</div>
        <pre class="hg-crash-text"></pre>
        <div class="hg-crash-bar"><i></i></div>
        <div class="hg-crash-status">0%</div>
      </div>
      ${setting("stickers") === false ? "" : `<img class="hg-crash-host" src="${esc(stickerPath("crying"))}" alt="">`}
    </div>`);
  const pre = node.querySelector(".hg-crash-text");
  let li = 0;
  const typer = setInterval(() => {
    if (li >= lines.length) return clearInterval(typer);
    pre.textContent += `${lines[li++]}\n`;
  }, 180);
  const bar = node.querySelector(".hg-crash-bar i");
  const status = node.querySelector(".hg-crash-status");
  const t0 = performance.now();
  const tick = setInterval(() => {
    const f = Math.min(1, (performance.now() - t0) / (ms * 0.85));
    bar.style.width = `${Math.round(f * 100)}%`;
    status.textContent = f < 0.7 ? `${Math.round(f * 100)}%` : f < 1 ? "ПЕРЕЗАГРУЗКА ЯДРА…" : "ГОТОВО. ШОУ ПРОДОЛЖАЕТСЯ!";
    if (f >= 1) clearInterval(tick);
  }, 120);
  setTimeout(() => playSfx("power-up"), ms * 0.75);
  finish(node, ms, 700);
}

/** Red alert: pulsing red vignette, rotating beacons and a klaxon. */
export function redAlert({ duration, text } = {}) {
  const ms = secs(duration, 6);
  const snd = loopSfx("klaxon", { volume: 0.6 });
  const label = esc(text || "ТРЕВОГА");
  const node = mount(`<div class="hg-redalert">
      <div class="hg-beam hg-beam-l"></div><div class="hg-beam hg-beam-r"></div>
      <div class="hg-redalert-banner"><span>${Array(8).fill(label).join(" · ")} · </span></div>
    </div>`);
  finish(node, ms, 500, () => endLoop(snd));
}

/** Lockdown: blast doors slam shut, hold, and open again. */
export function lockdown({ duration, text } = {}) {
  const ms = secs(duration, 5);
  playSfx("doors");
  const label = esc(text || "ИЗОЛЯЦИЯ СЕКТОРА");
  const node = mount(`<div class="hg-lockdown">
      <div class="hg-door hg-door-top"><div class="hg-door-label"><i class="fa-solid fa-lock"></i> ${label}</div></div>
      <div class="hg-door hg-door-bottom"><div class="hg-door-label">ПРИКАЗ: ${esc(HOST_NAME.toUpperCase())}</div></div>
      <div class="hg-door-light"></div>
    </div>`);
  setTimeout(() => {
    node.classList.add("hg-opening");
    playSfx("whoosh", { volume: 0.7 });
  }, ms);
  setTimeout(() => node.remove(), ms + 1300);
}

/** Celmak's surveillance camera feed overlay. */
export function camera({ duration, label } = {}) {
  const ms = secs(duration, 7);
  playSfx("camera");
  const cam = label || `КАМЕРА ${String(Math.floor(rand(1, 40))).padStart(2, "0")}`;
  const node = mount(`<div class="hg-camera">
      <div class="hg-cam-corners"><i></i><i></i><i></i><i></i></div>
      <div class="hg-cam-top"><span class="hg-cam-rec">● ЗАП</span><span>${esc(cam)}</span><span class="hg-cam-time">00:00:00:00</span></div>
      <div class="hg-cam-cross"></div>
      <div class="hg-cam-bottom"><span>${esc(HOST_NAME.toUpperCase())} НАБЛЮДАЕТ</span><span class="hg-cam-zoom">x1.0</span></div>
    </div>`);
  const time = node.querySelector(".hg-cam-time");
  const zoom = node.querySelector(".hg-cam-zoom");
  const t0 = performance.now();
  const base = Math.floor(rand(0, 3600 * 9));
  const iv = setInterval(() => {
    const el = (performance.now() - t0) / 1000;
    const s = base + el;
    const p = (v) => String(Math.floor(v)).padStart(2, "0");
    time.textContent = `${p(s / 3600)}:${p((s / 60) % 60)}:${p(s % 60)}:${p((el * 25) % 25)}`;
    zoom.textContent = `x${(1 + Math.min(3, el * 0.6)).toFixed(1)}`;
  }, 80);
  finish(node, ms, 500, () => clearInterval(iv));
}

/* ------------------------------------------------------------------ */
/*  Studio                                                             */
/* ------------------------------------------------------------------ */

/** A neon sign ("АПЛОДИСМЕНТЫ", "ТИШИНА", or any text). */
export function neonSign({ text = "АПЛОДИСМЕНТЫ", color = "#ff3cac", sound = "applause", duration } = {}) {
  const ms = secs(duration, 5);
  playSfx("neon", { volume: 0.6 });
  if (sound) setTimeout(() => playSfx(sound), 400);
  fxLayer().querySelectorAll(".hg-neon").forEach((n) => n.remove());
  const node = mount(`<div class="hg-neon" style="--neon:${esc(color)}"><span>${esc(text)}</span></div>`);
  finish(node, ms, 500);
}

/** Big countdown in the middle of the screen. */
export function countdown({ seconds = 10, label = "" } = {}) {
  const total = Math.max(1, Math.min(600, Math.round(Number(seconds) || 10)));
  fxLayer().querySelectorAll(".hg-countdown").forEach((n) => n.remove());
  const node = mount(`<div class="hg-countdown">
      ${label ? `<div class="hg-countdown-label">${esc(label)}</div>` : ""}
      <div class="hg-countdown-num">${total}</div>
    </div>`);
  const num = node.querySelector(".hg-countdown-num");
  let left = total;
  playSfx("tick", { volume: 0.6 });
  const iv = setInterval(() => {
    left -= 1;
    if (!node.isConnected) return clearInterval(iv);
    if (left <= 0) {
      clearInterval(iv);
      num.textContent = "ВРЕМЯ!";
      node.classList.add("hg-done");
      playSfx("buzzer");
      finish(node, 1800, 500);
      return;
    }
    const m = Math.floor(left / 60);
    num.textContent = m ? `${m}:${String(left % 60).padStart(2, "0")}` : String(left);
    node.classList.toggle("hg-urgent", left <= 3);
    num.classList.remove("hg-tick");
    void num.offsetWidth;
    num.classList.add("hg-tick");
    playSfx("tick", { volume: left <= 3 ? 0.9 : 0.5 });
  }, 1000);
}

/** Celmak's Spotlight: darkness with beams locked on positions (canvas coordinates) or the screen centre. */
export function spotlight({ points = [], radius = 120, duration } = {}) {
  fxLayer().querySelectorAll(".hg-spot").forEach((n) => n.remove());
  const ms = secs(duration, 6);
  playSfx("spotlight");
  const cv = document.createElement("canvas");
  cv.className = "hg-spot";
  const ctx = cv.getContext("2d");
  fxLayer().appendChild(cv);
  const toScreen = (p) => {
    const r0 = Number(p.r) || radius;
    try {
      if (p.screen) return { x: p.x * innerWidth, y: p.y * innerHeight, r: r0 };
      const wt = canvas.stage.worldTransform;
      const rect = canvas.app.view.getBoundingClientRect();
      return { x: rect.left + wt.a * p.x + wt.tx, y: rect.top + wt.d * p.y + wt.ty, r: r0 * wt.a };
    } catch {
      return { x: innerWidth / 2, y: innerHeight / 2, r: r0 };
    }
  };
  const targets = points.length ? points : [{ x: 0.5, y: 0.55, screen: true }];
  const starts = targets.map(() => ({ x: rand(0.1, 0.9) * innerWidth, y: rand(0.1, 0.9) * innerHeight }));
  const t0 = performance.now();
  const frame = (now) => {
    if (!cv.isConnected) return;
    const el = now - t0;
    if (cv.width !== innerWidth || cv.height !== innerHeight) {
      cv.width = innerWidth;
      cv.height = innerHeight;
    }
    const fadeIn = Math.min(1, el / 300);
    const fadeOut = el > ms ? Math.max(0, 1 - (el - ms) / 500) : 1;
    const k = Math.min(1, el / 1100);
    const ease = 1 - Math.pow(1 - k, 3);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = `rgba(0,0,0,${0.82 * fadeIn * fadeOut})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
    const spots = targets.map((tg, i) => {
      const s = toScreen(tg);
      const wob = (1 - ease) * 40;
      return { x: starts[i].x + (s.x - starts[i].x) * ease + Math.sin(el / 90 + i) * wob, y: starts[i].y + (s.y - starts[i].y) * ease, r: Math.max(40, s.r) };
    });
    ctx.globalCompositeOperation = "destination-out";
    for (const s of spots) {
      const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.6, s.x, s.y, s.r * 1.25);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    for (const s of spots) {
      const src = { x: s.x < innerWidth / 2 ? innerWidth * 0.15 : innerWidth * 0.85, y: -20 };
      const g = ctx.createLinearGradient(src.x, src.y, s.x, s.y);
      g.addColorStop(0, `rgba(255,245,200,${0.22 * fadeOut})`);
      g.addColorStop(1, `rgba(255,245,200,${0.05 * fadeOut})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(src.x - 18, src.y);
      ctx.lineTo(src.x + 18, src.y);
      ctx.lineTo(s.x + s.r, s.y);
      ctx.lineTo(s.x - s.r, s.y);
      ctx.closePath();
      ctx.fill();
    }
    if (el < ms + 500) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/*  Scenes                                                             */
/* ------------------------------------------------------------------ */

/** Stage smoke rising from the floor (Stagehand Drones). */
export function smoke({ duration } = {}) {
  const ms = secs(duration, 8);
  playSfx("gas", { volume: 0.7 });
  const blobs = Array.from({ length: density(12) }, (_, i) =>
    `<i style="--x:${rand(-5, 105).toFixed(0)}%;--s:${rand(30, 60).toFixed(0)}vmax;--t:${rand(5, 9).toFixed(1)}s;--delay:${(i * 0.25).toFixed(2)}s"></i>`).join("");
  const node = mount(`<div class="hg-smoke">${blobs}</div>`);
  finish(node, ms, 1500);
}

const SEASONS = {
  spring: { label: "ВЕСНА", sub: "Пыльца: три выброса газа настроения (СЛ 22)", sound: "chimes", tint: "rgba(255,160,210,0.12)" },
  summer: { label: "ЛЕТО", sub: "Тепловые лампы: 4d6 огнём (Стойкость СЛ 22, половина)", sound: "cicadas", tint: "rgba(255,150,40,0.16)" },
  autumn: { label: "ОСЕНЬ", sub: "Листья-клинки: 4d6 рубящего (Реакция СЛ 22, половина)", sound: "wind", tint: "rgba(200,90,30,0.12)" },
  winter: { label: "ЗИМА", sub: "Хладагент: 4d6 холодом (Стойкость СЛ 22, половина); земля покрывается инеем", sound: "wind", tint: "rgba(160,210,255,0.14)" }
};

/** The Hollow Garden's turning seasons, with particles and the season's rules line. */
export function season({ kind = "spring", duration, showRules = true } = {}) {
  const ms = secs(duration, 8);
  const S = SEASONS[kind] ?? SEASONS.spring;
  const snd = S.sound === "chimes" ? playSfx("chimes", { volume: 0.6 }) : loopSfx(S.sound, { volume: 0.6 });
  const node = mount(`<div class="hg-season hg-season-${kind}" style="--tint:${S.tint}">
      ${kind === "summer" ? `<div class="hg-sun"></div><div class="hg-haze"></div>` : ""}
      ${kind === "winter" ? `<div class="hg-frost"></div>` : ""}
      <div class="hg-season-label"><small>СЕЗОН МЕНЯЕТСЯ</small><strong>${S.label}</strong>${showRules ? `<span>${esc(S.sub)}</span>` : ""}</div>
    </div>`);
  const cfg = {
    spring: { rate: 40, make: () => ({ x: rand(-50, innerWidth), y: -20, vx: rand(20, 70), vy: rand(40, 90), r: rand(5, 10), rot: rand(0, 6), vr: rand(-2, 2), sway: rand(0, 6), col: pick(["#ffc0dc", "#ff9cc8", "#fff0f6", "#ffd1e6"]), kind: Math.random() < 0.25 ? "pollen" : "petal" }) },
    summer: { rate: 14, make: () => ({ x: rand(0, innerWidth), y: innerHeight + 10, vx: rand(-10, 10), vy: rand(-40, -15), r: rand(1.5, 3), sway: rand(0, 6), col: "#ffe9a8", kind: "pollen" }) },
    autumn: { rate: 55, make: () => ({ x: -30, y: rand(-0.2, 0.9) * innerHeight, vx: rand(380, 700), vy: rand(60, 200), r: rand(7, 13), rot: rand(0, 6), vr: rand(-8, 8), sway: rand(0, 6), col: pick(["#d2691e", "#b8401b", "#e8a33d", "#8b3a12", "#c9781f"]), kind: "leaf" }) },
    winter: { rate: 90, make: () => ({ x: rand(-100, innerWidth), y: -10, vx: rand(20, 80), vy: rand(60, 160), r: rand(1.5, 4), sway: rand(0, 6), col: "#ffffff", kind: "snow" }) }
  }[kind] ?? null;
  let acc = 0;
  if (cfg) {
    particles({
      duration: ms,
      spawn(parts, dt) {
        acc += dt * density(cfg.rate);
        while (acc >= 1) {
          parts.push(cfg.make());
          acc -= 1;
        }
      },
      step(p, dt) {
        p.sway += dt * 2;
        p.x += (p.vx + Math.sin(p.sway) * 30) * dt;
        p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        return true;
      },
      draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.kind === "petal") {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "leaf") {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.moveTo(-p.r, 0);
          ctx.quadraticCurveTo(0, -p.r * 0.7, p.r, 0);
          ctx.quadraticCurveTo(0, p.r * 0.7, -p.r, 0);
          ctx.fill();
          ctx.strokeStyle = "rgba(60,20,0,0.5)";
          ctx.beginPath();
          ctx.moveTo(-p.r, 0);
          ctx.lineTo(p.r, 0);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.col;
          ctx.globalAlpha = p.kind === "pollen" ? 0.75 : 0.9;
          ctx.shadowColor = p.col;
          ctx.shadowBlur = p.kind === "pollen" ? 8 : 4;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }
  finish(node, ms, 1200, () => endLoop(snd));
}

/** The Drift jump: star streaks from the centre and a white-out. */
export function warp({ duration } = {}) {
  const ms = secs(duration, 3.2);
  playSfx("warp");
  const tint = mount(`<div class="hg-warp-tint"></div>`);
  particles({
    duration: ms,
    composite: "lighter",
    spawn(parts, dt, life) {
      const n = density(Math.round(120 + 600 * life)) * dt;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const d0 = rand(5, 60);
        parts.push({ a, d: d0, v: rand(100, 300), life });
      }
    },
    step(p, dt) {
      p.pd = p.d;
      p.v *= 1 + dt * (2 + p.life * 6);
      p.d += p.v * dt;
      p.x = innerWidth / 2 + Math.cos(p.a) * p.d;
      p.y = innerHeight / 2 + Math.sin(p.a) * p.d;
      return p.d < Math.hypot(innerWidth, innerHeight);
    },
    draw(ctx, p) {
      const cx = innerWidth / 2;
      const cy = innerHeight / 2;
      ctx.strokeStyle = `rgba(${200 + Math.floor(rand(0, 55))},${200 + Math.floor(rand(0, 55))},255,0.85)`;
      ctx.lineWidth = 1 + p.life * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(p.a) * (p.pd ?? p.d), cy + Math.sin(p.a) * (p.pd ?? p.d));
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  });
  setTimeout(() => {
    const flash = mount(`<div class="hg-whiteout"></div>`);
    setTimeout(() => flash.remove(), 1400);
  }, ms - 150);
  setTimeout(() => tint.remove(), ms + 300);
}

/** Dimensional anchor pulse: shockwave rings from the centre. */
export function lockPulse({ text } = {}) {
  playSfx("shockwave");
  const node = mount(`<div class="hg-pulse"><i></i><i></i><i></i><div class="hg-pulse-label">${esc(text || "ИЗМЕРЕНИЯ ЗАПЕРТЫ")}</div></div>`);
  finish(node, 2200, 600);
}

/** Buffering: a frozen, darkened frame with a spinner that stalls at 99%. */
export function buffering({ duration } = {}) {
  const ms = secs(duration, 6);
  playSfx("error", { volume: 0.4 });
  const node = mount(`<div class="hg-buffering">
      <div class="hg-buffer-ring"></div>
      <div class="hg-buffer-text">БУФЕРИЗАЦИЯ… <span>0%</span></div>
      <small>Слабый сигнал. ${esc(HOST_NAME)} уже работает над этим.</small>
    </div>`);
  const pct = node.querySelector("span");
  const t0 = performance.now();
  const iv = setInterval(() => {
    if (!node.isConnected) return clearInterval(iv);
    const f = (performance.now() - t0) / ms;
    pct.textContent = `${f < 0.35 ? Math.round(f / 0.35 * 87) : f < 0.9 ? 99 : 100}%`;
  }, 150);
  finish(node, ms, 400, () => clearInterval(iv));
}

/** Gravity plating failure: the whole view tilts and sways like a ship in a storm. */
export function gravity({ duration } = {}) {
  const ms = secs(duration, 5);
  playSfx("power-down", { volume: 0.6 });
  const node = mount(`<div class="hg-gravity-label"><i class="fa-solid fa-arrow-down-up-across-line"></i> СБОЙ ГРАВИТАЦИИ</div>`);
  const targets = [document.getElementById("board"), document.getElementById("hg-board")].filter(Boolean);
  if (!reduceMotion()) for (const t of targets) t.classList.add("hg-gravity");
  setTimeout(() => {
    for (const t of targets) t.classList.remove("hg-gravity");
    playSfx("power-up", { volume: 0.6 });
  }, ms);
  finish(node, ms, 400);
}

/** Breaking-news crawl at the bottom of the screen. */
export function ticker({ text = "", duration } = {}) {
  const ms = secs(duration, 12);
  playSfx("on-air", { volume: 0.6 });
  fxLayer().querySelectorAll(".hg-ticker").forEach((n) => n.remove());
  const line = esc(text || `${HOST_NAME} напоминает: никто не уходит раньше финала!`);
  const node = mount(`<div class="hg-ticker"><div class="hg-ticker-tag">СРОЧНО</div>
      <div class="hg-ticker-track"><span>${line} · ${line} · ${line} · </span></div></div>`);
  finish(node, ms, 500);
}

/** Stop every running effect on this client: overlays, particles, loops, countdowns. */
export function stopAll() {
  for (const h of loops) stopSfx(h);
  loops.clear();
  const layer = fxLayer();
  for (const n of [...layer.children]) n.remove();
  for (const t of [document.getElementById("board"), document.getElementById("hg-board")].filter(Boolean)) {
    t.classList.remove("hg-rgbsplit", "hg-gravity", "hg-shake", "hg-shake-2");
  }
  for (const fn of stopHooks) {
    try {
      fn();
    } catch (err) {
      console.warn("Hollow Garden | stop hook failed", err);
    }
  }
}

const stopHooks = new Set();
/** Let other effect modules (commercials) clean up when everything is stopped. */
export function onStopAll(fn) {
  stopHooks.add(fn);
}

/** Dispatch table registered with the socket in main.js. */
export const FX_EXTRA = {
  buffering,
  gravity,
  ticker,
  "fx-stop": stopAll,
  blackout,
  static: staticNoise,
  nosignal: noSignal,
  sparks,
  arcs,
  desync,
  crash,
  redalert: redAlert,
  lockdown,
  camera,
  sign: neonSign,
  countdown,
  spotlight,
  smoke,
  season,
  warp,
  lockpulse: lockPulse
};
