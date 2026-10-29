import { GENERATED } from "./data/generated.js";

export const MODULE_ID = "hollow-garden";
export const SOCKET = `module.${MODULE_ID}`;
export const PATH = `modules/${MODULE_ID}`;

export const asset = (p) => `${PATH}/${p}`;
export const sound = (k) => `${PATH}/sounds/${k}.ogg`;
export const sticker = (k) => `${PATH}/assets/host/${k}.webp`;
export const contestantArt = (id, mood) => `${PATH}/assets/contestants/${id}-${mood}.webp`;

export const RATING_MAX = 10;
export const SHOW_MIN = 1;
export const SHOW_MAX = 5;

/** Mood thresholds for contestant portraits. */
export function moodFor(rating) {
  if (rating <= 3) return "sad";
  if (rating >= 7) return "happy";
  return "neutral";
}

/** Celmak's response to each Show Rating (from "Running the Garden"). */
export const SHOW_RESPONSES = {
  1: { label: "ESCALATION", text: "Mood Gas vent, a demon cast member, a room reconfiguration, or an audience vote that splits the party. Then resets to 2." },
  2: { label: "SNIDE", text: "Snide commentary; the next encounter gains one Stagehand Drone." },
  3: { label: "NEUTRAL", text: "Neutral." },
  4: { label: "PRAISE", text: "Praise; the next Mood Gas vent uses good hope instead." },
  5: { label: "PEAK", text: "Hands the highest-rated contestant a Trinket, then resets to 3." }
};

/** Quick reasons for the Show Rating, straight from the adventure. */
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

export const PERSONAS = {
  Host: { label: "The Host", stickers: ["mic-welcome", "presenting", "joy", "champion"], color: "#ffd166" },
  Critic: { label: "The Critic", stickers: ["bored", "smug", "wrong", "thinking"], color: "#2de2e6" },
  Lover: { label: "The Lover", stickers: ["blow-kiss", "heart-eyes", "shy", "wink"], color: "#ff3cac" },
  Child: { label: "The Child", stickers: ["crying", "angry", "snacks-revoked", "access-denied"], color: "#a98bff" }
};

export const MOOD_GAS = {
  1: { name: "Rage", color: "#ff3b3b", text: "Rage (as the spell, involuntary)" },
  2: { name: "Confusion", color: "#a35cff", text: "Confusion" },
  3: { name: "Crushing Despair", color: "#4d7cff", text: "Crushing despair" },
  4: { name: "Unnatural Lust", color: "#ff5fc8", text: "Unnatural lust toward the nearest creature Celmak chooses" },
  5: { name: "Fear", color: "#4cff8f", text: "Fear: frightened, or shaken on a successful save" },
  6: { name: "Euphoria", color: "#ffd23f", text: "Euphoria: staggered, but +2 morale bonus on attack rolls" }
};

export const EPISODES = GENERATED.episodes;
export const TABLES = GENERATED.tables;
export const JOURNAL = GENERATED.journal;

export function defaultContestants() {
  return GENERATED.contestants.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    actorUuid: null,
    rating: 5,
    visible: true,
    art: { sad: contestantArt(c.id, "sad"), neutral: contestantArt(c.id, "neutral"), happy: contestantArt(c.id, "happy") }
  }));
}

export function defaultState() {
  return {
    version: 1,
    visible: false,
    show: 3,
    contestants: defaultContestants(),
    episodes: EPISODES.map((e) => ({ id: e.id, done: false })),
    current: null,
    lastEvent: null
  };
}
