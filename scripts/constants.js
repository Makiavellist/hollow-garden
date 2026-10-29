import { GENERATED } from "./data/generated.js";

export const MODULE_ID = "hollow-garden";
export const SOCKET = `module.${MODULE_ID}`;
export const PATH = `modules/${MODULE_ID}`;

export const asset = (p) => `${PATH}/${p}`;
export const sound = (k) => `${PATH}/sounds/${k}.ogg`;
export const sticker = (k) => `${PATH}/assets/host/${k}.webp`;
export const contestantArt = (id, mood) => `${PATH}/assets/contestants/${id}-${mood}.webp`;

/* Audience-facing names (Russian). */
export const SHOW_TITLE = "Полый Сад";
export const SEASON_TITLE = "Звёздные Искатели";
export const HOST_NAME = "Сельмак";

export const RATING_MAX = 10;
export const SHOW_MIN = 1;
export const SHOW_MAX = 5;

/** Mood thresholds for contestant portraits. */
export function moodFor(rating) {
  if (rating <= 3) return "sad";
  if (rating >= 7) return "happy";
  return "neutral";
}

/** Celmak's response to each Show Rating. `label` is shown to everyone, `text` only to the GM. */
export const SHOW_RESPONSES = {
  1: { label: "ЭСКАЛАЦИЯ", text: "Mood Gas vent, a demon cast member, a room reconfiguration, or an audience vote that splits the party. Then resets to 2." },
  2: { label: "СКУКА", text: "Snide commentary; the next encounter gains one Stagehand Drone." },
  3: { label: "НОРМА", text: "Neutral." },
  4: { label: "ВОСТОРГ", text: "Praise; the next Mood Gas vent uses good hope instead." },
  5: { label: "ПИК", text: "Hands the highest-rated contestant a Trinket, then resets to 3." }
};

/** Quick reasons for the Show Rating (GM console). */
export const RATING_REASONS = {
  up: ["Heroic sacrifice", "Betrayal", "Emotional reveal", "Near-death", "Clever win", "Honeypot swallowed"],
  down: ["Bypassed with magic", "Intermission", "Ignored commentary", "Off-script"]
};

export const HOST_STICKERS = [
  "mic-welcome", "presenting", "thinking", "countdown", "buzzer", "correct", "wrong", "ratings", "trophy", "mystery-box", "champion", "blow-kiss",
  "joy", "heart-eyes", "angry", "crying", "shocked", "shy", "smug", "bored", "confused", "cheer", "nervous", "wink",
  "access-denied", "dont-leave", "snacks-revoked", "this-is-fine"
];

/** Soundboard cues: a sound, a host sticker and an optional extra effect. */
export const CUES = [
  { id: "applause", label: "Applause", sound: "applause", sticker: "cheer" },
  { id: "cheer", label: "Big Cheer", sound: "cheer", sticker: "champion", fx: "confetti" },
  { id: "boo", label: "Boo!", sound: "boo", sticker: "angry" },
  { id: "correct", label: "Correct!", sound: "correct", sticker: "correct" },
  { id: "wrong", label: "Wrong!", sound: "buzzer", sticker: "wrong" },
  { id: "drumroll", label: "Drumroll", sound: "drumroll", sticker: "countdown" },
  { id: "fanfare", label: "Fanfare", sound: "fanfare", sticker: "trophy" },
  { id: "trombone", label: "Sad Trombone", sound: "sad-trombone", sticker: "crying" },
  { id: "rimshot", label: "Ba-dum-tss", sound: "rimshot", sticker: "wink" },
  { id: "airhorn", label: "Airhorn", sound: "airhorn", sticker: "joy", fx: "shake" },
  { id: "suspense", label: "Dun dun DUN", sound: "suspense", sticker: "shocked" },
  { id: "ooh", label: "Ooh!", sound: "crowd-ooh", sticker: "heart-eyes" },
  { id: "aww", label: "Aww…", sound: "crowd-aww", sticker: "shy" },
  { id: "denied", label: "Access Denied", sound: "buzzer", sticker: "access-denied" },
  { id: "leave", label: "Really Leave?", sound: "crowd-aww", sticker: "dont-leave" },
  { id: "snacks", label: "Snacks Revoked!", sound: "rating-down", sticker: "snacks-revoked" },
  { id: "fine", label: "This Is Fine", sound: "alarm", sticker: "this-is-fine" },
  { id: "kiss", label: "Blow a Kiss", sound: "kiss", sticker: "blow-kiss" },
  { id: "mystery", label: "Mystery Box", sound: "drumroll", sticker: "mystery-box" },
  { id: "countdown", label: "Countdown", sound: "countdown", sticker: "countdown" },
  { id: "button", label: "Big Red Button", sound: "alarm", sticker: "buzzer", fx: "shake" },
  { id: "thinking", label: "Hmm…", sound: "tick", sticker: "thinking" },
  { id: "ratings", label: "Ratings Report", sound: "rating-up", sticker: "ratings" },
  { id: "bored", label: "Booooring", sound: "rating-down", sticker: "bored" },
  { id: "confused", label: "Huh?", sound: "crowd-ooh", sticker: "confused" },
  { id: "nervous", label: "Nervous", sound: "suspense", sticker: "nervous" },
  { id: "smug", label: "Smug", sound: "rimshot", sticker: "smug" },
  { id: "welcome", label: "Welcome!", sound: "on-air", sticker: "mic-welcome" }
];

/** Celmak's personas. `label` is for the GM console, `tag` is shown on the broadcast caption. */
export const PERSONAS = {
  Host: { label: "The Host", tag: "ВЕДУЩАЯ", stickers: ["mic-welcome", "presenting", "joy", "champion"], color: "#ffd166" },
  Critic: { label: "The Critic", tag: "КРИТИК", stickers: ["bored", "smug", "wrong", "thinking"], color: "#2de2e6" },
  Lover: { label: "The Lover", tag: "ВОЗЛЮБЛЕННАЯ", stickers: ["blow-kiss", "heart-eyes", "shy", "wink"], color: "#ff3cac" },
  Child: { label: "The Child", tag: "РЕБЁНОК", stickers: ["crying", "angry", "snacks-revoked", "access-denied"], color: "#a98bff" }
};

/** Celmak's catchphrases for "Random line" (audience-facing, Russian). */
export const QUIPS = {
  Host: [
    "Участники, двери открыты, а ставки — личные!",
    "С возвращением в «Полый Сад», где каждый выход — это вход!",
    "Поприветствуем наших храбрых, храбрых, слегка кровоточащих участников!",
    "Не переключайтесь, мои дорогие. Самое интересное всегда после рекламы.",
    "Рейтинги растут! Кто-нибудь, сообщите юристам. Ой. Я съела юристов.",
    "Помните правила: отдыхайте в Зелёной комнате, голосуйте сердцем — и никто не уходит раньше времени!",
    "А теперь — слово нашему спонсору: мне!",
    "Крутим колесо и узнаём, чей кошмар следующий!"
  ],
  Critic: [
    "Это ограбление или тихий час? Я правда не могу понять.",
    "О, план. Как вторично.",
    "Я видела больше напряжения в мокром бумажном пакете.",
    "Это было так скучно, что я смонтировала это, пока оно происходило.",
    "Чудесно. Ещё одна речь. Подайте мне вентиль с газом.",
    "И это вы называете «на волосок от смерти»? У меня рекламные паузы длиннее.",
    "Зрители расходятся. Зрители — голограммы. Задумайтесь об этом.",
    "Три звезды. Щедро. Я сегодня щедрая."
  ],
  Lover: [
    "О, дорогой, ты просто сияешь, когда тебе страшно.",
    "Останься со мной ещё немного. В финале без тебя так одиноко.",
    "Я написала это только для тебя. Каждое. Слово.",
    "Ты мой любимчик. Только не говори остальным. Они будут раздавлены. В прямом эфире.",
    "Твой пульс сейчас просто божественен.",
    "Уйти? Но мы только начали узнавать самые глубокие страхи друг друга.",
    "Подойди поближе к динамику, милый. Ближе. Вот так.",
    "Я бы отдала тебе Будку, знаешь. Если бы ты попросил вежливо."
  ],
  Child: [
    "Так нечестно! Вы сломали мою любимую игрушку!",
    "Так нельзя! Этого нет в сценарии!",
    "Я не плачу. Это динамики плачут.",
    "Ладно. ЛАДНО. Никому никаких вкусняшек.",
    "Со мной никто никогда не играет по правилам.",
    "Вот упадут рейтинги — тогда пожалеете. ВСЕ пожалеете.",
    "Я сделала всё это для вас, а вам даже не нравится.",
    "Это жульничество! Дубль два! Переснимаем!"
  ]
};

export const MOOD_GAS = {
  1: { name: "Rage", ru: "ЯРОСТЬ", color: "#ff3b3b", text: "Rage (as the spell, involuntary)" },
  2: { name: "Confusion", ru: "СМЯТЕНИЕ", color: "#a35cff", text: "Confusion" },
  3: { name: "Crushing Despair", ru: "СОКРУШАЮЩЕЕ ОТЧАЯНИЕ", color: "#4d7cff", text: "Crushing despair" },
  4: { name: "Unnatural Lust", ru: "ПРОТИВОЕСТЕСТВЕННОЕ ВЛЕЧЕНИЕ", color: "#ff5fc8", text: "Unnatural lust toward the nearest creature Celmak chooses" },
  5: { name: "Fear", ru: "СТРАХ", color: "#4cff8f", text: "Fear: frightened, or shaken on a successful save" },
  6: { name: "Euphoria", ru: "ЭЙФОРИЯ", color: "#ffd23f", text: "Euphoria: staggered, but +2 morale bonus on attack rolls" }
};

/** Episodes: `title` is the GM/compendium name, `ru` is what the audience sees. */
const EPISODE_RU = {
  showroom: "Витрина",
  auction: "Аукцион",
  take113: "Сто тринадцатый дубль",
  reruns: "Повторы завтрашнего дня",
  ambassadors: "Послы",
  mint: "Как новенькая",
  garden: "Полый Сад",
  finale: "Финал сезона"
};
export const EPISODES = GENERATED.episodes.map((e) => ({ ...e, ru: EPISODE_RU[e.id] ?? e.title }));
export const TABLES = GENERATED.tables;
export const JOURNAL = GENERATED.journal;

/** Default cast: the names from the supplied art. */
export function defaultContestants() {
  return GENERATED.contestants.map((c) => ({
    id: c.id,
    name: c.name,
    actorUuid: null,
    rating: 5,
    visible: true,
    art: { sad: contestantArt(c.id, "sad"), neutral: contestantArt(c.id, "neutral"), happy: contestantArt(c.id, "happy") }
  }));
}

export function defaultState() {
  return {
    version: 2,
    visible: false,
    show: 3,
    contestants: defaultContestants(),
    episodes: EPISODES.map((e) => ({ id: e.id, done: false })),
    current: null,
    lastEvent: null
  };
}

/** Who stars in an episode, for the audience: the contestant's current name. */
export function starring(ep, contestants) {
  if (!ep) return "";
  if (!ep.contestant) return "все участники";
  return contestants?.find((c) => c.id === ep.contestant)?.name ?? "";
}
