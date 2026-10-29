// Minimal Foundry VTT v13 API stand-in so the module's UI can be exercised in a plain browser.
// Only what the module touches is implemented. Not shipped with the module.
const params = new URLSearchParams(location.search);
const IS_GM = params.get("gm") !== "0";
const docs = await (await fetch("modules/hollow-garden/tools/harness/docs.json")).json();
window.__log = [];

const deepClone = (o) => {
  if (o === null || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(deepClone);
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deepClone(v)]));
};
function mergeObject(target, source, { inplace = true } = {}) {
  const out = inplace ? target : deepClone(target);
  for (const [k, v] of Object.entries(source ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) out[k] = mergeObject(out[k], v, { inplace: true });
    else out[k] = deepClone(v);
  }
  return out;
}

class ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: [], window: { title: "" }, position: {}, actions: {} };
  static #z = 100;
  constructor(options = {}) {
    let chain = [];
    let c = this.constructor;
    while (c && c !== Object) { if (Object.hasOwn(c, "DEFAULT_OPTIONS")) chain.unshift(c.DEFAULT_OPTIONS); c = Object.getPrototypeOf(c); }
    this.options = chain.reduce((acc, o) => {
      const merged = mergeObject(acc, o, { inplace: false });
      merged.classes = [...new Set([...(acc.classes ?? []), ...(o.classes ?? [])])];
      merged.actions = { ...(acc.actions ?? {}), ...(o.actions ?? {}) };
      return merged;
    }, {});
    Object.assign(this.options, options);
    this.element = null;
  }
  get rendered() { return !!this.element?.isConnected; }
  async _prepareContext() { return {}; }
  _onRender() {}
  async render() {
    const ctx = await this._prepareContext({});
    if (!this.element) {
      const w = document.createElement("div");
      w.className = ["application", ...this.options.classes].join(" ");
      w.id = this.options.id ?? "";
      const p = this.options.position ?? {};
      w.style.cssText = `position:fixed;left:${40 + Math.random() * 20}px;top:${60}px;width:${p.width ?? 500}px;${p.height && p.height !== "auto" ? `height:${p.height}px;` : ""}z-index:${ApplicationV2.#z++};display:flex;flex-direction:column;border-radius:8px;overflow:hidden;box-shadow:0 0 20px #000;`;
      w.innerHTML = `<header class="window-header" style="display:flex;gap:8px;padding:6px 10px;align-items:center"><i class="${this.options.window?.icon ?? ""}"></i><h1 class="window-title" style="margin:0;font-size:14px;flex:1">${this.options.window?.title ?? ""}</h1><button data-close>✕</button></header><section class="window-content" style="flex:1;overflow:auto"></section>`;
      document.body.appendChild(w);
      w.querySelector("[data-close]").onclick = () => this.close();
      w.addEventListener("click", (ev) => {
        const t = ev.target.closest("[data-action]");
        if (!t || !w.contains(t)) return;
        const h = this.options.actions[t.dataset.action];
        if (h) h.call(this, ev, t);
      });
      this.element = w;
    }
    const content = this.element.querySelector(".window-content");
    const res = await this._renderHTML(ctx, {});
    this._replaceHTML(res, content, {});
    this._onRender(ctx, {});
    return this;
  }
  async close() { this.element?.remove(); this.element = null; }
}

class DialogV2 { static async confirm() { return true; } }

window.foundry = {
  applications: { api: { ApplicationV2, DialogV2 }, apps: { FilePicker: { implementation: class { constructor(o) { this.o = o; } render() { this.o.callback?.("icons/svg/mystery-man.svg"); } } } } },
  utils: {
    mergeObject, deepClone, randomID: () => Math.random().toString(36).slice(2, 18),
    debounce: (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  },
  audio: {
    AudioHelper: {
      play({ src, volume }) { window.__log.push(["sound", src, volume]); const a = new Audio(src); a.volume = volume; a.play().catch(() => {}); return a; },
      preloadSound: async (src) => { window.__log.push(["preload", src]); }
    }
  }
};

const store = {};
const regs = {};
const hooks = {};
window.Hooks = {
  once: (n, f) => (hooks[n] ??= []).push(f),
  on: (n, f) => (hooks[n] ??= []).push(f),
  callAll: (n, ...a) => (hooks[n] ?? []).forEach((f) => f(...a))
};
const users = [{ id: "u1", isGM: IS_GM, name: "Tester" }];
window.ui = { notifications: { info: (m) => window.__log.push(["info", m]), warn: (m) => window.__log.push(["warn", m]) } };
const chatLog = document.createElement("div");
chatLog.id = "fake-chat";
chatLog.style.cssText = "position:fixed;right:0;top:0;width:300px;height:100vh;overflow:auto;background:#222;padding:6px;z-index:5;";
document.body.appendChild(chatLog);
window.ChatMessage = {
  create: async (data) => {
    const d = document.createElement("div");
    d.style.cssText = "margin-bottom:8px;";
    d.innerHTML = (data.whisper ? "<em style='color:#aaa'>(whisper)</em>" : "") + data.content.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "<a>$1</a>");
    chatLog.prepend(d);
    const msg = { flags: data.flags ?? {}, content: data.content };
    Hooks.callAll("renderChatMessageHTML", msg, d);
    return msg;
  },
  getSpeaker: () => ({})
};
window.Roll = class {};
window.canvas = { tokens: { controlled: [] } };

function tableDoc(t) {
  return {
    ...t,
    async roll() {
      const n = t.results.length;
      const r = 1 + Math.floor(Math.random() * n);
      const res = t.results.find((x) => x.range[0] <= r && r <= x.range[1]);
      return { roll: { total: r }, results: [res] };
    }
  };
}
window.fromUuid = async (uuid) => {
  const id = uuid.split(".").pop();
  if (uuid.includes("RollTable")) return docs.tables[id] ? tableDoc(docs.tables[id]) : null;
  if (uuid.startsWith("Actor.")) return window.__actors.find((a) => a.uuid === uuid) ?? null;
  if (uuid.includes(".Item.")) {
    const d = docs.items[id];
    return d ? { ...d, uuid, toObject: () => deepClone(d) } : null;
  }
  return null;
};

window.game = {
  user: users[0],
  users: Object.assign(users, { activeGM: IS_GM ? users[0] : null }),
  settings: {
    register(mod, key, cfg) { regs[`${mod}.${key}`] = cfg; if (!(`${mod}.${key}` in store)) store[`${mod}.${key}`] = deepClone(cfg.default); },
    registerMenu() {},
    get(mod, key) { return deepClone(store[`${mod}.${key}`]); },
    async set(mod, key, v) { store[`${mod}.${key}`] = deepClone(v); regs[`${mod}.${key}`]?.onChange?.(deepClone(v)); return v; }
  },
  keybindings: { register() {} },
  modules: new Map([["hollow-garden", { id: "hollow-garden" }]]),
  socket: { on() {}, emit: (...a) => window.__log.push(["socket", ...a]) },
  actors: { contents: window.__actors = [
    { uuid: "Actor.a1", id: "a1", documentName: "Actor", name: "Bodnar (PC)", type: "character", hasPlayerOwner: true, img: "icons/svg/mystery-man.svg", sheet: { render: () => window.__log.push(["sheet", "a1"]) }, createEmbeddedDocuments: async (t, d) => window.__log.push(["created", t, d[0].name]) },
    { uuid: "Actor.a2", id: "a2", documentName: "Actor", name: "Ryuz (PC)", type: "character", hasPlayerOwner: true, img: "icons/svg/mystery-man.svg", sheet: { render: () => {} }, createEmbeddedDocuments: async () => {} }
  ] },
  i18n: { localize: (s) => s, format: (s) => s }
};
