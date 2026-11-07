// Converts a JavaScript regular expression into other common flavours and
// reports every construct that cannot be carried over exactly. The converter
// never claims success for a construct it had to drop or approximate.

const FLAVORS = {
  js: 'JavaScript (ECMAScript)',
  pcre: 'PCRE / PHP / Perl',
  python: 'Python re',
  dotnet: '.NET',
  java: 'Java',
  go: 'Go (RE2)',
  rust: 'Rust regex',
  posix: 'POSIX ERE (grep -E, sed -E)'
};

const NO_LOOKAROUND = new Set(['go', 'rust', 'posix']);
const NO_BACKREF = new Set(['go', 'rust', 'posix']);

/** Splits a pattern into tokens, keeping escapes and classes whole. */
function tokenize(src) {
  const out = [];
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === '\\') {
      let j = i + 2;
      if (/[uxpPk]/.test(src[i + 1]) && src[i + 2] === '{') j = src.indexOf('}', i) + 1 || src.length;
      else if (src[i + 1] === 'k' && src[i + 2] === '<') j = src.indexOf('>', i) + 1 || src.length;
      else if (src[i + 1] === 'u') j = i + 6;
      else if (src[i + 1] === 'x') j = i + 4;
      else if (src[i + 1] === 'c') j = i + 3;
      out.push({ t: 'esc', v: src.slice(i, j) }); i = j; continue;
    }
    if (c === '[') {
      let j = i + 1; if (src[j] === '^') j++; if (src[j] === ']') j++;
      while (j < src.length && src[j] !== ']') { if (src[j] === '\\') j++; j++; }
      out.push({ t: 'class', v: src.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (c === '(' && src[i + 1] === '?') {
      const m = src.slice(i).match(/^\(\?(<=|<!|=|!|:|<[A-Za-z_][A-Za-z0-9_]*>)/);
      if (m) { out.push({ t: 'open', v: m[0], kind: m[1] }); i += m[0].length; continue; }
    }
    out.push({ t: c === '(' ? 'open' : c === ')' ? 'close' : 'char', v: c, kind: c === '(' ? 'capture' : undefined });
    i++;
  }
  return out;
}

/** A Python raw string literal that keeps backslashes exactly. */
function pyRaw(p) { const q = !p.includes('"') ? '"' : !p.includes("'") ? "'" : '"""'; return `r${q}${p}${q}`; }

/**
 * @param {string} src JavaScript pattern source
 * @param {string} to target flavour id
 * @param {{ i?: boolean, m?: boolean, s?: boolean, u?: boolean, g?: boolean, y?: boolean }} flags
 * @returns {{ pattern: string, literal: string, notes: string[], exact: boolean }}
 */
function convert(src, to, flags = {}) {
  const notes = [];
  let exact = true;
  const parts = [];
  for (const tk of tokenize(src)) {
    let v = tk.v;
    if (tk.t === 'open' && tk.kind && tk.kind.startsWith('<') && tk.kind !== '<=' && tk.kind !== '<!') {
      const name = tk.kind.slice(1, -1);
      if (to === 'python' || to === 'go' || to === 'rust') v = `(?P<${name}>`;
      if (to === 'posix') { v = '('; notes.push(`Named group "${name}" became a numbered group: POSIX has no names.`); exact = false; }
    }
    if (tk.t === 'open' && ['=', '!', '<=', '<!'].includes(tk.kind) && NO_LOOKAROUND.has(to)) {
      notes.push(`Lookaround ${tk.v} is not supported by ${FLAVORS[to]}; it was kept and will not compile there.`); exact = false;
    }
    if (tk.t === 'open' && tk.kind === ':' && to === 'posix') { v = '('; notes.push('A non-capturing group became a capturing group: POSIX has no (?:...).'); exact = false; }
    if (tk.t === 'esc') {
      const e = tk.v;
      if (/^\\k<(.+)>$/.test(e)) {
        const name = e.slice(3, -1);
        if (to === 'python') v = `(?P=${name})`;
        else if (NO_BACKREF.has(to)) { notes.push(`Back-reference ${e} is not supported by ${FLAVORS[to]}.`); exact = false; }
      } else if (/^\\[1-9]$/.test(e) && NO_BACKREF.has(to)) { notes.push(`Back-reference ${e} is not supported by ${FLAVORS[to]}.`); exact = false; }
      else if (/^\\u\{[0-9a-fA-F]+\}$/.test(e)) {
        const hex = e.slice(3, -1);
        v = to === 'python' ? (hex.length > 4 ? `\\U${hex.padStart(8, '0')}` : `\\u${hex.padStart(4, '0')}`) : ['pcre', 'go', 'rust'].includes(to) ? `\\x{${hex}}` : to === 'java' ? `\\x{${hex}}` : to === 'dotnet' && hex.length <= 4 ? `\\u${hex.padStart(4, '0')}` : e;
        if (to === 'dotnet' && hex.length > 4) { notes.push(`${e} is outside the Basic Multilingual Plane; .NET needs a surrogate pair.`); exact = false; }
        if (to === 'posix') { notes.push(`${e} has no POSIX escape; use the literal character.`); exact = false; }
      } else if (/^\\u[0-9a-fA-F]{4}$/.test(e) && ['pcre', 'go', 'rust'].includes(to)) v = `\\x{${e.slice(2)}}`;
      else if (/^\\[pP]\{/.test(e) && to === 'python') { notes.push(`Unicode property ${e} needs the third-party "regex" module in Python; the standard "re" module rejects it.`); exact = false; }
      else if (/^\\[pP]\{/.test(e) && to === 'posix') { notes.push(`Unicode property ${e} has no POSIX form.`); exact = false; }
      else if (to === 'posix') {
        const map = { '\\d': '[0-9]', '\\D': '[^0-9]', '\\w': '[[:alnum:]_]', '\\W': '[^[:alnum:]_]', '\\s': '[[:space:]]', '\\S': '[^[:space:]]', '\\t': '\t' };
        if (map[e]) v = map[e];
        else if (e === '\\b' || e === '\\B') { notes.push(`${e} is a GNU extension, not POSIX.`); exact = false; }
      }
    }
    if (tk.t === 'class' && to === 'posix') {
      const r = tk.v.replace(/\\d/g, '0-9').replace(/\\w/g, '[:alnum:]_').replace(/\\s/g, '[:space:]');
      if (/\\[DWS]/.test(r)) { notes.push(`Negated shorthand inside ${tk.v} has no POSIX form.`); exact = false; }
      v = r;
    }
    if (tk.t === 'class' && /\\[pP]\{/.test(tk.v) && to === 'python') { notes.push(`Unicode property inside ${tk.v} is not supported by Python re.`); exact = false; }
    parts.push(v);
  }
  let pattern = parts.join('');
  // Lazy quantifiers and anchors carry over everywhere except POSIX.
  if (to === 'posix' && /[*+?}]\?/.test(src)) { notes.push('Lazy quantifiers are not POSIX; they behave as greedy there.'); exact = false; }
  if (flags.y) { notes.push('The sticky flag (y) has no equivalent; anchor the call at the start position instead.'); exact = false; }
  const inline = [flags.i && 'i', flags.m && 'm', flags.s && 's'].filter(Boolean).join('');
  if (flags.s && to === 'posix') { notes.push('Dot-matches-newline has no POSIX flag.'); exact = false; }
  if (flags.m && to === 'posix') { notes.push('Multiline anchors have no POSIX flag; tools like grep match per line already.'); }
  const lit = {
    js: () => `/${pattern.replace(/\//g, '\\/')}/${['g', 'i', 'm', 's', 'u', 'y'].filter((f) => flags[f]).join('')}`,
    pcre: () => `'/${pattern.replace(/\//g, '\\/')}/${inline}${flags.u ? 'u' : ''}'`,
    python: () => `re.compile(${pyRaw(pattern)}${inline ? ', ' + inline.split('').map((f) => ({ i: 're.I', m: 're.M', s: 're.S' })[f]).join(' | ') : ''})`,
    dotnet: () => `new Regex(@"${pattern.replace(/"/g, '""')}"${inline ? ', ' + inline.split('').map((f) => ({ i: 'RegexOptions.IgnoreCase', m: 'RegexOptions.Multiline', s: 'RegexOptions.Singleline' })[f]).join(' | ') : ''})`,
    java: () => `Pattern.compile(${JSON.stringify(pattern)}${inline ? ', ' + inline.split('').map((f) => ({ i: 'Pattern.CASE_INSENSITIVE', m: 'Pattern.MULTILINE', s: 'Pattern.DOTALL' })[f]).join(' | ') : ''})`,
    go: () => `regexp.MustCompile(\`${inline ? `(?${inline})` : ''}${pattern}\`)`,
    rust: () => `Regex::new(r"${inline ? `(?${inline})` : ''}${pattern}")`,
    posix: () => `grep -E${flags.i ? 'i' : ''} '${pattern.replace(/'/g, "'\\''")}'`
  }[to]();
  return { pattern, literal: lit, notes, exact };
}

/** Lists every start position the engine tried and what happened there. */
function trace(src, flags, text, limit = 400) {
  const re = new RegExp(src, flags.replace(/[gy]/g, '') + 'y');
  const steps = [];
  for (let i = 0; i <= text.length && steps.length < limit; i++) {
    re.lastIndex = i;
    const t0 = performance.now();
    const m = re.exec(text);
    const ms = performance.now() - t0;
    steps.push({ at: i, ch: text[i] ?? '(end)', matched: !!m, length: m ? m[0].length : 0, text: m ? m[0] : '', groups: m ? m.slice(1) : [], ms });
    if (m && flags.includes('g') && m[0].length) i += m[0].length - 1;
    else if (m && !flags.includes('g')) break;
  }
  return steps;
}

/** Times the pattern across engine variants. Returns median milliseconds per run. */
function benchmark(src, flags, text, runs = 25) {
  const base = flags.replace(/[uv]/g, '');
  const variants = [['Default', base], ['Unicode (u)', base + 'u'], ['Unicode sets (v)', base + 'v'], ['Case-insensitive', base.includes('i') ? base : base + 'i']];
  const out = [];
  for (const [label, f] of variants) {
    let re;
    try { re = new RegExp(src, f.includes('g') ? f : f + 'g'); } catch (e) { out.push({ label, flags: f, error: e.message }); continue; }
    const times = [];
    let count = 0;
    for (let r = 0; r < runs; r++) { const t0 = performance.now(); count = 0; re.lastIndex = 0; for (const m of text.matchAll(re)) { count++; if (!m[0].length && count > 100000) break; } times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    out.push({ label, flags: f, medianMs: times[Math.floor(times.length / 2)], worstMs: times[times.length - 1], matches: count });
  }
  return out;
}

module.exports = { pyRaw, FLAVORS, convert, trace, benchmark, tokenize };
