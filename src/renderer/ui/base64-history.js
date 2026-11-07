// The Base64 toolkit's history. Every conversion is logged by name, size and SHA-256, never by
// its content unless the person turns on "Keep text in history". Text conversions also form an
// undo timeline (options, input and output before and after), kept in this device's storage so
// undo and redo still work after a restart. File conversions are logged with the path written,
// and undo never deletes a file. Clearing everything goes through super confirmation.

const KEY = 'mt.b64.history.v1';
const KEEP_LIMIT = 256 * 1024; // characters of input or output kept per entry when keeping text

const load = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.log) && Array.isArray(v.stack)) return v; } catch { /* unreadable: start fresh */ }
  return { log: [], stack: [], pos: -1, keepText: false };
};

export function createHistory() {
  let s = load();
  const listeners = new Set();
  const save = () => {
    for (;;) {
      try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch {
        // Out of room: drop kept text from the oldest entries first, then give up quietly.
        const e = s.log.find((x) => x.before?.input !== undefined || x.after?.input !== undefined || x.before?.output !== undefined || x.after?.output !== undefined);
        if (!e) return false;
        for (const snap of [e.before, e.after]) if (snap) { delete snap.input; delete snap.output; snap.dropped = true; }
      }
    }
  };
  const fire = () => listeners.forEach((f) => f(s));
  const snap = (state) => {
    const out = { options: { ...state.options } };
    if (s.keepText) {
      for (const k of ['input', 'output']) {
        const v = state[k] ?? '';
        if (v.length <= KEEP_LIMIT) out[k] = v; else out[`${k}TooLong`] = v.length;
      }
    }
    return out;
  };
  return {
    get state() { return s; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    get keepText() { return s.keepText; },
    setKeepText(on) {
      s.keepText = !!on;
      if (!on) for (const e of s.log) for (const x of [e.before, e.after]) if (x) { delete x.input; delete x.output; }
      save(); fire();
    },
    /** Logs a conversion. Text conversions pass `before` and `after` states to join the undo timeline. */
    add(entry, { before, after } = {}) {
      const e = { id: 'h-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), ...entry };
      if (before && after) {
        e.before = snap(before); e.after = snap(after);
        s.stack = s.stack.slice(0, s.pos + 1);
        s.stack.push(e.id); s.pos = s.stack.length - 1;
      }
      s.log.push(e);
      save(); fire();
      return e;
    },
    canUndo: () => s.pos >= 0,
    canRedo: () => s.pos < s.stack.length - 1,
    /** Returns the state to restore, or null. */
    undo() {
      if (s.pos < 0) return null;
      const e = s.log.find((x) => x.id === s.stack[s.pos]);
      s.pos--; save(); fire();
      return e ? { entry: e, state: e.before } : null;
    },
    redo() {
      if (s.pos >= s.stack.length - 1) return null;
      s.pos++;
      const e = s.log.find((x) => x.id === s.stack[s.pos]);
      save(); fire();
      return e ? { entry: e, state: e.after } : null;
    },
    clear() { s = { log: [], stack: [], pos: -1, keepText: s.keepText }; save(); fire(); }
  };
}
