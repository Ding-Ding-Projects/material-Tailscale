// Parses Ollama's official model library (https://ollama.com/library) and each model's tags page
// into plain records. The library page lists every model on one page; each tags page lists every
// published tag with its digest, download size, context window and input types. A page that no
// longer looks like this yields an empty list, and the caller reports the catalogue incomplete
// rather than guessing.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', '#x27': "'" };
const text = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/&(#?x?[0-9a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : m)).replace(/\s+/g, ' ').trim();

/** "2.0GB" -> 2000000000 (the site uses decimal units). Null when the text is not a size. */
function parseSize(s) {
  const m = /^([\d.]+)\s*([KMGT]?B)$/i.exec(String(s).trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[m[2].toUpperCase()]);
}
/** "128K" -> 131072, "2K" -> 2048, "40000" -> 40000. */
function parseContext(s) {
  const m = /^([\d.]+)\s*([KM]?)$/i.exec(String(s).trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * ({ K: 1024, M: 1024 * 1024 }[m[2].toUpperCase()] || 1));
}

/** Every model on the library page: name, description, capabilities, sizes, pulls, tag count, updated. */
function parseLibrary(html) {
  const out = [];
  const items = String(html).match(/<li\s+class="flex items-baseline border-b[^"]*"[^>]*>[\s\S]*?<\/li>/g) || [];
  for (const it of items) {
    const name = /href="\/library\/([^"?#]+)"/.exec(it)?.[1];
    if (!name) continue;
    const description = text(/<p class="max-w-lg[^"]*">([\s\S]*?)<\/p>/.exec(it)?.[1] || '');
    const capabilities = [], sizes = [];
    for (const [, cls, body] of it.matchAll(/<span[^>]*class="inline-flex items-center rounded-md ([^"]*)"[^>]*>([\s\S]*?)<\/span>/g)) {
      (cls.includes('#ddf4ff') ? sizes : capabilities).push(text(body));
    }
    const pulls = /<span\s*>([\d.]+[KMB]?)<\/span>\s*<span[^>]*>&nbsp;Pulls/.exec(it)?.[1] || null;
    const tagCount = Number(/<span\s*>(\d+)<\/span>\s*<span[^>]*>&nbsp;Tags/.exec(it)?.[1]) || null;
    const updated = /title="([^"]+)"[^>]*>(?:(?!<\/p>)[\s\S])*?>Updated&nbsp;/.exec(it)?.[1] || null;
    out.push({ name, description, capabilities, sizes, pulls, tagCount, updated });
  }
  return out;
}

/** Every tag on a model's tags page: tag, digest, size, context window and inputs. */
function parseTags(html, model) {
  const out = [];
  const seen = new Set();
  const re = /<a href="\/library\/([^"]+)" class="md:hidden flex flex-col[^"]*">([\s\S]*?)<\/a>/g;
  for (const [, full, body] of String(html).matchAll(re)) {
    if (!full.startsWith(model + ':') || seen.has(full)) continue;
    seen.add(full);
    const t = text(body);
    const digest = /\b([0-9a-f]{12})\b/.exec(t)?.[1] || null;
    const parts = t.split('•').map((x) => x.trim());
    const sizeText = parts.find((p) => /^[\d.]+\s*[KMGT]?B$/i.test(p)) || null;
    const ctxText = parts.find((p) => /context window$/i.test(p))?.replace(/\s*context window$/i, '') || null;
    const inputText = parts.find((p) => /input\b/i.test(p))?.replace(/\s*input\b.*$/i, '') || null;
    out.push({
      tag: full, digest, size: sizeText ? parseSize(sizeText) : null, sizeText,
      context: ctxText ? parseContext(ctxText) : null, contextText: ctxText,
      inputs: inputText ? inputText.split(',').map((x) => x.trim()).filter(Boolean) : []
    });
  }
  return out;
}

module.exports = { parseLibrary, parseTags, parseSize, parseContext };
