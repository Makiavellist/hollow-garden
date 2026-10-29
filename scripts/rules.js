import { EPISODES, MODULE_ID, MOOD_GAS, SHOW_RESPONSES, TABLES, sticker } from "./constants.js";
import { playSfx } from "./audio.js";
import { broadcast } from "./socket.js";
import { confetti, popSticker, shake, titleCard } from "./fx.js";
import { adjustShow, getState, setShow, topContestants } from "./state.js";
import { chatCard, drawTable, esc, isActiveGM, resultText, resultUuid, setting, sleep } from "./util.js";

/* ------------------------------------------------------------------ */
/*  Local reactions to state events (every client)                     */
/* ------------------------------------------------------------------ */

export function reactToEvent(state, ev) {
  if (!ev) return;
  switch (ev.type) {
    case "contestant": {
      if (!ev.delta) return;
      playSfx(ev.delta > 0 ? "rating-up" : "rating-down", { volume: 0.7 });
      showReaction(state, ev.show);
      break;
    }
    case "show": {
      if (!ev.delta) return;
      playSfx(ev.delta > 0 ? "rating-up" : "rating-down", { volume: 0.7 });
      showReaction(state, ev.show);
      break;
    }
    case "visibility":
      if (ev.visible) playSfx("on-air", { volume: 0.6 });
      break;
  }
}

function showReaction(state, show) {
  if (!show || show.from === show.to) return;
  if (show.to === 5) {
    const top = topContestants(state);
    titleCard({ kind: "peak", subtitle: top.length === 1 ? `A Trinket for ${top[0].name}!` : "A Trinket for the fan favourite!" });
    confetti();
  } else if (show.to === 1) {
    titleCard({ kind: "escalation" });
    shake({ strength: 2 });
  }
}

/* ------------------------------------------------------------------ */
/*  Automation (active GM only)                                        */
/* ------------------------------------------------------------------ */

export async function automate(state, ev) {
  if (!ev || !isActiveGM() || setting("automation") === false) return;
  const show = ev.show;
  if (!show || show.from === show.to || ev.type === "reset") return;
  if (show.to === 5) {
    const top = topContestants(state);
    const who = top.length === 1 ? top[0] : null;
    await chatCard({
      title: "Ratings peak!",
      sticker: sticker("trophy"),
      whisper: true,
      body: `<p>${esc(SHOW_RESPONSES[5].text)}</p>
        <p>${who ? `Fan favourite: <strong>${esc(who.name)}</strong>${who.actorUuid ? "" : " <em>(no actor linked)</em>"}`
          : `It's a tie between ${top.map((t) => `<strong>${esc(t.name)}</strong>`).join(", ")}. Pick one.`}</p>`,
      buttons: (who ? [who] : top).map((c) => ({ action: "award", label: `Trinket for ${c.name}`, icon: "fa-solid fa-gift", data: { cid: c.id } }))
    });
    await sleep(4200);
    await setShow(3, "Reset after peak", { quiet: true });
  } else if (show.to === 1) {
    await chatCard({
      title: "Escalation!",
      sticker: sticker("angry"),
      whisper: true,
      body: `<p>${esc(SHOW_RESPONSES[1].text)}</p><p>Pick Celmak's response:</p>`,
      buttons: [
        { action: "gas", label: "Mood Gas vent", icon: "fa-solid fa-smog" },
        { action: "cast", label: "Send in a demon", icon: "fa-solid fa-masks-theater" },
        { action: "walls", label: "Reconfigure the room", icon: "fa-solid fa-border-all" },
        { action: "vote", label: "Audience vote", icon: "fa-solid fa-square-poll-horizontal" }
      ]
    });
    await sleep(4200);
    await setShow(2, "Reset after escalation", { quiet: true });
  } else if (show.to === 2 && show.from > 2) {
    await chatCard({ title: "Ratings: 2", sticker: sticker("bored"), whisper: true, body: `<p>${esc(SHOW_RESPONSES[2].text)}</p>` });
  } else if (show.to === 4 && show.from < 4) {
    await chatCard({ title: "Ratings: 4", sticker: sticker("heart-eyes"), whisper: true, body: `<p>${esc(SHOW_RESPONSES[4].text)}</p>` });
  }
}

/* ------------------------------------------------------------------ */
/*  Trinkets                                                           */
/* ------------------------------------------------------------------ */

export async function awardTrinket(cid = null) {
  const state = getState();
  let c = cid ? state.contestants.find((x) => x.id === cid) : null;
  if (!c) {
    const top = topContestants(state);
    c = top[0] ?? null;
  }
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
  const name = doc?.name ?? result?.name ?? "a Trinket";
  broadcast("sticker", { sticker: "trophy", sound: "fanfare", caption: `${c?.name ?? "Someone"} wins: ${name}!` });
  broadcast("confetti", {});
  await chatCard({
    title: "And the prize goes to…",
    sticker: sticker("trophy"),
    body: `<p><strong>${esc(c?.name ?? "the fan favourite")}</strong> receives ${doc ? `@UUID[${doc.uuid}]{${esc(name)}}` : esc(name)}!</p>
      ${given ? `<p class="hg-muted">Added to their character sheet.</p>` : c?.actorUuid ? "" : `<p class="hg-muted">No actor linked; hand it over manually.</p>`}`
  });
}

/* ------------------------------------------------------------------ */
/*  Mood Gas                                                           */
/* ------------------------------------------------------------------ */

export async function moodGas({ dc = 22, roll = null } = {}) {
  let r = roll;
  let text = "";
  if (!r) {
    const drawn = await drawTable(TABLES["mood-gas"]);
    r = drawn?.roll?.total ?? Math.ceil(Math.random() * 6);
    text = resultText(drawn?.results?.[0]);
  }
  const g = MOOD_GAS[r] ?? MOOD_GAS[1];
  broadcast("gas", { roll: r, dc });
  await chatCard({
    title: `Mood Gas: ${g.name}`,
    sticker: sticker("smug"),
    body: `<p class="hg-gas-chip" style="--gas:${g.color}">d6 = ${r}</p><p>${text || esc(g.text)}</p>
      <p>Creatures in the 20-ft burst: <strong>Fortitude DC ${dc}</strong> to avoid inhaling a dose (holding one's breath works if they acted first),
      then <strong>Will DC ${dc}</strong> against the effect for 1d4+1 rounds. Androids add their racial bonus; creatures that do not breathe are immune.</p>`
  });
}

/* ------------------------------------------------------------------ */
/*  Honeypots                                                          */
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
      body: `<p>${esc(who)} rolled <strong>${total}</strong> (natural ${natural}). Celmak laughs, and the ratings rise by 1.</p>
        <blockquote>${resultText(drawn?.results?.[0])}</blockquote>` });
    broadcast("sticker", { sticker: "joy", sound: "rimshot", caption: "Ha! Ha ha ha!" });
    if (cid) await (await import("./state.js")).adjustContestant(cid, 1, "Honeypot swallowed");
    else await adjustShow(1, "Honeypot swallowed");
    return "amusing";
  }
  const drawn = await drawTable(TABLES.detrimental);
  await chatCard({ title: "Honeypot: a convincing fake", sticker: sticker("smug"), whisper: true,
    body: `<p>${esc(who)} rolled <strong>${total}</strong> (natural ${natural}). They believe this until the consequences arrive:</p>
      <blockquote>${resultText(drawn?.results?.[0])}</blockquote>
      <p class="hg-muted">Sense Motive vs. Celmak's Bluff (+35) reveals only that it might be a fake.</p>` });
  return "detrimental";
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
        else if (a === "gas") await moodGas({ dc: 22 });
        else if (a === "cast") broadcast("sticker", { sticker: "smug", sound: "suspense", caption: "Special guest star!" });
        else if (a === "walls") broadcast("shake", { sound: "rimshot" });
        else if (a === "vote") api.openVote();
        else if (a === "titlecard") api.episodeTitle(btn.dataset.episode);
        else if (a === "opencast") api.openConsole("games");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

export function episodeById(id) {
  return EPISODES.find((e) => e.id === id) ?? null;
}
