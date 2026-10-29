/**
 * The Hollow Garden: Season of Horrors — Foundry VTT v13 module for Pathfinder 1e.
 * Ratings board, Producer Console, rigged episode wheel, audience votes, soundboard and host stickers.
 */
import { EPISODES, MODULE_ID, defaultState } from "./constants.js";
import { preloadSounds } from "./audio.js";
import { RatingsBoard } from "./board.js";
import { FX } from "./fx.js";
import { broadcast, initSocket, registerHandler } from "./socket.js";
import {
  adjustContestant, adjustShow, getState, handleStateChange, markSeen, onStateChange, setCurrentEpisode, setVisible, toggleVisible
} from "./state.js";
import { automate, awardTrinket, bindChatButtons, moodGas, reactToEvent } from "./rules.js";
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
    const c = state.contestants.find((x) => x.id === ep.contestant);
    const starring = c ? `${c.name} · ${ep.spotlight}` : ep.spotlight;
    broadcast("title", { kind: ep.id === "finale" ? "finale" : "episode", kicker: ep.id === "finale" ? "THE HOLLOW GARDEN" : `EPISODE ${idx + 1}`,
      title: ep.title.toUpperCase(), starring, subtitle: ep.id === "finale" ? "Every season needs a finale, and every finale needs a twist." : "" });
    if (state.current !== id) await setCurrentEpisode(id);
  },
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
  game.settings.register(MODULE_ID, "automation", {
    name: "Automate Celmak's ratings rules",
    hint: "At 5 the studio celebrates, the GM gets an Award Trinket card, and the rating resets to 3. At 1 the GM gets an escalation card and it resets to 2.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "linkRatings", {
    name: "Link fan meters to the Show Rating",
    hint: "Raising or lowering a contestant's fans also moves the Show Rating by 1 in the same direction. Right-click the +/– buttons on the board to skip it once.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "sfxVolume", {
    name: "Studio sound volume",
    hint: "Volume of the gameshow sound effects on this computer.",
    scope: "client", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.8
  });
  game.settings.register(MODULE_ID, "stickers", {
    name: "Show host stickers",
    hint: "Pop-up stickers of the host on this computer.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "reduceMotion", {
    name: "Reduce motion",
    hint: "Fewer animations: no screen shake, less confetti, a quick wheel.",
    scope: "client", config: true, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, "boardPos", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "boardCompact", { scope: "client", config: false, type: Boolean, default: false });
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
    safe("automation", () => automate(state, ev));
  });
  window.addEventListener("resize", foundry.utils.debounce(() => board.render(getState(), { initial: true }), 200));
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
