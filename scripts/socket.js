import { SOCKET } from "./constants.js";

const handlers = new Map();

export function registerHandler(type, fn) {
  handlers.set(type, fn);
}

function dispatch(msg) {
  const fn = handlers.get(msg?.type);
  if (!fn) return;
  try {
    fn(msg.data ?? {}, msg);
  } catch (err) {
    console.error("Hollow Garden | effect failed", msg, err);
  }
}

export function initSocket() {
  game.socket.on(SOCKET, (msg) => {
    if (msg?.users && !msg.users.includes(game.user.id)) return;
    dispatch(msg);
  });
}

/**
 * Run an effect for everyone. With `{ local: false }` only remote clients see it;
 * with `{ only: [userIds] }` only those users see it.
 */
export function broadcast(type, data = {}, { local = true, only = null } = {}) {
  const msg = { type, data, from: game.user.id, users: only ?? undefined };
  game.socket.emit(SOCKET, msg);
  if (local && (!only || only.includes(game.user.id))) dispatch(msg);
}
