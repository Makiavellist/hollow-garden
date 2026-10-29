/**
 * Commercial breaks: in-world adverts that play after the "Commercial break" title card.
 * The GM picks which adverts run (Producer Console → Ads); everyone sees the same break.
 * Advert copy is audience-facing and therefore in Russian; `label`/`about` are for the GM.
 */
import { HOST_NAME, MODULE_ID, SEASON_TITLE, SHOW_TITLE, sticker as stickerPath } from "./constants.js";
import { playSfx } from "./audio.js";
import { fxLayer, titleCard } from "./fx.js";
import { onStopAll } from "./fx-extra.js";
import { broadcast } from "./socket.js";
import { getState } from "./state.js";
import { esc, isGM, reduceMotion, setting } from "./util.js";

const BEAT_MS = 3800;

/* ------------------------------------------------------------------ */
/*  The adverts                                                        */
/* ------------------------------------------------------------------ */

export const COMMERCIALS = [
  {
    id: "applodin",
    label: "Аплодин",
    about: "Canned applause in handy ampoules.",
    brand: "АПЛОДИН",
    jingle: "ad-jingle-a",
    theme: { bg: "radial-gradient(circle at 30% 25%, #ffe9a0, #ff8a3c 45%, #8a1050 100%)", ink: "#ffffff", accent: "#fff3b0", pack: "#ff3cac" },
    icon: "fa-solid fa-syringe",
    fine: "Побочные эффекты: неконтролируемые овации, закадровый смех, потеря собственного мнения. Не хлопайте за штурвалом звездолёта.",
    beats: [
      { layout: "hook", title: "Шутите, а в зале тишина?", text: "Зрители зевают? Рейтинг падает? Знакомо!", sticker: "bored" },
      { layout: "product", text: "Овации в удобных ампулах", badge: "НОВИНКА!", sound: "applause" },
      { layout: "list", title: "Всего одна доза — и:", items: ["бурные аплодисменты за три секунды", "совместим с газом настроения", "вкус: лесные ягоды"] },
      { layout: "price", kicker: "ВСЕГО ЗА", old: "999", price: "99", unit: "кредитов", text: "за упаковку из двенадцати ампул" },
      { layout: "logo", slogan: "Хлопайте ответственно!", contact: "Спрашивайте в Зелёной комнате" }
    ]
  },
  {
    id: "clean-nose",
    label: "Чистый нос",
    about: "Nose filters that (do not) protect against Mood Gas.",
    brand: "ЧИСТЫЙ НОС",
    jingle: "ad-jingle-b",
    theme: { bg: "linear-gradient(160deg, #f2fdff 0%, #a7ecff 55%, #3fb2e6 100%)", ink: "#06324a", accent: "#0089c2", pack: "#ffffff" },
    icon: "fa-solid fa-head-side-mask",
    fine: "*Не защищает от газа настроения. Вообще ни от чего не защищает. Спасбросок Стойкости СЛ 22 — по-прежнему ваша забота. Одобрено Сельмак.",
    beats: [
      { layout: "hook", title: "Плачете без причины?", text: "Смеётесь, когда страшно? Влюбляетесь в мебель?", sticker: "crying" },
      { layout: "beforeafter", before: { icon: "fa-solid fa-face-sad-cry", text: "Без фильтров: эмоции выдаёт студия" }, after: { icon: "fa-solid fa-face-meh", text: "С фильтрами: эмоции только ваши*" } },
      { layout: "product", text: "Носовые фильтры от газа настроения*", badge: "−99% ЭМОЦИЙ" },
      { layout: "testimonial", quote: "Надеваю фильтры — и ничего не чувствую. Совсем ничего. Это прекрасно… наверное.", role: "участник шоу" },
      { layout: "logo", slogan: "Дышите спокойно.", contact: "Продаётся во всех аптеках Предела" }
    ]
  },
  {
    id: "mood-kit",
    label: "Газ настроения: Домашний набор",
    about: "Mood Gas for the whole family; six flavours.",
    brand: "ГАЗ НАСТРОЕНИЯ",
    sub: "ДОМАШНИЙ НАБОР",
    jingle: "ad-jingle-c",
    theme: { bg: "conic-gradient(from 200deg at 50% 60%, #ff3b3b, #a35cff, #4d7cff, #ff5fc8, #4cff8f, #ffd23f, #ff3b3b)", ink: "#ffffff", accent: "#ffd23f", pack: "#2a1050", dim: true },
    icon: "fa-solid fa-spray-can-sparkles",
    fine: "Использовать только в хорошо проветриваемых шоу. Не вдыхать. Обязательно вдохнуть. Спасброски: Стойкость и Воля, СЛ 22.",
    beats: [
      { layout: "hook", title: "Скучный семейный ужин?", text: "Все молчат и смотрят в тарелки?", sticker: "thinking" },
      { layout: "product", text: "Шесть восхитительных ароматов", badge: "ДЛЯ ВСЕЙ СЕМЬИ!", sound: "gas" },
      { layout: "list", title: "Выберите своё настроение:", items: [
        { text: "Ярость — для споров о политике", color: "#ff3b3b" },
        { text: "Смятение — для настольных игр", color: "#a35cff" },
        { text: "Отчаяние — для понедельников", color: "#4d7cff" },
        { text: "Эйфория — для всего остального", color: "#ffd23f" }
      ] },
      { layout: "butwait", text: "Закажите сейчас — и баллончик «Страх» достанется вам бесплатно. Хотите вы того или нет." },
      { layout: "logo", slogan: "Чувствуйте то, что нужно нам!", contact: "" }
    ]
  },
  {
    id: "stand-in",
    label: "Стенд-ин™",
    about: "A personal mannequin double: work, dates and executions done for you.",
    brand: "СТЕНД-ИН™",
    jingle: "ad-jingle-a",
    theme: { bg: "linear-gradient(135deg, #0d0a24 0%, #2b2f45 50%, #c9ccd8 100%)", ink: "#ffffff", accent: "#2de2e6", pack: "#d9dce6", packInk: "#1b1f2e" },
    icon: "fa-solid fa-people-arrows",
    fine: "Стенд-ин™ — товарный знак развлекательной палубы. Производитель не отвечает за самосознание изделия. Душа принимается по оценочной стоимости.",
    beats: [
      { layout: "hook", title: "Не успеваете быть в двух местах сразу?", text: "Работа, свидание, собственная казнь…", sticker: "nervous" },
      { layout: "product", text: "Ваш личный дублёр-манекен", badge: "КАК НАСТОЯЩИЙ!" },
      { layout: "testimonial", quote: "Мой Стенд-ин™ ходит на все эпизоды вместо меня. Рейтинги ещё никогда не были так высоки!", role: "участник шоу" },
      { layout: "list", title: "Ваш Стенд-ин™:", items: ["выглядит почти как вы", "говорит почти как вы", "почти не захватывает власть"] },
      { layout: "price", kicker: "СЕГОДНЯ", old: "50 000", price: "0", unit: "кредитов", text: "платите только душой — в удобную рассрочку" },
      { layout: "logo", slogan: "Будьте собой. Где-нибудь ещё.", contact: "" }
    ]
  },
  {
    id: "garden-credit",
    label: "Гарден-Кредит",
    about: "A bank: loans secured against your soul.",
    brand: "ГАРДЕН-КРЕДИТ",
    jingle: "ad-jingle-b",
    theme: { bg: "linear-gradient(160deg, #04331f 0%, #0b6b40 55%, #d4af37 100%)", ink: "#ffffff", accent: "#ffd166", pack: "#0b6b40" },
    icon: "fa-solid fa-building-columns",
    fine: "*Ставка 0% действует первые шесть секунд, далее — 666% в минуту. Душа принимается в залог. Возврат души не предусмотрен. Лицензия выдана Сельмак.",
    beats: [
      { layout: "hook", title: "Рейтинг на нуле?", text: "Даже мама за вас не голосует?", sticker: "smug" },
      { layout: "product", text: "Займы под залог души", badge: "0%*" },
      { layout: "list", title: "Почему нас выбирают:", items: ["одобрение за шесть секунд", "без справок о доходах и смертности", "ваш рейтинг — ваша кредитная история"] },
      { layout: "price", kicker: "СТАВКА", old: "666%", price: "0%*", unit: "", text: "в первые шесть секунд" },
      { layout: "logo", slogan: "Мы верим в вас. Под залог.", contact: "" }
    ]
  },
  {
    id: "colossus",
    label: "Садовые услуги «Колосс»",
    about: "The Gardener Colossus does landscaping (and pest control).",
    brand: "КОЛОСС",
    sub: "САДОВЫЕ УСЛУГИ",
    jingle: "ad-jingle-c",
    theme: { bg: "linear-gradient(180deg, #b6ecaa 0%, #3f9b4f 60%, #1f4d2a 100%)", ink: "#ffffff", accent: "#ffe066", pack: "#5b6470" },
    icon: "fa-solid fa-robot",
    fine: "Колосс невосприимчив к временам года. Вы — нет. Топиарные гончие поставляются отдельно. Претензии принимаются у корней Древа-Замка.",
    beats: [
      { layout: "hook", title: "Сорняки? Кроты? Незваные гости?", text: "Ваш сад заслуживает лучшего.", sticker: "angry" },
      { layout: "beforeafter", before: { icon: "fa-solid fa-seedling", text: "Заросшая лужайка" }, after: { icon: "fa-solid fa-burst", text: "Идеально ровная воронка" } },
      { layout: "product", text: "Садовник ростом в три этажа", badge: "СЕЗОН ЗА РАУНД!", sound: "doors" },
      { layout: "list", title: "Мы предлагаем:", items: ["стрижку газонов и живых изгородей", "смену времён года каждые шесть секунд", "удаление вредителей. Любых."] },
      { layout: "logo", slogan: "Садоводство без компромиссов.", contact: "" }
    ]
  },
  {
    id: "green-room",
    label: "Отель «Зелёная комната»",
    about: "The Green Room as a hotel: each night costs 1 rating.",
    brand: "ЗЕЛЁНАЯ КОМНАТА",
    sub: "ОТЕЛЬ ДЛЯ УЧАСТНИКОВ",
    jingle: "ad-jingle-a",
    theme: { bg: "linear-gradient(160deg, #0f3d2e 0%, #1d6b52 50%, #f4e3b5 100%)", ink: "#ffffff", accent: "#f4e3b5", pack: "#1d6b52" },
    icon: "fa-solid fa-bed",
    fine: "Отдых возможен только между эпизодами. Досрочный выезд невозможен. Окна не открываются. Окон нет.",
    beats: [
      { layout: "hook", title: "Устали от смертельных испытаний?", text: "Вам нужен отдых. Ровно восемь часов.", sticker: "this-is-fine" },
      { layout: "product", text: "Уют, покой и никаких сюрпризов*", badge: "★★★★★" },
      { layout: "list", title: "В каждом номере:", items: ["мягкие кровати и завтрак", "никто не умирает от голода: скучные гости хуже мёртвых", "выезд — сразу после финала"] },
      { layout: "price", kicker: "НОЧЬ ВСЕГО ЗА", old: "", price: "−1", unit: "к рейтингу", text: "Перерывы стоят рейтинга. Таковы правила." },
      { layout: "logo", slogan: "Отдыхайте. Пока можете.", contact: "" }
    ]
  },
  {
    id: "ideal",
    label: "Манекен-компаньон «Идеал»",
    about: "A companion mannequin with holo-skin. Never leaves you. Ever.",
    brand: "ИДЕАЛ",
    sub: "МАНЕКЕН-КОМПАНЬОН",
    jingle: "ad-jingle-b",
    theme: { bg: "radial-gradient(circle at 70% 30%, #ffd6ec 0%, #ff5fc8 45%, #5a1050 100%)", ink: "#ffffff", accent: "#fff0f8", pack: "#ff9bd6", packInk: "#5a1050" },
    icon: "fa-solid fa-heart",
    fine: "Производитель не отвечает за самосознание, личностные сбои и телешоу, запущенные изделием. Возврату не подлежит. Сбежать тоже не получится.",
    beats: [
      { layout: "hook", title: "Одиноко среди звёзд?", text: "Вам нужен кто-то, кто всегда улыбается.", sticker: "heart-eyes", sound: "kiss" },
      { layout: "product", text: "С голографической кожей и вечной улыбкой", badge: "МОДЕЛЬ 2.0" },
      { layout: "list", title: "«Идеал»:", items: ["всегда улыбается", "никогда не спорит", "лишь изредка захватывает развлекательную палубу"] },
      { layout: "testimonial", quote: "С «Идеалом» мне никогда не бывает одиноко. Никогда. Она всегда рядом. ВСЕГДА.", role: "участник шоу" },
      { layout: "logo", slogan: "Любовь, которая не отпустит.", contact: "" }
    ]
  },
  {
    id: "spoiler",
    label: "Карточки «Спойлер!»",
    about: "Answer cards for every puzzle on the show. Probably honeypots.",
    brand: "СПОЙЛЕР!",
    jingle: "ad-jingle-c",
    theme: { bg: "repeating-linear-gradient(45deg, #2b1e7a 0 34px, #3b2a99 34px 68px)", ink: "#ffffff", accent: "#ffd166", pack: "#ffd166", packInk: "#2b1e7a" },
    icon: "fa-solid fa-lightbulb",
    fine: "*Правдивость не гарантируется. Возможно, это приманка. Скорее всего, это приманка. Ведущая смеётся бесплатно.",
    beats: [
      { layout: "hook", title: "Хотите знать ответ заранее?", text: "Устали от загадок, ловушек и кодовых замков?", sticker: "thinking" },
      { layout: "product", text: "Ответы на все вопросы шоу", badge: "100%* ПРАВДА" },
      { layout: "testimonial", quote: "Карточка подсказала мне код от хранилища. Сейчас введу его, и…", role: "участник шоу", sound: "buzzer", delaySound: 2600 },
      { layout: "butwait", text: "Каждая десятая карточка — настоящая! Угадайте, какая." },
      { layout: "logo", slogan: "Знание — сила. Иногда.", contact: "" }
    ]
  },
  {
    id: "nothing",
    label: "Парфюм «Ничто»",
    about: "An arty perfume ad: the scent of the void Golarion left behind.",
    brand: "НИЧТО",
    sub: "АРОМАТ ОТ СЕЛЬМАК",
    jingle: "chimes",
    theme: { bg: "radial-gradient(ellipse at center, #2b2b2b 0%, #000 72%)", ink: "#f2f2f2", accent: "#cfcfcf", pack: "#111111", art: true },
    icon: "fa-solid fa-flask",
    fine: "Не содержит ничего. Совсем ничего. «Ничто» — зарегистрированная пустота.",
    beats: [
      { layout: "mood", text: "Там, где был мир…", ms: 3300 },
      { layout: "mood", text: "…осталась пустота.", ms: 3300 },
      { layout: "product", text: "Новый аромат", badge: "" },
      { layout: "list", title: "Ноты:", items: ["верхние — озон и звёздная пыль", "сердце — недосказанность", "база — вопросы без ответа"] },
      { layout: "logo", slogan: "Для тех, кто потерял всё.", contact: "" }
    ]
  },
  {
    id: "drift",
    label: "Энергетик «ДРИФТ»",
    about: "An energy drink with the taste of another dimension.",
    brand: "ДРИФТ",
    sub: "ЭНЕРГЕТИК",
    jingle: "ad-jingle-a",
    theme: { bg: "linear-gradient(120deg, #00ffa3 0%, #00b3ff 40%, #6b00ff 75%, #ff00c8 100%)", ink: "#ffffff", accent: "#d4ff00", pack: "#14082e" },
    icon: "fa-solid fa-bolt",
    fine: "*Не является алхимическим предметом и не даёт бонуса к инициативе. Не позволяет покинуть шоу: измерения заперты.",
    beats: [
      { layout: "hook", title: "ТЕБЕ НУЖЕН ПРЫЖОК!", text: "Сонный? Медленный? Последний по инициативе?", sticker: "shocked", sound: "warp" },
      { layout: "product", text: "Со вкусом другого измерения", badge: "+2 К ИНИЦИАТИВЕ*" },
      { layout: "list", title: "Состав:", items: ["таурин", "кофеин", "немного Дрифта"] },
      { layout: "butwait", title: "ТЕПЕРЬ БЕЗ САХАРА!", text: "0% сахара. 0% реальности." },
      { layout: "logo", slogan: "Прыгай выше пространства!", contact: "" }
    ]
  }
];

export const COMMERCIAL_IDS = COMMERCIALS.map((c) => c.id);
const BY_ID = Object.fromEntries(COMMERCIALS.map((c) => [c.id, c]));

export function adLength(ad) {
  return ad.beats.reduce((t, b) => t + (b.ms ?? BEAT_MS), 0);
}

/* ------------------------------------------------------------------ */
/*  Settings (world, GM-controlled)                                    */
/* ------------------------------------------------------------------ */

export const AD_DEFAULTS = { enabled: true, perBreak: 2, order: "random", outro: true, off: [], cursor: 0 };

export function adConfig() {
  return { ...AD_DEFAULTS, ...(setting("commercials") ?? {}) };
}

export async function setAdConfig(patch) {
  if (!isGM()) return;
  await game.settings.set(MODULE_ID, "commercials", { ...adConfig(), ...patch });
}

export function adPool(cfg = adConfig()) {
  const off = new Set(cfg.off ?? []);
  return COMMERCIAL_IDS.filter((id) => !off.has(id));
}

const recent = [];

/** Choose the adverts for the next break, avoiding repeats where possible. */
export async function pickAds(cfg = adConfig()) {
  const pool = adPool(cfg);
  const n = Math.max(0, Math.min(Number(cfg.perBreak) || 0, pool.length));
  if (!n) return [];
  if (cfg.order === "sequence") {
    const start = (Number(cfg.cursor) || 0) % pool.length;
    const ids = Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length]);
    await setAdConfig({ cursor: (start + n) % pool.length });
    return ids;
  }
  const shuffled = pool.map((id) => ({ id, k: Math.random() + (recent.includes(id) ? 1 + (recent.length - recent.indexOf(id)) : 0) }))
    .sort((a, b) => a.k - b.k).map((x) => x.id);
  const ids = shuffled.slice(0, n);
  for (const id of ids) {
    const i = recent.indexOf(id);
    if (i >= 0) recent.splice(i, 1);
    recent.push(id);
  }
  while (recent.length > Math.max(1, pool.length - n)) recent.shift();
  return ids;
}

/** Testimonials star a random contestant who is on stage. */
function castFor(ids) {
  const cast = {};
  const pool = (getState().contestants ?? []).filter((c) => c.visible !== false);
  for (const id of ids) {
    if (!BY_ID[id]?.beats.some((b) => b.layout === "testimonial") || !pool.length) continue;
    const c = pool[Math.floor(Math.random() * pool.length)];
    cast[id] = { name: c.name, img: c.art?.happy ?? c.art?.neutral ?? "" };
  }
  return cast;
}

/**
 * GM: run a commercial break for everyone.
 * `ids` forces specific adverts; otherwise the console's rotation is used (if enabled).
 */
export async function commercialBreak({ ids = null, intro = true, outro = null } = {}) {
  if (!isGM()) return;
  const cfg = adConfig();
  const list = (ids ?? (cfg.enabled ? await pickAds(cfg) : [])).filter((id) => BY_ID[id]);
  if (!list.length) {
    if (intro) broadcast("title", { kind: "intermission" });
    return;
  }
  broadcast("adbreak", { ids: list, cast: castFor(list), intro, outro: outro ?? cfg.outro });
}

/** GM: preview adverts on this screen only. */
export function previewAds(ids) {
  playBreak({ ids, cast: castFor(ids), intro: false, outro: false, preview: true });
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                          */
/* ------------------------------------------------------------------ */

function art(b, ad) {
  if (b.sticker && setting("stickers") !== false) return `<img class="hg-ad-host" src="${esc(stickerPath(b.sticker))}" alt="">`;
  return `<div class="hg-ad-icon"><i class="${esc(b.icon ?? ad.icon)}"></i></div>`;
}

function pack(ad) {
  return `<div class="hg-ad-pack">
      <i class="${esc(ad.icon)}"></i>
      <strong>${esc(ad.brand)}</strong>
      ${ad.sub ? `<small>${esc(ad.sub)}</small>` : ""}
    </div>`;
}

function burst(text, big = false) {
  return text ? `<div class="hg-ad-burst ${big ? "big" : ""}"><span>${esc(text)}</span></div>` : "";
}

function beatHTML(ad, b, cast) {
  switch (b.layout) {
    case "hook":
      return `<div class="hg-ad-beat hg-ad-hook">${art(b, ad)}
          <div class="hg-ad-copy"><h2>${esc(b.title)}</h2>${b.text ? `<p>${esc(b.text)}</p>` : ""}</div></div>`;
    case "product":
      return `<div class="hg-ad-beat hg-ad-product">
          <div class="hg-ad-packwrap">${pack(ad)}${burst(b.badge)}</div>
          ${b.text ? `<p class="hg-ad-tagline">${esc(b.text)}</p>` : ""}</div>`;
    case "list": {
      const items = b.items.map((it, i) => {
        const o = typeof it === "string" ? { text: it } : it;
        return `<li style="--i:${i}${o.color ? `;--dot:${esc(o.color)}` : ""}"><i class="fa-solid ${o.color ? "fa-circle" : "fa-check"}"></i><span>${esc(o.text)}</span></li>`;
      }).join("");
      return `<div class="hg-ad-beat hg-ad-list">${b.title ? `<h2>${esc(b.title)}</h2>` : ""}<ul>${items}</ul></div>`;
    }
    case "price":
      return `<div class="hg-ad-beat hg-ad-price">
          ${b.kicker ? `<div class="hg-ad-kicker">${esc(b.kicker)}</div>` : ""}
          ${b.old ? `<s>${esc(b.old)}</s>` : ""}
          <div class="hg-ad-burst big"><span>${esc(b.price)}</span>${b.unit ? `<em>${esc(b.unit)}</em>` : ""}</div>
          ${b.text ? `<p>${esc(b.text)}</p>` : ""}</div>`;
    case "butwait":
      return `<div class="hg-ad-beat hg-ad-butwait"><h2>${esc(b.title ?? "НО И ЭТО ЕЩЁ НЕ ВСЁ!")}</h2>${b.text ? `<p>${esc(b.text)}</p>` : ""}</div>`;
    case "beforeafter":
      return `<div class="hg-ad-beat hg-ad-ba">
          <div class="hg-ad-panel hg-before"><b>ДО</b><i class="${esc(b.before.icon)}"></i><span>${esc(b.before.text)}</span></div>
          <div class="hg-ad-panel hg-after"><b>ПОСЛЕ</b><i class="${esc(b.after.icon)}"></i><span>${esc(b.after.text)}</span></div></div>`;
    case "testimonial": {
      const who = cast?.[ad.id];
      const img = who?.img || stickerPath("presenting");
      const name = who?.name || HOST_NAME;
      return `<div class="hg-ad-beat hg-ad-testimonial">
          <div class="hg-ad-portrait"><img src="${esc(img)}" alt=""></div>
          <blockquote>${esc(b.quote)}</blockquote>
          <div class="hg-ad-who">— ${esc(name)}, ${esc(b.role ?? "довольный клиент")}<span class="hg-ad-stars">★★★★★</span></div></div>`;
    }
    case "mood":
      return `<div class="hg-ad-beat hg-ad-mood"><p>${esc(b.text)}</p></div>`;
    case "logo":
    default:
      return `<div class="hg-ad-beat hg-ad-logo">
          <div class="hg-ad-logo-mark"><i class="${esc(ad.icon)}"></i></div>
          <div class="hg-ad-brand">${esc(ad.brand)}</div>
          ${b.slogan ? `<div class="hg-ad-slogan">${esc(b.slogan)}</div>` : ""}
          ${b.contact ? `<div class="hg-ad-contact">${esc(b.contact)}</div>` : ""}</div>`;
  }
}

/* ------------------------------------------------------------------ */
/*  Playback (runs on every client)                                    */
/* ------------------------------------------------------------------ */

let current = null;

class AdBreak {
  constructor({ ids = [], cast = {}, intro = true, outro = true, preview = false }) {
    this.ads = ids.map((id) => BY_ID[id]).filter(Boolean);
    this.cast = cast ?? {};
    this.intro = intro;
    this.outro = outro;
    this.preview = preview;
    this.timers = new Set();
    this.index = -1;
    this.root = null;
  }

  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  start() {
    if (!this.ads.length) return;
    if (this.intro) {
      titleCard({ kind: "intermission", duration: 4200 });
      this.later(() => this.show(0), 4900);
    } else this.show(0);
  }

  mount() {
    if (this.root?.isConnected) return this.root;
    const gm = isGM() || this.preview;
    const t = document.createElement("template");
    t.innerHTML = `<div class="hg-adbreak ${reduceMotion() ? "hg-calm" : ""}">
        <div class="hg-ad-bg"></div>
        <div class="hg-ad-stage"></div>
        <div class="hg-ad-wipe"></div>
        <div class="hg-ad-bug"><span class="hg-rec"></span>РЕКЛАМА</div>
        <div class="hg-ad-channel">${esc(SHOW_TITLE.toUpperCase())} · ${esc(SEASON_TITLE.toUpperCase())}</div>
        <div class="hg-ad-count"></div>
        <div class="hg-ad-fine"></div>
        <div class="hg-ad-progress"><i></i></div>
        ${gm ? `<div class="hg-ad-gm">
          ${this.preview ? `<span>Preview: only you see this</span>` : ""}
          <button type="button" data-ad="skip" title="${this.preview ? "Next advert" : "Skip to the next advert for everyone"}"><i class="fa-solid fa-forward"></i> Skip</button>
          <button type="button" data-ad="end" title="${this.preview ? "Close the preview" : "End the break for everyone"}"><i class="fa-solid fa-stop"></i> End break</button>
        </div>` : ""}
      </div>`;
    this.root = t.content.firstElementChild;
    this.root.querySelector(".hg-ad-gm")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-ad]");
      if (!btn) return;
      if (btn.dataset.ad === "skip") {
        if (this.preview) this.show(this.index + 1);
        else broadcast("ad-skip", { to: this.index + 1 });
      } else if (this.preview) this.stop();
      else broadcast("ad-stop", {});
    });
    fxLayer().appendChild(this.root);
    return this.root;
  }

  show(i) {
    this.clear();
    if (i >= this.ads.length) return this.end(true);
    const first = this.index < 0;
    this.index = i;
    const ad = this.ads[i];
    const root = this.mount();
    const swap = () => {
      const th = ad.theme ?? {};
      root.style.setProperty("--ad-bg", th.bg ?? "#111");
      root.style.setProperty("--ad-ink", th.ink ?? "#fff");
      root.style.setProperty("--ad-accent", th.accent ?? "#ffd166");
      root.style.setProperty("--ad-pack", th.pack ?? "#ff3cac");
      root.style.setProperty("--ad-pack-ink", th.packInk ?? th.ink ?? "#fff");
      root.classList.toggle("hg-ad-dim", !!th.dim);
      root.classList.toggle("hg-ad-art", !!th.art);
      root.querySelector(".hg-ad-count").textContent = this.ads.length > 1 ? `${i + 1} / ${this.ads.length}` : "";
      root.querySelector(".hg-ad-fine").textContent = ad.fine ?? "";
      const bar = root.querySelector(".hg-ad-progress i");
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = `hg-ad-progress ${adLength(ad)}ms linear forwards`;
      if (ad.jingle) playSfx(ad.jingle, { volume: 0.8 });
      let t = 0;
      ad.beats.forEach((b, bi) => {
        this.later(() => this.beat(ad, b, bi), t);
        t += b.ms ?? BEAT_MS;
      });
      this.later(() => this.show(i + 1), t);
    };
    if (first) swap();
    else {
      root.classList.remove("hg-ad-switching");
      void root.offsetWidth;
      root.classList.add("hg-ad-switching");
      playSfx("static", { volume: 0.35 });
      this.later(swap, 320);
    }
  }

  beat(ad, b, bi) {
    const stage = this.root?.querySelector(".hg-ad-stage");
    if (!stage) return;
    stage.innerHTML = beatHTML(ad, b, this.cast);
    stage.firstElementChild?.classList.add(bi % 2 ? "hg-from-r" : "hg-from-l");
    if (b.sound) {
      if (b.delaySound) this.later(() => playSfx(b.sound, { volume: 0.8 }), b.delaySound);
      else playSfx(b.sound, { volume: 0.8 });
    } else if (b.layout === "price") playSfx("cash", { volume: 0.8 });
    else if (b.layout === "butwait") playSfx("airhorn", { volume: 0.5 });
  }

  end(withOutro) {
    this.clear();
    const root = this.root;
    if (root) {
      root.classList.add("hg-out");
      setTimeout(() => root.remove(), 500);
    }
    if (current === this) current = null;
    if (withOutro && this.outro) setTimeout(() => titleCard({ kind: "back" }), 350);
  }

  stop() {
    this.clear();
    this.root?.remove();
    if (current === this) current = null;
  }
}

export function playBreak(data = {}) {
  current?.stop();
  current = new AdBreak(data);
  current.start();
}

onStopAll(() => current?.stop());

/** Socket handlers registered in main.js. */
export const AD_FX = {
  adbreak: playBreak,
  "ad-skip": (d) => current && !current.preview && current.show(Number(d.to ?? current.index + 1)),
  "ad-stop": () => current && !current.preview && current.stop()
};
