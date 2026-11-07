// Every surface the sweep opens. App routes use the capture-route syntax shared with
// screenshot capture (src/main/capture-routes.js); website routes are hash routes.
import fs from 'node:fs';
import path from 'node:path';

export const SIZES = ['desktop', 'small', 'tablet', 'mobile'];
export const SIZE_PX = { mobile: [390, 844], tablet: [820, 1180], small: [960, 540], desktop: [1440, 940] };
export const THEMES = ['dark', 'light'];
export const LANGS = ['en', 'yue', 'both'];

const SETTINGS = ['tailscale', 'language', 'appearance', 'accessibility', 'sound', 'adhd', 'school', 'schedules', 'locks', 'vocabulary', 'data', 'interface', 'about'];

export const APP_ROUTES = [
  'home', 'peers', 'exit', 'routes', 'serve', 'taildrop', 'dns', 'lock', 'drive', 'certs', 'accounts', 'diagnostics',
  'cli', 'cli:set', 'cli:set>Guide me', 'cli:serve', 'admin', 'console',
  'tools', 'authenticator', 'base64', 'converter', 'regex', 'draw', 'ollama',
  'minecraft', 'minecraft>New server', 'minecraft>Discover and adopt',
  'extensions', 'extensions>overlay@ext-consent',
  'docs', 'status', 'history', 'changelog', 'notifications', 'about',
  ...SETTINGS.map((s) => `settings:${s}`),
  'home>overlay@palette', 'home>overlay@onboarding', 'home>overlay@confirm', 'home>overlay@ladder', 'home>overlay@toasts',
  'home>click@tab-new', 'settings:appearance>menu@set-theme',
  'settings:appearance>appearance@set-theme#style', 'settings:appearance>appearance@set-theme#motion'
];

/** Website hash routes, including every bundled article and every website settings section. */
export function siteRoutes(root) {
  const bundle = fs.readFileSync(path.join(root, 'src/renderer/docs-bundle.js'), 'utf8');
  const articles = JSON.parse(bundle.match(/export const ARTICLES = (\[.*?\]);\n/s)[1]).map((a) => a.path);
  return [
    'home', 'features', 'docs', 'download', 'changelog', 'status', 'tools',
    'authenticator', 'base64', 'converter', 'regex', 'draw', 'extensions',
    ...SETTINGS.filter((s) => !['tailscale', 'data', 'about'].includes(s)).map((s) => `settings/${s}`),
    ...articles.map((p) => `docs/${encodeURIComponent(p)}`)
  ];
}
