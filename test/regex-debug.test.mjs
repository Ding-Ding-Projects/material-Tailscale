import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { debug, tokens, Unsupported } = require('../src/shared/regex-debug.js');

// Differential check: the debugger's answer must equal the real engine's for every case.
const CASES = [
  ['a+b', '', 'xxaaab'], ['^(a+)+b', '', 'aaaac'], ['(a|ab)(c|bcd)(d*)', '', 'abcd'],
  ['(?<host>[a-z0-9-]+)\\s+(?<ip>100(?:\\.\\d{1,3}){3})', '', 'build-box  100.88.21.6'],
  ['colou?r', 'i', 'The COLOR wheel'], ['\\bbird\\b', '', 'songbird bird'], ['a.c', '', 'a\nc abc'], ['a.c', 's', 'a\nc'],
  ['^b', 'm', 'a\nb'], ['x$', 'm', 'x\ny'], ['(\\w+)\\s\\1', '', 'hello hello world'], ['\\k<w>', '', 'zz'],
  ['(?<w>z)\\k<w>', '', 'azz'], ['a{2,3}', '', 'aaaa'], ['a{2,}?', '', 'aaaa'], ['a+?b', '', 'aaab'], ['(a*)*b', '', 'aab'],
  ['[^0-9]+', '', '123abc456'], ['[a-c-]+', '', 'x-ab-c'], ['(?=(\\d))\\d+', '', 'ab123'], ['q(?!u)', '', 'quit qat'],
  ['(?:(a)|b)+', '', 'ab'], ['(a)|b', '', 'b'], ['', '', 'abc'], ['x*', '', 'abc'], ['\\d{3}-\\d{4}', '', 'call 555-0100 now'],
  ['[\\w.]+@[\\w.]+', '', 'mail me at me@example.test.'], ['\\x41\\u0042', '', 'xAB'], ['[\\s\\S]{2}', '', 'ab'],
  ['(a|b)*c', '', 'ababababx'], ['^(?:a|aa)+$', '', 'aaaa'], ['([A-Z])\\w*', 'i', '9 hello']
];

test('the debugger finds exactly what the real engine finds', () => {
  for (const [src, flags, text] of CASES) {
    const real = new RegExp(src, flags).exec(text);
    const d = debug(src, flags, text);
    assert.equal(d.limited, false, `${src} hit the step limit`);
    if (!real) { assert.equal(d.match, null, `${src} on ${JSON.stringify(text)} should not match`); continue; }
    assert.deepEqual(d.match, [real.index, real.index + real[0].length], `${src} span on ${JSON.stringify(text)}`);
    assert.deepEqual(d.groups, real.slice(1), `${src} groups on ${JSON.stringify(text)}`);
  }
});

test('every step is recorded and counted, and backtracking is visible', () => {
  const d = debug('^(a+)+b', '', 'aaaac');
  assert.equal(d.match, null);
  assert.ok(d.total > 40, `expected many steps, got ${d.total}`);
  assert.ok(d.backtracks > 5, `expected backtracks, got ${d.backtracks}`);
  assert.deepEqual(new Set(d.steps.map((s) => s.kind)), new Set(['start', 'match', 'fail', 'repeat', 'backtrack', 'nomatch']));
  assert.ok(d.steps.every((s, i) => s.i === i + 1));
  // Nested repeats grow quickly: ten more letters cost far more steps.
  assert.ok(debug('^(a+)+b', '', 'aaaaaaaaaaaaaac').total > d.total * 100);
});

test('a runaway pattern stops at the step limit instead of hanging', () => {
  const d = debug('^(a+)+b', '', 'a'.repeat(40) + 'c', { limit: 5000, keep: 100 });
  assert.equal(d.limited, true);
  assert.equal(d.total, 5000);
  assert.equal(d.steps.length, 100);
});

test('tokens cover the pattern for the step view', () => {
  assert.deepEqual(tokens('^(a+)+b').map((t) => t.text), ['^', '(', 'a', '+', ')', '+', 'b']);
  assert.deepEqual(tokens('(?:x|yz)?').map((t) => t.text), ['(?:', 'x', '|', 'y', 'z', ')', '?']);
});

test('constructs it cannot step through are refused with a reason, never guessed', () => {
  assert.throws(() => debug('(?<=a)b', '', 'ab'), Unsupported);
  assert.throws(() => debug('\\p{L}', 'u', 'a'), Unsupported);
  assert.throws(() => debug('a)', '', 'a'), SyntaxError);
});
