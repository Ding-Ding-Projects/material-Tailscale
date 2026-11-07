import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ollama = require('../src/main/ollama.js');
const harness = require('../src/main/ollama-harness.js');
const { parseLibrary, parseTags } = require('../src/shared/ollama-catalog.js');
const { fit } = require('../src/shared/ollama-fit.js');

// A small page in the same shape as https://ollama.com/library and a model's tags page.
const libItem = (name, caps, sizes, pulls, tags) => `<li class="flex items-baseline border-b border-neutral-200 py-6"><a href="/library/${name}" class="group w-full space-y-5"><div title="${name}" class="flex flex-col"><h2><span>${name}</span></h2><p class="max-w-lg break-words text-neutral-800 text-md">About ${name} &amp; more</p></div><div class="flex flex-col space-y-2"><div class="flex flex-wrap space-x-2">${caps.map((c) => `<span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs">${c}</span>`).join('')}${sizes.map((s) => `<span class="inline-flex items-center rounded-md bg-[#ddf4ff] px-2 py-0.5 text-xs">${s}</span>`).join('')}</div><p class="flex"><span class="flex items-center"><span >${pulls}</span><span class="hidden sm:flex">&nbsp;Pulls</span></span><span class="flex items-center"><span >${tags}</span><span class="hidden sm:flex">&nbsp;Tags</span></span><span class="flex items-center" title="May 21, 2024 4:54 AM UTC"><svg></svg><span class="hidden sm:flex">Updated&nbsp;</span><span >2 years ago</span></span></p></div></a></li>`;
const LIBRARY = `<ul>${libItem('alpha', ['tools'], ['1b', '3b'], '1.2M', 2)}${libItem('beta', ['vision', 'tools'], ['7b'], '900K', 1)}</ul>`;
const tagItem = (tag, digest, size, ctx, input) => `<a href="/library/${tag}" class="md:hidden flex flex-col space-y-[6px] group"><span>${tag}</span><span class="font-mono">${digest}</span> • ${size} • ${ctx} context window • ${input} input • 1 year ago</a>`;
const TAGS = { alpha: tagItem('alpha:1b', 'aaaaaaaaaaaa', '1.3GB', '128K', 'Text') + tagItem('alpha:3b', 'bbbbbbbbbbbb', '2.0GB', '128K', 'Text'), beta: tagItem('beta:7b', 'cccccccccccc', '6.0GB', '32K', 'Text, Image') };

test('the catalogue pages parse into every model and every tag', () => {
  const lib = parseLibrary(LIBRARY);
  assert.deepEqual(lib.map((m) => m.name), ['alpha', 'beta']);
  assert.deepEqual(lib[1].capabilities, ['vision', 'tools']);
  assert.deepEqual(lib[0].sizes, ['1b', '3b']);
  assert.equal(lib[0].description, 'About alpha & more');
  assert.equal(lib[0].tagCount, 2);
  assert.equal(lib[0].updated, 'May 21, 2024 4:54 AM UTC');
  const tags = parseTags(TAGS.beta, 'beta');
  assert.deepEqual(tags[0], { tag: 'beta:7b', digest: 'cccccccccccc', size: 6e9, sizeText: '6.0GB', context: 32768, contextText: '32K', inputs: ['Text', 'Image'] });
  assert.deepEqual(parseLibrary('<html>a page that changed</html>'), []);
});

function serve(pages) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const body = pages[String(url)];
    if (body === undefined) return new Response('missing', { status: 404 });
    return new Response(body, { status: 200 });
  };
  return () => { globalThis.fetch = real; };
}

test('a refresh reads every page and says so; a missing page makes it incomplete, never curated', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-ol-'));
  ollama.setup({ userData: dir, send: () => {} });
  let restore = serve({ 'https://ollama.com/library': LIBRARY, 'https://ollama.com/library/alpha/tags': TAGS.alpha, 'https://ollama.com/library/beta/tags': TAGS.beta });
  const full = await ollama.refreshCatalog();
  restore();
  assert.equal(full.complete, true);
  assert.equal(full.pages, 3);
  assert.equal(full.modelCount, 2);
  assert.equal(full.tagCount, 3);
  assert.match(full.revision, /^[0-9a-f]{16}$/);
  assert.equal(ollama.catalog().tagCount, 3);
  // Losing a page: the result says which, and the verified catalogue on disk is kept.
  restore = serve({ 'https://ollama.com/library': LIBRARY, 'https://ollama.com/library/alpha/tags': TAGS.alpha });
  const part = await ollama.refreshCatalog();
  restore();
  assert.equal(part.complete, false);
  assert.deepEqual(part.failures, ['beta']);
  assert.equal(ollama.catalog().complete, true);
  assert.equal(ollama.catalog().tagCount, 3);
  // A library page that no longer lists models is refused rather than saved as an empty store.
  restore = serve({ 'https://ollama.com/library': '<html></html>' });
  await assert.rejects(ollama.refreshCatalog(), /no models/);
  restore();
  assert.equal(ollama.catalog().modelCount, 2);
});

test('only documented local endpoints with clean bodies are allowed', () => {
  assert.throws(() => ollama.validate('blobs', {}), /not an allowed/);
  assert.throws(() => ollama.validate('show', { model: '../etc/passwd' }), /not a valid/);
  assert.throws(() => ollama.validate('show', { model: 'a b' }), /not a valid/);
  assert.deepEqual(ollama.validate('copy', { source: 'llama3.2:3b', destination: 'mine:v1' }), { source: 'llama3.2:3b', destination: 'mine:v1' });
  assert.throws(() => ollama.validate('generate', { model: 'x', keep_alive: '1y; rm' }), /keep_alive/);
  assert.equal(ollama.validate('generate', { model: 'x', keep_alive: 0 }).keep_alive, 0);
  assert.throws(() => ollama.validate('chat', { model: 'x', messages: [{ role: 'user', content: 'hi' }], options: { temperature: 9 } }), /temperature must be between/);
  assert.throws(() => ollama.validate('chat', { model: 'x', messages: [{ role: 'user', content: 'hi' }], options: { evil: 1 } }), /not one Ollama documents/);
  assert.throws(() => ollama.validate('chat', { model: 'x', messages: [{ role: 'user', content: 'hi', images: ['a', 'b', 'c', 'd', 'e'] }] }), /four images/);
  assert.throws(() => ollama.validate('chat', { model: 'x', messages: [{ role: 'user', content: 'hi', images: ['not base64!'] }] }), /Base64/);
  assert.throws(() => ollama.validate('create', { model: 'new', from: 'base', system: 'x'.repeat(20000) }), /16 KB/);
  assert.equal(ollama.BASE, 'http://127.0.0.1:11434');
});

test('streams stop on an error line and can be cancelled', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"status":"pulling"}\n{"error":"disk full"}\n', { status: 200 });
  await assert.rejects(ollama.stream('pull', { model: 'x' }, 's1', () => {}), /disk full/);
  globalThis.fetch = async (_u, o) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"status":"a"}\n')); o.signal.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError'))); } }), { status: 200 });
  const p = ollama.stream('pull', { model: 'x' }, 's2', () => {});
  setTimeout(() => ollama.cancel('s2'), 50);
  await assert.rejects(p, (e) => e.code === 'CANCELLED');
  globalThis.fetch = real;
});

const HW = { ram: { total: 32e9, free: 20e9 }, gpu: { known: true, name: 'Test GPU', vram: 12e9, free: 11e9 }, disk: { free: 400e9 } };
test('fit verdicts are evidence-based, conservative, and never read a model name', () => {
  assert.equal(fit({ size: 2e9, context: 131072 }, HW).verdict, 'Runs well');
  assert.equal(fit({ size: 9e9, context: 32768 }, HW, { numCtx: 16384 }).verdict, 'Runs with limits');
  assert.equal(fit({ size: 47e9, context: 32768 }, HW).verdict, 'Unlikely');
  assert.equal(fit({ size: null, context: 4096 }, HW).verdict, 'Unknown');
  assert.equal(fit({ size: 2e9 }, { ...HW, ram: { total: NaN } }).verdict, 'Unknown');
  assert.equal(fit({ size: 500e9, context: 4096 }, HW).verdict, 'Unlikely');
  // Without readable video memory the best answer is "with limits".
  assert.equal(fit({ size: 2e9, context: 4096 }, { ...HW, gpu: { known: false, name: 'Some GPU' } }).verdict, 'Runs with limits');
  // Changing the context setting changes the verdict.
  assert.notEqual(fit({ size: 9.5e9, context: 131072 }, HW, { numCtx: 2048 }).verdict, fit({ size: 9.5e9, context: 131072 }, HW, { numCtx: 131072 }).verdict);
  const r = fit({ size: 9e9, context: 32768 }, HW);
  assert.ok(r.evidence.length >= 3 && r.evidence[0].startsWith('Needs about'));
  assert.ok(r.assumptions.some((x) => x.includes('per 1,024 tokens')));
  // The verdict reads only facts: the same facts under any name give the same answer.
  const src = fs.readFileSync(path.join(root, 'src/shared/ollama-fit.js'), 'utf8');
  assert.doesNotMatch(src, /\btag\.(name|tag|model)\b/, 'fit must not look at a model or tag name');
});

test('the download cart has no money in it', () => {
  const src = fs.readFileSync(path.join(root, 'src/renderer/pages/ollama/store.js'), 'utf8');
  assert.doesNotMatch(src, /\b(price|checkout|payment|purchase|subscription)\s*[:=(]/i);
  assert.match(src, /No price, no account: the cart only lines up downloads/);
});

test('harness profiles take a program and plain arguments, never a shell', () => {
  assert.throws(() => harness.checkArgs(['--model', '{model}', '{home}']), /Only \{model\} and \{host\}/);
  assert.throws(() => harness.checkArgs(['a\nb']), /one line/);
  assert.deepEqual(harness.checkArgs(['--model', 'ollama_chat/{model}', '--host={host}']), ['--model', 'ollama_chat/{model}', '--host={host}']);
  assert.throws(() => harness.checkProgram('relative/tool'), /file picker/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-h-'));
  const script = path.join(dir, process.platform === 'win32' ? 'run.bat' : 'run.sh');
  fs.writeFileSync(script, 'echo hi');
  assert.throws(() => harness.checkProgram(script), /not a script/);
  assert.equal(harness.checkProgram(process.execPath), process.execPath);
});

test('a failed launch puts the saved snapshot back by itself; a good one keeps running', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-hl-'));
  harness.setup({ userData: dir });
  const realRuntime = ollama.runtime, realCall = ollama.call;
  ollama.runtime = async () => ({ state: 'healthy' });
  ollama.call = async () => ({ models: [{ name: 'tiny:1b' }] });
  try {
    let state = harness.addProfile({ name: 'Exits at once', program: process.execPath, args: ['-e', 'process.exit(3)'] });
    const bad = state.profiles.find((p) => p.name === 'Exits at once').id;
    const before = fs.readFileSync(path.join(dir, 'ollama-harness.json'), 'utf8');
    await assert.rejects(harness.launch({ id: bad, model: 'tiny:1b' }), (e) => e.code === 'ROLLED_BACK');
    assert.equal(fs.readFileSync(path.join(dir, 'ollama-harness.json'), 'utf8'), JSON.stringify(JSON.parse(before), null, 2));
    assert.equal(harness.snapshots().length, 1);
    state = harness.addProfile({ name: 'Stays up', program: process.execPath, args: ['-e', 'setTimeout(() => {}, 6000)'] });
    const good = state.profiles.find((p) => p.name === 'Stays up').id;
    const r = await harness.launch({ id: good, model: 'tiny:1b' });
    assert.equal(r.started, true);
    try { process.kill(r.pid); } catch { /* already gone */ }
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'ollama-harness.json'), 'utf8')).lastUsed[good].model, 'tiny:1b');
    // A preflight that fails never starts anything.
    await assert.rejects(harness.launch({ id: good, model: 'not-installed' }), (e) => e.code === 'PREFLIGHT');
  } finally { ollama.runtime = realRuntime; ollama.call = realCall; }
});
