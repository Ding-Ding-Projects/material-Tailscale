// Picks this release's dim sum code name from the public catalogue, using only
// dishes whose photo is published as a catalog-v1* release asset.
const CATALOG_URL = 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const RELEASES_URL = 'https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases?per_page=100';
const headers = { 'User-Agent': 'material-tailscale-release', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
try {
  const [cat, rel] = await Promise.all([fetch(CATALOG_URL).then((r) => r.json()), fetch(RELEASES_URL, { headers }).then((r) => r.json())]);
  const assets = new Map();
  for (const r of rel) { if (r.draft || !/^catalog-v1(?:-part-\d+)?$/.test(r.tag_name)) continue; for (const a of r.assets || []) if (/\.png$/i.test(a.name)) assets.set(a.name, a.browser_download_url); }
  const ok = cat.dishes.filter((d) => d.name?.en && d.name?.zhHant && assets.has(d.image?.path?.split('/').pop()));
  const n = Number(process.env.GITHUB_RUN_NUMBER || process.argv[2] || 1);
  const d = ok[(n - 1) % ok.length];
  console.log(JSON.stringify({ codeName: `${d.name.en} · ${d.name.zhHant}`, photoUrl: assets.get(d.image.path.split('/').pop()), dishId: d.id }));
} catch (e) {
  console.log(JSON.stringify({ codeName: null, photoUrl: null, error: `Catalogue unavailable: ${e.message}` }));
}
