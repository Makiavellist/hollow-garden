/**
 * The Hollow Garden: Звёздные Искатели — Foundry VTT v13 module for Pathfinder 1e.
 * Ratings board, Producer Console, rigged episode wheel, audience votes, soundboard and host stickers.
 */
import { EPISODES, MODULE_ID, defaultState, starring } from "./constants.js";
import { playSfx, preloadSounds } from "./audio.js";
import { RatingsBoard } from "./board.js";
import { FX } from "./fx.js";
import { broadcast, initSocket, registerHandler } from "./socket.js";
import {
  adjustContestant, adjustShow, getState, handleStateChange, markSeen, onStateChange, setCurrentEpisode, setVisible, toggleVisible
} from "./state.js";
import { awardTrinket, bindChatButtons, moodGas, promptGM, reactToEvent, runEscalation } from "./rules.js";
import { AnnounceDesk } from "./apps/announce.js";
import { ProducerConsole } from "./apps/console.js";
import { ContestantsConfig } from "./apps/contestants.js";
import { RouletteDesk } from "./apps/roulette.js";
import { VoteDesk } from "./apps/vote.js";
import { HoneypotDesk } from "./apps/honeypot.js";
import { isGM } from "./util.js";

for (const [type, fn] of Object.entries(FX)) registerHandler(type, fn);

function requireGM() {
  if (isGM()) return true;
  ui.notifications.warn("Only the GM can run the show.");
  return false;
}

const open = new Map();
function openApp(Cls) {
  if (!requireGM()) return;
  const existing = open.get(Cls);
  if (existing?.rendered) {
    existing.bringToFront?.();
    return existing;
  }
  const app = new Cls();
  open.set(Cls, app);
  app.render({ force: true });
  return app;
}

const api = {
  getState,
  openConsole(tab) {
    if (!requireGM()) return;
    const app = ProducerConsole.instance;
    app.setTab(tab);
    app.render({ force: true });
  },
  openContestants: () => openApp(ContestantsConfig),
  openRoulette: () => openApp(RouletteDesk),
  openVote: () => openApp(VoteDesk),
  openHoneypot: () => openApp(HoneypotDesk),
  toggleBoard: () => requireGM() && toggleVisible(),
  showBoard: (v = true) => requireGM() && setVisible(v),
  adjustShow: (d, reason) => requireGM() && adjustShow(d, reason),
  adjustContestant: (id, d, reason) => requireGM() && adjustContestant(id, d, reason),
  awardTrinket: (cid) => requireGM() && awardTrinket(cid),
  moodGas: (opts) => requireGM() && moodGas(opts),
  titleCard: (kind, data = {}) => requireGM() && broadcast("title", { kind, ...data }),
  async episodeTitle(id) {
    if (!requireGM()) return;
    const idx = EPISODES.findIndex((e) => e.id === id);
    const ep = EPISODES[idx];
    if (!ep) return;
    const state = getState();
    const fin = ep.id === "finale";
    broadcast("title", { kind: fin ? "finale" : "episode", kicker: fin ? undefined : `ЭПИЗОД ${idx + 1}`,
      title: ep.ru.toUpperCase(), starring: starring(ep, state.contestants) });
    if (state.current !== id) await setCurrentEpisode(id);
  },
  /** GM approval desk for ratings announcements ("peak", "escalation" or "custom"). */
  openAnnounce(kind = "custom", extra = {}) {
    if (!requireGM()) return;
    const existing = open.get(AnnounceDesk);
    const app = existing?.rendered ? existing : new AnnounceDesk();
    open.set(AnnounceDesk, app);
    app.setKind(kind, extra);
    app.render({ force: true });
    return app;
  },
  escalate: (kind) => requireGM() && runEscalation(kind),
  confetti: () => requireGM() && broadcast("confetti", { sound: "confetti" }),
  glitch: () => requireGM() && broadcast("glitch", {}),
  cue: (id) => requireGM() && broadcast("cue", { id }),
  sticker: (name, caption = "") => requireGM() && broadcast("sticker", { sticker: name, caption }),
  say: (text, persona = "Host") => requireGM() && broadcast("caption", { text, persona }),
  resetBoardPosition: () => RatingsBoard.instance.resetPosition(),
  broadcast
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: defaultState(),
    onChange: (value) => handleStateChange(value)
  });
  game.settings.register(MODULE_ID, "promptAtThresholds", {
    name: "Offer an announcement at Show Rating 5 and 1",
    hint: "When the rating reaches 5 or 1, open the (GM-only) announcement desk with a suggested message. Nothing is shown to players unless you press Broadcast.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "linkRatings", {
    name: "Link fan meters to the Show Rating",
    hint: "Raising or lowering a contestant's fans also moves the Show Rating by 1 in the same direction. Right-click the +/– buttons on the board to skip it once.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "sfxVolume", {
    name: "Громкость студии / Studio volume",
    hint: "Громкость звуков шоу только на этом компьютере. Также регулируется ползунком на табло и в панели плейлистов. / Gameshow sound volume on this computer only.",
    scope: "client", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.8,
    onChange: () => syncVolumeSliders()
  });
  game.settings.register(MODULE_ID, "stickers", {
    name: "Стикеры ведущей / Host stickers",
    hint: "Показывать всплывающие стикеры ведущей на этом компьютере.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "reduceMotion", {
    name: "Меньше анимации / Reduce motion",
    hint: "Без тряски экрана, меньше конфетти, быстрое колесо.",
    scope: "client", config: true, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, "boardPos", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "boardCompact", { scope: "client", config: false, type: Boolean, default: true });
  game.settings.register(MODULE_ID, "boardDock", { scope: "client", config: false, type: String, default: "top-right" });
  game.settings.registerMenu(MODULE_ID, "contestantsMenu", {
    name: "Contestants",
    label: "Cast the show",
    hint: "Names, linked actors, portraits and starting fans for the ratings board.",
    icon: "fa-solid fa-users",
    type: ContestantsConfig,
    restricted: true
  });

  game.keybindings.register(MODULE_ID, "console", {
    name: "Open the Producer Console", editable: [], restricted: true,
    onDown: () => { api.openConsole(); return true; }
  });
  game.keybindings.register(MODULE_ID, "board", {
    name: "Toggle the ratings board for everyone", editable: [], restricted: true,
    onDown: () => { api.toggleBoard(); return true; }
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  mod.api = api;
  initSocket();
  preloadSounds();
  markSeen(getState());
  const board = RatingsBoard.instance;
  board.mount();
  const safe = (label, fn) => {
    try {
      const r = fn();
      if (r?.catch) r.catch((err) => console.error(`Hollow Garden | ${label} failed`, err));
    } catch (err) {
      console.error(`Hollow Garden | ${label} failed`, err);
    }
  };
  onStateChange((state, ev) => {
    safe("board", () => board.render(state));
    safe("console", () => ProducerConsole.instance.rendered && ProducerConsole.instance.render());
    safe("effects", () => reactToEvent(state, ev));
    safe("prompt", () => promptGM(state, ev));
  });
  window.addEventListener("resize", foundry.utils.debounce(() => {
    board.applyPosition();
    board.render(getState(), { initial: true });
  }, 200));
  console.log("Hollow Garden | The doors are open and the stakes are personal.");
});

/* Scene controls: two buttons in the Token toolbar for the GM. */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const tools = {
    hgConsole: { name: "hgConsole", title: "Hollow Garden: Producer Console", icon: "fa-solid fa-tower-broadcast", order: 90, button: true, visible: true,
      onChange: () => api.openConsole() },
    hgBoard: { name: "hgBoard", title: "Hollow Garden: Ratings board on/off", icon: "fa-solid fa-ranking-star", order: 91, button: true, visible: true,
      onChange: () => api.toggleBoard() }
  };
  if (Array.isArray(controls)) {
    const token = controls.find((c) => c.name === "token");
    for (const t of Object.values(tools)) token?.tools.push({ ...t, onClick: t.onChange });
    return;
  }
  const token = controls.tokens ?? controls.token;
  if (!token?.tools) return;
  Object.assign(token.tools, tools);
});

Hooks.on("renderChatMessageHTML", (message, html) => bindChatButtons(message, html));

/* Everyone gets a studio volume slider in the Playlists sidebar as well as on the board. */
function syncVolumeSliders() {
  const v = Math.round(Number(game.settings.get(MODULE_ID, "sfxVolume") ?? 0.8) * 100);
  for (const r of document.querySelectorAll("[data-hg-volume]")) r.value = String(v);
  for (const l of document.querySelectorAll(".hg-vol-val")) l.textContent = `${v}%`;
}

function injectPlaylistVolume(app, html) {
  try {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? app?.element;
    if (!root || root.querySelector(".hg-playlist-volume")) return;
    const v = Math.round(Number(game.settings.get(MODULE_ID, "sfxVolume") ?? 0.8) * 100);
    const box = document.createElement("div");
    box.className = "hg-playlist-volume";
    box.innerHTML = `<label title="Звуки шоу «Полый Сад» — только у вас"><i class="fa-solid fa-tower-broadcast"></i> Студия
        <input type="range" min="0" max="100" step="5" value="${v}" data-hg-volume></label><span class="hg-vol-val">${v}%</span>`;
    box.querySelector("input").addEventListener("change", async (ev) => {
      await game.settings.set(MODULE_ID, "sfxVolume", Number(ev.target.value) / 100);
      playSfx("correct", { volume: 0.8 });
    });
    box.querySelector("input").addEventListener("input", (ev) => (box.querySelector(".hg-vol-val").textContent = `${ev.target.value}%`));
    const anchor = root.querySelector(".global-volume, #global-volume, .playlists-volume, header.directory-header");
    if (anchor) anchor.after(box);
    else root.prepend(box);
  } catch (err) {
    console.warn("Hollow Garden | could not add the volume slider to the Playlists sidebar", err);
  }
}
Hooks.on("renderPlaylistDirectory", injectPlaylistVolume);
