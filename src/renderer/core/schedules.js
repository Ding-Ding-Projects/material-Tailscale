// Time-based setting schedules shared by the app and the website.
import * as store from './store.js';

// ---------- schedules: deterministic, later rules win ----------
const scheduleBase = {};
export async function runSchedules() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const p = (s) => { const [a, b] = String(s).split(':').map(Number); return a * 60 + b; };
  const active = {};
  for (const r of store.get('schedules')) {
    if (!(r.days || [0, 1, 2, 3, 4, 5, 6]).includes(now.getDay())) continue;
    const a = p(r.from), b = p(r.to);
    const inside = a <= b ? mins >= a && mins < b : mins >= a || mins < b;
    if (!inside) continue;
    let v = r.value;
    if (r.source === 'url' && /^https:\/\//.test(r.value)) { try { const j = await fetch(r.value).then((x) => x.json()); v = j.value; } catch { continue; } }
    if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = Number(v);
    active[r.key] = v;
  }
  for (const [k, v] of Object.entries(active)) { if (!(k in scheduleBase)) scheduleBase[k] = store.get(k); if (store.get(k) !== v) store.set(k, v, { record: false }); }
  for (const k of Object.keys(scheduleBase)) if (!(k in active)) { store.set(k, scheduleBase[k], { record: false }); delete scheduleBase[k]; }
}

