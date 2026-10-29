import { sound } from "./constants.js";
import { setting } from "./util.js";

const PRELOAD = ["tick", "rating-up", "rating-down", "applause", "fanfare", "drumroll", "correct", "buzzer"];

export function preloadSounds() {
  const helper = foundry?.audio?.AudioHelper;
  if (!helper?.preloadSound) return;
  for (const k of PRELOAD) helper.preloadSound(sound(k)).catch?.(() => {});
}

/**
 * Play one of the module's sound effects locally. Volume follows the client "SFX volume" setting
 * and the core interface channel.
 */
export function playSfx(key, { volume = 1, loop = false } = {}) {
  if (!key) return null;
  const base = Number(setting("sfxVolume") ?? 0.8);
  const vol = Math.max(0, Math.min(1, base * volume));
  if (vol <= 0) return null;
  const src = key.includes("/") ? key : sound(key);
  const helper = foundry?.audio?.AudioHelper ?? globalThis.AudioHelper;
  try {
    return helper.play({ src, volume: vol, autoplay: true, loop, channel: "interface" }, false);
  } catch (err) {
    console.warn("Hollow Garden | could not play sound", src, err);
    return null;
  }
}

/** Stop a sound returned by playSfx (works with Foundry Sound objects and plain HTMLAudioElements). */
export function stopSfx(handle) {
  if (!handle) return;
  Promise.resolve(handle)
    .then((s) => {
      if (!s) return;
      if (typeof s.stop === "function") s.stop({ fade: 300 });
      else if (typeof s.pause === "function") s.pause();
    })
    .catch(() => {});
}
