// A step-by-step backtracking debugger for JavaScript regular expressions. It parses the
// pattern itself and runs a backtracking matcher that records every attempt, match, failure
// and backtrack, so a person can watch the engine work. Its final answer is checked against
// the real engine in test/regex-debug.test.mjs; constructs it cannot step through are refused
// with a plain reason instead of being guessed at.

class Unsupported extends Error {}

// ---------------- parser ----------------
// Node shapes: { t: 'char', ch } | { t: 'any' } | { t: 'class', items, neg } | { t: 'esc', k }
// | { t: 'bol' } | { t: 'eol' } | { t: 'wordb', neg } | { t: 'seq', items } | { t: 'alt', items }
// | { t: 'group', cap, name, body } | { t: 'look', neg, body } | { t: 'rep', min, max, lazy, body }
// | { t: 'backref', n, name }. Every node carries its pattern span as s (start) and e (end).
function parse(src, flags = '') {
  let i = 0, groups = 0;
  const names = {};
  const uni = flags.includes('u') || flags.includes('v');
  // Without any named group, \k is just the letter k (outside Unicode mode), as in the real engine.
  const hasNames = /\(\?<(?![=!])/.test(src);
  if (flags.includes('v')) throw new Unsupported('The v flag (set notation) is not stepped through yet.');
  const peek = () => src[i];
  const eat = (c) => (src[i] === c ? (i++, true) : false);
  const hex = (n) => { const h = src.slice(i, i + n); if (!new RegExp(`^[0-9a-fA-F]{${n}}$`).test(h)) return null; i += n; return parseInt(h, 16); };
  const escapeAtom = (inClass) => {
    const c = src[i++];
    if (c === undefined) throw new SyntaxError('The pattern ends with a lone backslash.');
    if ('dDwWsS'.includes(c)) return { t: 'esc', k: c };
    if (!inClass && (c === 'b' || c === 'B')) return { t: 'wordb', neg: c === 'B' };
    if (inClass && c === 'b') return { t: 'char', ch: '\b' };
    const simple = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', 0: '\0' };
    if (c in simple && !(c === '0' && /[0-9]/.test(src[i] || ''))) return { t: 'char', ch: simple[c] };
    if (c === 'x') { const v = hex(2); if (v !== null) return { t: 'char', ch: String.fromCharCode(v) }; return { t: 'char', ch: 'x' }; }
    if (c === 'u') {
      if (uni && src[i] === '{') { const j = src.indexOf('}', i); const v = parseInt(src.slice(i + 1, j), 16); i = j + 1; return { t: 'char', ch: String.fromCodePoint(v) }; }
      const v = hex(4); if (v !== null) return { t: 'char', ch: String.fromCharCode(v) }; return { t: 'char', ch: 'u' };
    }
    if (c === 'c' && /[A-Za-z]/.test(src[i] || '')) return { t: 'char', ch: String.fromCharCode(src[i++].charCodeAt(0) % 32) };
    if (c === 'p' || c === 'P') throw new Unsupported('Unicode property escapes (\\p{…}) are not stepped through yet.');
    if (!inClass && /[1-9]/.test(c)) { let d = c; while (/[0-9]/.test(src[i] || '')) d += src[i++]; return { t: 'backref', n: Number(d) }; }
    if (!inClass && c === 'k' && src[i] === '<' && hasNames) { const j = src.indexOf('>', i); const name = src.slice(i + 1, j); i = j + 1; return { t: 'backref', name }; }
    return { t: 'char', ch: c };
  };
  const classNode = () => {
    const s = i - 1;
    const neg = eat('^');
    const items = [];
    let first = true;
    while (i < src.length && (src[i] !== ']' || (first && false))) {
      first = false;
      let a = src[i] === '\\' ? (i++, escapeAtom(true)) : { t: 'char', ch: src[i++] };
      if (src[i] === '-' && src[i + 1] !== undefined && src[i + 1] !== ']' && a.t === 'char') {
        i++;
        const b = src[i] === '\\' ? (i++, escapeAtom(true)) : { t: 'char', ch: src[i++] };
        if (b.t !== 'char') { items.push(a, { t: 'char', ch: '-' }, b); continue; }
        if (b.ch.codePointAt(0) < a.ch.codePointAt(0)) throw new SyntaxError(`The range ${a.ch}-${b.ch} is out of order.`);
        a = { t: 'range', from: a.ch, to: b.ch };
      }
      items.push(a);
    }
    if (!eat(']')) throw new SyntaxError('A character class is missing its closing ].');
    return { t: 'class', items, neg, s, e: i };
  };
  const atom = () => {
    const s = i;
    const c = src[i++];
    let n;
    if (c === '.') n = { t: 'any' };
    else if (c === '^') n = { t: 'bol' };
    else if (c === '$') n = { t: 'eol' };
    else if (c === '[') return classNode();
    else if (c === '\\') n = escapeAtom(false);
    else if (c === '(') {
      if (eat('?')) {
        if (eat(':')) n = { t: 'group', cap: false, body: alt() };
        else if (eat('=')) n = { t: 'look', neg: false, body: alt() };
        else if (eat('!')) n = { t: 'look', neg: true, body: alt() };
        else if (src[i] === '<' && (src[i + 1] === '=' || src[i + 1] === '!')) throw new Unsupported('Lookbehind is not stepped through yet.');
        else if (eat('<')) { const j = src.indexOf('>', i); const name = src.slice(i, j); i = j + 1; const num = ++groups; names[name] = num; n = { t: 'group', cap: true, num, name, body: alt() }; }
        else throw new Unsupported(`The group (?${src[i] || ''} is not stepped through yet.`);
      } else { const num = ++groups; n = { t: 'group', cap: true, num, body: alt() }; }
      if (!eat(')')) throw new SyntaxError('A group is missing its closing ).');
    } else if (c === ')' ) throw new SyntaxError('There is a ) without a matching (.');
    else if ('*+?'.includes(c)) throw new SyntaxError(`Nothing to repeat before ${c}.`);
    else n = { t: 'char', ch: c };
    n.s = s; n.e = i;
    return n;
  };
  const quant = (n) => {
    const s = n.s;
    for (;;) {
      let min, max;
      const q = i;
      if (eat('*')) { min = 0; max = Infinity; }
      else if (eat('+')) { min = 1; max = Infinity; }
      else if (eat('?')) { min = 0; max = 1; }
      else if (src[i] === '{' && /^\{\d+(,\d*)?\}/.test(src.slice(i))) {
        const m = src.slice(i).match(/^\{(\d+)(,(\d*))?\}/);
        i += m[0].length; min = Number(m[1]); max = m[2] ? (m[3] ? Number(m[3]) : Infinity) : min;
        if (max < min) throw new SyntaxError('A {min,max} range has min greater than max.');
      } else return n;
      if (['bol', 'eol', 'wordb', 'look'].includes(n.t)) throw new SyntaxError('An anchor or lookaround cannot be repeated.');
      const lazy = eat('?');
      n = { t: 'rep', min, max, lazy, body: n, s, e: i, qs: q };
    }
  };
  const seq = () => {
    const s = i, items = [];
    while (i < src.length && src[i] !== '|' && src[i] !== ')') items.push(quant(atom()));
    return { t: 'seq', items, s, e: i };
  };
  const alt = () => {
    const s = i, items = [seq()];
    while (eat('|')) items.push(seq());
    return items.length === 1 ? items[0] : { t: 'alt', items, s, e: i };
  };
  const root = alt();
  if (i < src.length) throw new SyntaxError('There is a ) without a matching (.');
  return { root, groups, names };
}

// ---------------- matcher ----------------
const groupsIn = (n, out = []) => {
  if (!n) return out;
  if (n.t === 'group' && n.cap) out.push(n.num);
  for (const x of n.items || []) groupsIn(x, out);
  if (n.body) groupsIn(n.body, out);
  return out;
};
const isWord = (c) => !!c && /[A-Za-z0-9_]/.test(c);
const ESC = { d: /\d/, D: /\D/, w: /\w/, W: /\W/, s: /\s/, S: /\S/ };
const ESC_NAME = { d: 'digit', D: 'non-digit', w: 'word character', W: 'non-word character', s: 'space', S: 'non-space' };

function describe(n) {
  if (n.t === 'char') return JSON.stringify(n.ch);
  if (n.t === 'any') return 'any character';
  if (n.t === 'esc') return 'a ' + ESC_NAME[n.k];
  if (n.t === 'class') return (n.neg ? 'a character not in ' : 'one of ') + 'the class';
  return n.t;
}

/**
 * Runs the pattern over the text and records every step. Returns { steps, total, backtracks,
 * match, groups, limited, groupCount }. steps holds at most `keep` entries; total counts them all
 * up to `limit`, after which the run stops and `limited` is true.
 */
function debug(src, flags = '', text = '', { keep = 4000, limit = 200000 } = {}) {
  const { root, groups: groupCount, names } = parse(src, flags);
  const ci = flags.includes('i'), multi = flags.includes('m'), dotAll = flags.includes('s');
  const same = (a, b) => (ci ? a.toLowerCase() === b.toLowerCase() || a.toUpperCase() === b.toUpperCase() : a === b);
  const steps = [];
  let total = 0, backtracks = 0;
  class Limit extends Error {}
  const step = (kind, n, pos, note) => {
    total++;
    if (kind === 'backtrack') backtracks++;
    if (steps.length < keep) steps.push({ i: total, kind, s: n ? (n.t === 'rep' ? n.qs : n.s) : 0, e: n ? n.e : 0, pos, note });
    if (total >= limit) throw new Limit();
  };
  let caps = new Array(groupCount + 1).fill(null);
  const classHas = (n, c) => {
    for (const it of n.items) {
      if (it.t === 'char' && same(it.ch, c)) return true;
      if (it.t === 'range') { const x = c.codePointAt(0); const lo = it.from.codePointAt(0), hi = it.to.codePointAt(0); if (x >= lo && x <= hi) return true; if (ci) { const l = c.toLowerCase().codePointAt(0), u = c.toUpperCase().codePointAt(0); if ((l >= lo && l <= hi) || (u >= lo && u <= hi)) return true; } }
      if (it.t === 'esc' && ESC[it.k].test(c)) return true;
    }
    return false;
  };
  const one = (n, c) => {
    if (c === undefined) return false;
    if (n.t === 'char') return same(n.ch, c);
    if (n.t === 'any') return dotAll || !'\n\r  '.includes(c);
    if (n.t === 'esc') return ESC[n.k].test(c);
    if (n.t === 'class') return classHas(n, c) !== n.neg;
    return false;
  };
  // m(node, pos, k): match node at pos, then call k with the new position. True stops the search.
  const m = (n, pos, k) => {
    switch (n.t) {
      case 'char': case 'any': case 'esc': case 'class': {
        const c = text[pos];
        if (one(n, c)) { step('match', n, pos, `match ${JSON.stringify(c)}`); return k(pos + 1); }
        step('fail', n, pos, c === undefined ? 'end of the text' : `no ${describe(n)} here`);
        return false;
      }
      case 'bol': { const ok = pos === 0 || (multi && '\n\r'.includes(text[pos - 1])); step(ok ? 'match' : 'fail', n, pos, ok ? 'start of a line' : 'not the start of a line'); return ok && k(pos); }
      case 'eol': { const ok = pos === text.length || (multi && '\n\r'.includes(text[pos])); step(ok ? 'match' : 'fail', n, pos, ok ? 'end of a line' : 'not the end of a line'); return ok && k(pos); }
      case 'wordb': { const at = isWord(text[pos - 1]) !== isWord(text[pos]); const ok = at !== n.neg; step(ok ? 'match' : 'fail', n, pos, ok ? (n.neg ? 'not a word boundary' : 'word boundary') : (n.neg ? 'a word boundary' : 'no word boundary')); return ok && k(pos); }
      case 'seq': {
        const go = (idx, p) => (idx === n.items.length ? k(p) : m(n.items[idx], p, (q) => go(idx + 1, q)));
        return go(0, pos);
      }
      case 'alt': {
        for (let a = 0; a < n.items.length; a++) {
          if (a) step('backtrack', n.items[a], pos, `try alternative ${a + 1}`);
          if (m(n.items[a], pos, k)) return true;
        }
        return false;
      }
      case 'group': {
        if (!n.cap) return m(n.body, pos, k);
        const old = caps[n.num];
        const ok = m(n.body, pos, (p) => { const prev = caps[n.num]; caps[n.num] = [pos, p]; if (k(p)) return true; caps[n.num] = prev; return false; });
        if (!ok) caps[n.num] = old;
        return ok;
      }
      case 'look': {
        const saved = caps.slice();
        const hit = m(n.body, pos, () => true);
        if (n.neg) caps = saved;
        const ok = hit !== n.neg;
        step(ok ? 'match' : 'fail', n, pos, n.neg ? (ok ? 'nothing ahead matches, as required' : 'something ahead matches, so this fails') : (ok ? 'what follows matches' : 'what follows does not match'));
        if (!ok) { caps = saved; return false; }
        if (k(pos)) return true;
        caps = saved;
        return false;
      }
      case 'backref': {
        const num = n.name ? names[n.name] : n.n;
        const c = caps[num];
        if (!c) { step('match', n, pos, 'the group has not matched, so this matches nothing'); return k(pos); }
        const want = text.slice(c[0], c[1]);
        const got = text.slice(pos, pos + want.length);
        const ok = got.length === want.length && [...want].every((ch, x) => same(ch, got[x]));
        step(ok ? 'match' : 'fail', n, pos, ok ? `match ${JSON.stringify(want)} again` : `no ${JSON.stringify(want)} here`);
        return ok && k(pos + want.length);
      }
      case 'rep': {
        const inner = n.inner || (n.inner = groupsIn(n.body));
        const rep = (count, p) => {
          const more = () => {
            if (count >= n.max) return false;
            step('repeat', n, p, `repeat: try number ${count + 1}`);
            // Each new round starts with the groups inside it unset, as the real engine does.
            const saved = inner.map((g) => caps[g]);
            for (const g of inner) caps[g] = null;
            if (m(n.body, p, (q) => (q === p && count >= n.min ? false : rep(count + 1, q)))) return true;
            inner.forEach((g, x) => { caps[g] = saved[x]; });
            return false;
          };
          if (count < n.min) return more();
          if (n.lazy) {
            if (k(p)) return true;
            if (count >= n.max) return false;
            step('backtrack', n, p, 'lazy: take one more and try again');
            return more();
          }
          if (more()) return true;
          if (count < n.max) step('backtrack', n, p, count ? `give back: continue with ${count}` : 'continue with none');
          return k(p);
        };
        return rep(0, pos);
      }
      default: throw new Unsupported(`The ${n.t} construct is not stepped through yet.`);
    }
  };
  let match = null, limited = false;
  try {
    for (let start = 0; start <= text.length; start++) {
      caps = new Array(groupCount + 1).fill(null);
      step('start', null, start, `start an attempt at position ${start}`);
      let end = -1;
      if (m(root, start, (p) => { end = p; return true; })) {
        match = [start, end];
        step('success', null, end, `match found: ${JSON.stringify(text.slice(start, end))}`);
        break;
      }
      if (flags.includes('y')) break;
    }
    if (!match) step('nomatch', null, text.length, 'no match anywhere in the text');
  } catch (e) {
    if (e instanceof Limit) limited = true; else throw e;
  }
  const groupsOut = match ? caps.slice(1).map((c) => (c ? text.slice(c[0], c[1]) : undefined)) : null;
  return { steps, total, backtracks, match, groups: groupsOut, limited, groupCount, names };
}

/** The pattern split into the tokens the step view highlights, with their spans. */
function tokens(src, flags = '') {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.t === 'seq') return n.items.forEach(walk);
    if (n.t === 'alt') { n.items.forEach((x, idx) => { if (idx) out.push({ s: x.s - 1, e: x.s, text: '|' }); walk(x); }); return; }
    if (n.t === 'group' || n.t === 'look') { const open = n.body.s; out.push({ s: n.s, e: open, text: src.slice(n.s, open) }); walk(n.body); out.push({ s: n.e - 1, e: n.e, text: ')' }); return; }
    if (n.t === 'rep') { walk(n.body); out.push({ s: n.qs, e: n.e, text: src.slice(n.qs, n.e), rep: n }); return; }
    out.push({ s: n.s, e: n.e, text: src.slice(n.s, n.e) });
  };
  walk(parse(src, flags).root);
  return out.sort((a, b) => a.s - b.s);
}

module.exports = { parse, debug, tokens, Unsupported };
