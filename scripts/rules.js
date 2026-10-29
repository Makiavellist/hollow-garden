import { ACTORS, EPISODES, HOST_NAME, MODULE_ID, MOOD_GAS, SHOW_RESPONSES, TABLES, sticker } from "./constants.js";
import { broadcast } from "./socket.js";
import { adjustContestant, adjustShow, getState, topContestants } from "./state.js";
import { chatCard, drawTable, esc, isActiveGM, resultText, resultUuid, setting } from "./util.js";

/* ------------------------------------------------------------------ */
/*  Rating changes are silent for players. The GM is only *offered*    */
/*  an announcement when the Show Rating reaches 5 or 1.               */
/* ------------------------------------------------------------------ */

export function reactToEvent(_state, _ev) {
  // Intentionally quiet: the board updates in place, nothing pops up for players.
}

export async function promptGM(state, ev) {
  if (!ev || !isActiveGM() || setting("promptAtThresholds") === false) return;
  const show = ev.show;
  if (!show || show.from === show.to || ev.type === "reset") return;
  const api = game.modules.get(MODULE_ID).api;
  if (show.to === 5 && show.from < 5) api.openAnnounce("peak");
  else if (show.to === 1 && show.from > 1) api.openAnnounce("escalation");
}

/* ------------------------------------------------------------------ */
/*  Trinkets                                                           */
/* ------------------------------------------------------------------ */

export async function awardTrinket(cid = null, { announce = true } = {}) {
  const state = getState();
  let c = cid ? state.contestants.find((x) => x.id === cid) : null;
  if (!c) c = topContestants(state)[0] ?? null;
  const drawn = await drawTable(TABLES.trinkets);
  if (!drawn) return;
  const result = drawn.results[0];
  const uuid = resultUuid(result);
  const doc = uuid ? await fromUuid(uuid) : null;
  let given = false;
  if (doc && c?.actorUuid) {
    const actor = await fromUuid(c.actorUuid);
    if (actor) {
      const data = doc.toObject();
      delete data._id;
      data._stats = { ...(data._stats ?? {}), compendiumSource: doc.uuid };
      const res = await actor.createEmbeddedDocuments("Item", [data]);
      given = (Array.isArray(res) ? res[0] : null) ?? true;
    }
  }
  const name = doc?.name ?? result?.name ?? "приз";
  if (announce) {
    broadcast("sticker", { sticker: "trophy", sound: "fanfare", caption: `${c?.name ?? "Участник"} получает: ${name}!` });
    broadcast("confetti", {});
  }
  await chatCard({
    title: "И приз получает…",
    sticker: sticker("trophy"),
    // Link the copy on the sheet: players can't open the GM-only compendium.
    body: `<p><strong>${esc(c?.name ?? "любимец публики")}</strong> получает ${given?.uuid ? `@UUID[${given.uuid}]{${esc(name)}}` : `<strong>${esc(name)}</strong>`}!</p>`
  });
  if (!given) {
    await chatCard({
      title: "Trinket not added to a sheet",
      whisper: true,
      body: `<p>${c?.actorUuid ? "The linked actor could not be found." : `No actor is linked to ${esc(c?.name ?? "this contestant")}.`} Hand the item over manually, or link an actor in <em>Contestants…</em>.</p>`
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Mood Gas                                                           */
/* ------------------------------------------------------------------ */

export async function moodGas({ dc = 22, roll = null } = {}) {
  let r = roll;
  if (!r) {
    const drawn = await drawTable(TABLES["mood-gas"]);
    r = drawn?.roll?.total ?? Math.ceil(Math.random() * 6);
  }
  const g = MOOD_GAS[r] ?? MOOD_GAS[1];
  broadcast("gas", { roll: r, dc });
  await chatCard({
    title: `Газ настроения: ${g.ru.toLowerCase()}`,
    sticker: sticker("smug"),
    body: `<p class="hg-gas-chip" style="--gas:${g.color}">d6 = ${r}</p>
      <p>Существа в радиусе 20 футов: <strong>Стойкость СЛ ${dc}</strong>, чтобы не вдохнуть дозу (задержать дыхание можно, если вы действовали раньше),
      затем <strong>Воля СЛ ${dc}</strong> против эффекта на 1d4+1 раундов. Андроиды добавляют свой расовый бонус; не дышащие существа невосприимчивы.</p>`
  });
  await chatCard({ title: `Mood Gas: ${g.name}`, whisper: true, body: `<p>${esc(g.text)}</p>` });
}

/* ------------------------------------------------------------------ */
/*  Honeypots (GM-only results; the laugh is the GM's call)            */
/* ------------------------------------------------------------------ */

export async function resolveHoneypot({ total, natural, cid = null, actorName = "" }) {
  total = Number(total);
  natural = Number(natural);
  const who = actorName || "The contestant";
  if (total >= 61) {
    await chatCard({ title: "Honeypot: the real answer", sticker: sticker("shocked"), whisper: true,
      body: `<p>${esc(who)} rolled <strong>${total}</strong> (natural ${natural}): <strong>61 or higher</strong>. They learn the real answer, as described in the scene.</p>` });
    return "real";
  }
  if (natural <= 10) {
    const drawn = await drawTable(TABLES.amusing);
    await chatCard({ title: "Honeypot: an obvious fake", sticker: sticker("joy"), whisper: true,
      body: `<p>${esc(who)} rolled <strong>${total}</strong> (natural ${natural}). By the book, Celmak laughs and the ratings rise by 1.</p>
        <blockquote>${resultText(drawn?.results?.[0])}</blockquote>`,
      buttons: [{ action: "laugh", label: "Celmak laughs (+1 rating)", icon: "fa-solid fa-face-laugh-squint", data: { cid: cid ?? "" } }] });
    return "amusing";
  }
  const drawn = await drawTable(TABLES.detrimental);
  await chatCard({ title: "Honeypot: a convincing fake", sticker: sticker("smug"), whisper: true,
    body: `<p>${esc(who)} rolled <strong>${total}</strong> (natural ${natural}). They believe this until the consequences arrive:</p>
      <blockquote>${resultText(drawn?.results?.[0])}</blockquote>
      <p class="hg-muted">Sense Motive vs. Celmak's Bluff (+35) reveals only that it might be a fake.</p>` });
  return "detrimental";
}

/** Escalation responses ("Celmak's response") offered in the announcement desk and on chat cards. */
export const ESCALATIONS = {
  none: { label: "Announcement only" },
  gas: { label: "Mood Gas vent (DC 22)" },
  cast: { label: "Send in a demon cast member" },
  walls: { label: "Reconfigure the room (blast doors + shake)" },
  vote: { label: "Audience vote that splits the party (opens the vote desk)" },
  drones: { label: "Stagehand Drones join the next encounter" },
  blackout: { label: "Lights out (blackout)" },
  spotlight: { label: "Spotlight on the least popular contestant" },
  shame: { label: "Public shaming: least popular contestant −1 fan" },
  season: { label: "The season turns (random Garden season)" },
  countdown: { label: "Ticking clock: 60 seconds to act" },
  snacks: { label: "Snacks revoked in the Green Room" },
  tantrum: { label: "Celmak's tantrum (system crash)" }
};

/** The visible contestant with the fewest fans (ties broken at random). */
function leastPopular() {
  const vis = getState().contestants.filter((c) => c.visible);
  if (!vis.length) return null;
  const min = Math.min(...vis.map((c) => c.rating));
  const low = vis.filter((c) => c.rating === min);
  return low[Math.floor(Math.random() * low.length)];
}

/** Canvas positions of the tokens belonging to a contestant's linked actor. */
function tokenPoints(c) {
  if (!c?.actorUuid || !globalThis.canvas?.tokens) return [];
  const actorId = c.actorUuid.split(".").pop();
  return (canvas.tokens.placeables ?? [])
    .filter((t) => t.actor?.id === actorId || t.document?.actorId === actorId)
    .map((t) => ({ x: t.center.x, y: t.center.y, r: Math.max(t.w, t.h) * 0.75 }));
}

const gmNote = (title, body) => chatCard({ title, whisper: true, body });

export async function runEscalation(kind) {
  const api = game.modules.get(MODULE_ID).api;
  switch (kind) {
    case "gas":
      return moodGas({ dc: 22 });
    case "cast":
      return broadcast("sticker", { sticker: "smug", sound: "suspense", caption: "Особая приглашённая звезда!" });
    case "walls":
      broadcast("lockdown", { duration: 4, text: "ПЕРЕСТРОЙКА СТУДИИ" });
      return setTimeout(() => broadcast("shake", { sound: "rimshot", strength: 2 }), 600);
    case "vote":
      return api.openVote();
    case "drones": {
      broadcast("smoke", { duration: 6 });
      broadcast("sticker", { sticker: "presenting", sound: "on-air", caption: "Рабочие сцены — на выход!" });
      const drone = ACTORS["Stagehand Drone"];
      return gmNote("Escalation: Stagehand Drones", `<p>The next encounter gains one ${drone ? `@UUID[${drone}]{Stagehand Drone}` : "Stagehand Drone"}.</p>`);
    }
    case "blackout":
      broadcast("blackout", { duration: 8 });
      return gmNote("Escalation: lights out", "<p>Optional: the area is dark until the end of the round, when Celmak restores power for the cameras.</p>");
    case "spotlight": {
      const c = leastPopular();
      broadcast("spotlight", { points: tokenPoints(c), duration: 7 });
      if (c) broadcast("sticker", { sticker: "smug", sound: "boo", caption: `А вот и наш аутсайдер: ${c.name}!` });
      return;
    }
    case "shame": {
      const c = leastPopular();
      if (!c) return;
      await adjustContestant(c.id, -1, "Public shaming", { link: false });
      return broadcast("sticker", { sticker: "bored", sound: "boo", caption: `${c.name}, зрители разочарованы. −1 к рейтингу!` });
    }
    case "season": {
      const kinds = ["spring", "summer", "autumn", "winter"];
      return broadcast("season", { kind: kinds[Math.floor(Math.random() * kinds.length)], duration: 8, showRules: false });
    }
    case "countdown":
      broadcast("countdown", { seconds: 60, label: "РЕШАЙТЕСЬ!" });
      return gmNote("Escalation: ticking clock", "<p>The players have 60 real seconds to agree on what they do next; if they don't, Celmak decides for them.</p>");
    case "snacks":
      return broadcast("sticker", { sticker: "snacks-revoked", sound: "rating-down", caption: "Никаких вкусняшек в Зелёной комнате!" });
    case "tantrum":
      broadcast("crash", { duration: 7 });
      return setTimeout(() => broadcast("sticker", { sticker: "angry", sound: "buzzer", caption: "Это жульничество! Переснимаем!" }), 7600);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Chat card buttons                                                  */
/* ------------------------------------------------------------------ */

export function bindChatButtons(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || !message?.flags?.[MODULE_ID]?.card) return;
  for (const btn of root.querySelectorAll("[data-hg-action]")) {
    if (!game.user.isGM) {
      btn.remove();
      continue;
    }
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const api = game.modules.get(MODULE_ID).api;
      const a = btn.dataset.hgAction;
      btn.disabled = true;
      try {
        if (a === "award") await awardTrinket(btn.dataset.cid);
        else if (a === "laugh") {
          broadcast("sticker", { sticker: "joy", sound: "rimshot", caption: "Ха! Ха-ха-ха!" });
          if (btn.dataset.cid) await adjustContestant(btn.dataset.cid, 1, "Honeypot swallowed");
          else await adjustShow(1, "Honeypot swallowed");
        } else if (a === "titlecard") api.episodeTitle(btn.dataset.episode);
        else if (a === "announce") api.openAnnounce(btn.dataset.kind);
        else await runEscalation(a);
      } finally {
        btn.disabled = false;
      }
    });
  }
}

export function episodeById(id) {
  return EPISODES.find((e) => e.id === id) ?? null;
}

export { HOST_NAME, SHOW_RESPONSES };
