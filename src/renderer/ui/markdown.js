// One shared Markdown renderer for docs, changelog, release notes and other
// provider text. Output is sanitised with DOMPurify and has no scripts, styles
// or inline handlers; links open externally or inside the docs browser.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { h } from '../core/dom.js';
import { pair } from '../core/i18n.js';

const EMOJI = { ':tada:': '🎉', ':rocket:': '🚀', ':bug:': '🐛', ':sparkles:': '✨', ':warning:': '⚠️', ':lock:': '🔒', ':memo:': '📝', ':white_check_mark:': '✅', ':x:': '❌', ':fire:': '🔥' };

export function renderMarkdown(src, { onLink, label = 'Rendered text', base = 'https://github.com/Ding-Ding-Projects/material-Tailscale/blob/main/' } = {}) {
  // Rendered text is ordinary content, not a landmark: several can sit on one page.
  if (!src || !src.trim()) return h('div.md.muted', pair('No notes were provided.', '冇提供說明。'));
  const withEmoji = src.replace(/:[a-z_]+:/g, (m) => EMOJI[m] || m);
  const html = DOMPurify.sanitize(marked.parse(withEmoji, { gfm: true }), { FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input'], FORBID_ATTR: ['style'] });
  const el = h('div.md', { dataset: { label } });
  el.innerHTML = html;
  el.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (onLink?.(href)) return;
      const url = /^https?:/.test(href) ? href : new URL(href, base).toString();
      window.mt.shell.external(url);
    });
  });
  el.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; img.style.maxWidth = '100%'; });
  // Wide tables scroll inside their own box instead of pushing the page sideways.
  el.querySelectorAll('table').forEach((tb) => { const wrap = document.createElement('div'); wrap.className = 'tbl-wrap md-table'; tb.replaceWith(wrap); wrap.append(tb); });
  return el;
}
