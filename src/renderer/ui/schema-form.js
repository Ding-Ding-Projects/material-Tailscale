// Renders any OpenAPI JSON schema as rich controls: tri-state switches for
// booleans, segmented pickers for enums, steppers with bounds, chip editors for
// string lists, repeating cards for object lists, key/value grids for maps,
// variant pickers for oneOf, and a JSON editor only as the last resort.
import { h, icon, clear } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import { switchCtl, segmented, stepper, chips, text, enumSelect } from './controls.js';
import { infoBtn } from './command-form.js';

const typesOf = (s) => (Array.isArray(s?.type) ? s.type : s?.type ? [s.type] : []);
const mainType = (s) => typesOf(s).find((x) => x !== 'null') || (s?.properties ? 'object' : s?.items ? 'array' : s?.enum ? 'string' : undefined);
const clean = (d) => String(d || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();

export function schemaControl(schema = {}, value, { name = 'value', depth = 0 } = {}) {
  const fns = new Set();
  const fire = () => fns.forEach((f) => f());
  const wrap = (c) => { c.onChange?.(fire); return c; };
  const variants = schema.oneOf || schema.anyOf;
  if (variants?.length) {
    let idx = 0;
    const holder = h('div');
    let inner;
    const pick = segmented(variants.map((v, i) => ({ value: i, label: v.title || mainType(v) || `Option ${i + 1}` })), 0, { label: name + ' type' });
    const show = () => { inner = schemaControl(variants[idx], undefined, { name, depth }); inner.onChange(fire); clear(holder).append(inner.el); };
    pick.onChange((i) => { idx = i; show(); fire(); });
    show();
    return { el: h('div.stack', pick.el, holder), get: () => inner.get(), onChange: (f) => fns.add(f) };
  }
  const type = mainType(schema);
  const nullable = typesOf(schema).includes('null');
  if (schema.enum) {
    const opts = schema.enum.filter((x) => x !== null);
    const c = wrap(enumSelect(nullable || value === undefined ? ['', ...opts] : opts, value ?? '', { label: name, labels: nullable || value === undefined ? [t('leaveUnchanged'), ...opts] : undefined }));
    return { el: c.el, get: () => (c.get() === '' ? undefined : c.get()), onChange: (f) => fns.add(f) };
  }
  if (type === 'boolean') {
    const c = wrap(switchCtl(value, { label: name, triState: true }));
    return { el: c.el, get: c.get, onChange: (f) => fns.add(f) };
  }
  if (type === 'integer' || type === 'number') {
    const c = wrap(stepper(value, { min: schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : 0), max: schema.maximum ?? 1e12, label: name, allowEmpty: true }));
    return { el: c.el, get: () => (c.get() === '' || c.get() === undefined ? undefined : c.get()), onChange: (f) => fns.add(f) };
  }
  if (type === 'string') {
    if (schema.format === 'date-time') {
      const inp = h('input.input', { type: 'datetime-local', 'aria-label': name, on: { input: fire } });
      if (value) inp.value = String(value).slice(0, 16);
      return { el: inp, get: () => (inp.value ? new Date(inp.value).toISOString() : undefined), onChange: (f) => fns.add(f) };
    }
    const big = /policy|acl|hujson|content|body|description/i.test(name) && !schema.maxLength;
    const c = wrap(text(value ?? '', { label: name, mono: true, multiline: big && depth === 0 && name !== 'description', placeholder: schema.format === 'uri' ? 'https://' : schema.default ?? '', validate: (s) => (schema.pattern && s && !new RegExp(schema.pattern).test(s) ? pair(`Must match ${schema.pattern}`, `要符合 ${schema.pattern}`) : schema.format === 'uri' && s && !/^https?:\/\//.test(s) ? pair('Must be a web address', '要係網址') : null) }));
    return { el: c.el, get: c.get, onChange: (f) => fns.add(f) };
  }
  if (type === 'array') {
    const it = schema.items || {};
    if (mainType(it) === 'string' || !mainType(it)) {
      const kind = /route|cidr|subnet/i.test(name) ? 'cidrs' : /tag/i.test(name) ? 'tags' : 'any';
      const c = wrap(chips(value || [], { kind, label: name, suggestions: it.enum || [] }));
      let touched = false; c.onChange(() => { touched = true; });
      return { el: c.el, get: () => (touched || (value && value.length) ? c.get() : undefined), onChange: (f) => fns.add(f) };
    }
    const list = h('div.stack');
    const items = [];
    const add = (v) => {
      const sub = schemaControl(it, v, { name: name + ' item', depth: depth + 1 });
      sub.onChange(fire);
      const card = h('div.card.tonal', { style: { padding: '14px' } }, h('div.row', h('b', { style: { flex: 1 } }, `${name} #${items.length + 1}`), h('button.icon-btn.sm', { type: 'button', 'aria-label': 'Remove item', on: { click: () => { const i = items.indexOf(entry); items.splice(i, 1); card.remove(); fire(); } } }, icon('delete'))), sub.el);
      const entry = { sub, card };
      items.push(entry); list.append(card); fire();
    };
    (value || []).forEach(add);
    return { el: h('div.stack', list, h('button.btn.small.outline', { type: 'button', on: { click: () => add() } }, icon('add'), pair(`Add ${name} item`, `加 ${name}`))), get: () => (items.length ? items.map((e) => e.sub.get()) : undefined), onChange: (f) => fns.add(f) };
  }
  if (type === 'object' && schema.properties) {
    const subs = {};
    const grid = h('div.flags-grid');
    const req = new Set(schema.required || []);
    for (const [k, ps] of Object.entries(schema.properties)) {
      if (ps.readOnly) continue;
      const sub = schemaControl(ps, value?.[k], { name: k, depth: depth + 1 });
      sub.onChange(fire);
      subs[k] = sub;
      const wide = ['array', 'object'].includes(mainType(ps)) || ps.oneOf || ps.anyOf;
      grid.append(h(`div.flag-card${wide ? '.span2' : ''}`, { dataset: { el: `schema-${name}-${k}` } },
        h('div.row.nowrap', infoBtn(k, clean(ps.description) || k), h('b', { style: { flex: 1 } }, k), req.has(k) ? h('span.badge.warn', pair('required', '必填')) : null, h('code.small.muted', [mainType(ps), ps.format].filter(Boolean).join(' · '))),
        sub.el, ps.description ? h('div.small.muted', clean(ps.description).slice(0, 260)) : null));
    }
    return { el: grid, get: () => { const o = {}; for (const [k, s] of Object.entries(subs)) { const v = s.get(); if (v !== undefined) o[k] = v; } return Object.keys(o).length ? o : undefined; }, onChange: (f) => fns.add(f) };
  }
  if (type === 'object' && schema.additionalProperties) {
    const rows = h('div.stack');
    const entries = [];
    const add = (k = '', v = '') => {
      const kIn = h('input.input', { value: k, placeholder: 'key', 'aria-label': 'Key', on: { input: fire } });
      const vIn = h('input.input', { value: typeof v === 'string' ? v : JSON.stringify(v), placeholder: 'value', 'aria-label': 'Value', on: { input: fire } });
      const row = h('div.row.nowrap', kIn, vIn, h('button.icon-btn.sm', { type: 'button', 'aria-label': 'Remove', on: { click: () => { entries.splice(entries.indexOf(e), 1); row.remove(); fire(); } } }, icon('delete')));
      const e = { kIn, vIn }; entries.push(e); rows.append(row);
    };
    Object.entries(value || {}).forEach(([k, v]) => add(k, v));
    const parseV = (s) => { try { return JSON.parse(s); } catch { return s; } };
    return { el: h('div.stack', rows, h('button.btn.small.outline', { type: 'button', on: { click: () => add() } }, icon('add'), pair('Add entry', '加一項'))), get: () => (entries.length ? Object.fromEntries(entries.filter((e) => e.kIn.value).map((e) => [e.kIn.value, parseV(e.vIn.value)])) : undefined), onChange: (f) => fns.add(f) };
  }
  // Last resort: a JSON editor with live validation.
  const c = text(value === undefined ? '' : JSON.stringify(value, null, 2), { label: name, multiline: true, mono: true, validate: (s) => { if (!s) return null; try { JSON.parse(s); return null; } catch (e) { return e.message; } } });
  c.onChange(fire);
  return { el: c.el, get: () => { const s = c.get(); if (!s) return undefined; try { return JSON.parse(s); } catch { return s; } }, onChange: (f) => fns.add(f) };
}
