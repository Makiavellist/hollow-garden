import { EPISODES, HOST_NAME, MODULE_ID, MOOD_GAS, SHOW_RESPONSES, TABLES, sticker } from "./constants.js";
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
      await actor.createEmbeddedDocuments("Item", [data]);
      given = true;
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
    body: `<p><strong>${esc(c?.name ?? "любимец публики")}</strong> получает ${doc ? `@UUID[${doc.uuid}]{${esc(name)}}` : esc(name)}!</p>`
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

/** Escalation responses offered in the announcement dialog and on chat cards. */
export const ESCALATIONS = {
  none: { label: "Announcement only" },
  gas: { label: "Mood Gas vent (DC 22)" },
  cast: { label: "Send in a demon cast member" },
  walls: { label: "Reconfigure the room (screen shake)" },
  vote: { label: "Audience vote (opens the vote desk)" }
};

export async function runEscalation(kind) {
  const api = game.modules.get(MODULE_ID).api;
  if (kind === "gas") return moodGas({ dc: 22 });
  if (kind === "cast") return broadcast("sticker", { sticker: "smug", sound: "suspense", caption: "Особая приглашённая звезда!" });
  if (kind === "walls") return broadcast("shake", { sound: "rimshot" });
  if (kind === "vote") return api.openVote();
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
