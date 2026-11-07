import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { convert, trace, benchmark } = require('../src/shared/regex-flavors.js');

test('named groups convert per flavour', () => {
  assert.equal(convert('(?<host>\\w+)\\.\\k<host>', 'python').pattern, '(?P<host>\\w+)\\.(?P=host)');
  assert.equal(convert('(?<host>\\w+)', 'go').pattern, '(?P<host>\\w+)');
  assert.equal(convert('(?<host>\\w+)', 'dotnet').pattern, '(?<host>\\w+)');
});

test('unsupported constructs are reported, never silently dropped', () => {
  const r = convert('foo(?=bar)', 'go');
  assert.equal(r.exact, false);
  assert.match(r.notes.join(' '), /Lookaround/);
  const b = convert('(a)\\1', 'rust');
  assert.equal(b.exact, false);
});

test('POSIX shorthand classes expand', () => {
  const r = convert('\\d+\\s[\\w-]+', 'posix');
  assert.equal(r.pattern, '[0-9]+[[:space:]][[:alnum:]_-]+');
  assert.equal(r.exact, true);
});

test('unicode escapes', () => {
  assert.equal(convert('\\u{1F600}', 'python').pattern, '\\U0001F600');
  assert.equal(convert('\\u00e9', 'pcre').pattern, '\\x{00e9}');
});

test('literals carry flags', () => {
  assert.equal(convert('a.b', 'python', { i: true, s: true }).literal, 're.compile(r"a.b", re.I | re.S)');
  assert.equal(convert('a', 'go', { i: true }).literal, 'regexp.MustCompile(`(?i)a`)');
});

test('trace lists attempts and matches', () => {
  const s = trace('\\d+', 'g', 'a12b3');
  assert.deepEqual(s.filter((x) => x.matched).map((x) => [x.at, x.text]), [[1, '12'], [4, '3']]);
});

test('benchmark reports each variant', () => {
  const b = benchmark('\\w+', 'g', 'hello world '.repeat(50), 3);
  assert.equal(b.length, 4);
  assert.ok(b.every((x) => x.error || x.matches === 100));
});

test('python literals are raw strings with backslashes intact', () => {
  assert.equal(convert('\\d+\\s', 'python').literal, 're.compile(r"\\d+\\s")');
  assert.equal(convert('say "hi"', 'python').literal, `re.compile(r'say "hi"')`);
});
