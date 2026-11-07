// Decorative, animated SVG illustrations for page heroes, shared by the app, the
// website and the design-canvas board generator. Static markup only: no data, no
// script, no external references. Styling and motion come from mesh2.css classes
// (n, l, g, soft, solid, float, pulse, spin) so reduced motion stops everything.

const wrap = (body) => `<svg viewBox="0 0 340 190" aria-hidden="true" focusable="false">${body}</svg>`;

const ART = {
  network: wrap(`
    <path class="l" d="M60 120 L140 60 L230 92 L292 44"/><path class="l alt" d="M140 60 L170 150 L230 92"/><path class="l" d="M60 120 L170 150 L292 140"/>
    <circle class="soft pulse" cx="170" cy="150" r="22"/>
    <g class="float"><circle class="n" cx="60" cy="120" r="13"/></g>
    <g class="float d2"><circle class="n alt" cx="140" cy="60" r="15"/></g>
    <g class="float d3"><circle class="n" cx="230" cy="92" r="17"/></g>
    <g class="float"><circle class="n warm" cx="292" cy="44" r="11"/></g>
    <g class="float d2"><circle class="n alt" cx="292" cy="140" r="12"/></g>
    <circle class="solid" cx="170" cy="150" r="10"/>`),
  routes: wrap(`
    <circle class="g" cx="120" cy="100" r="62" opacity=".55"/><ellipse class="g" cx="120" cy="100" rx="26" ry="62" opacity=".45"/><path class="g" d="M58 100 H182 M66 70 H174 M66 130 H174" opacity=".35"/>
    <path class="l" d="M150 64 C 210 10, 270 30, 300 70"/><path class="l alt" d="M160 120 C 220 170, 280 160, 306 128"/>
    <g class="float"><circle class="n warm" cx="300" cy="70" r="12"/></g><g class="float d2"><circle class="n alt" cx="306" cy="128" r="12"/></g>
    <circle class="soft pulse" cx="150" cy="64" r="14"/><circle class="solid" cx="150" cy="64" r="7"/>`),
  sharing: wrap(`
    <rect class="n" x="40" y="70" width="110" height="80" rx="18"/><path class="g" d="M62 96 h66 M62 116 h44" opacity=".7"/>
    <path class="l" d="M150 110 C 200 110, 210 60, 262 56"/><path class="l alt" d="M150 122 C 210 130, 220 160, 270 150"/>
    <g class="float"><rect class="n alt" x="252" y="34" width="56" height="44" rx="14"/></g>
    <g class="float d2"><rect class="n warm" x="262" y="128" width="52" height="42" rx="14"/></g>
    <circle class="soft pulse" cx="150" cy="110" r="16"/>`),
  security: wrap(`
    <path class="n" d="M170 22 L236 46 V98 C236 138 206 164 170 176 C134 164 104 138 104 98 V46 Z"/>
    <path class="g" d="M146 98 l16 16 l30 -34" opacity=".9"/>
    <path class="l" d="M60 70 H104 M236 70 H290 M60 130 H110 M230 130 H290"/>
    <g class="float"><circle class="n alt" cx="50" cy="70" r="10"/></g><g class="float d2"><circle class="n warm" cx="300" cy="70" r="10"/></g>
    <g class="float d3"><circle class="n" cx="50" cy="130" r="10"/></g><g class="float"><circle class="n alt" cx="300" cy="130" r="10"/></g>
    <circle class="soft pulse" cx="170" cy="98" r="30"/>`),
  dns: wrap(`
    <path class="l" d="M170 46 V80 M170 80 L90 120 M170 80 L170 124 M170 80 L250 120"/>
    <g class="float"><rect class="n" x="132" y="22" width="76" height="34" rx="12"/></g>
    <g class="float d2"><rect class="n alt" x="52" y="122" width="76" height="32" rx="12"/></g>
    <g class="float d3"><rect class="n" x="132" y="126" width="76" height="32" rx="12"/></g>
    <g class="float"><rect class="n warm" x="212" y="122" width="76" height="32" rx="12"/></g>
    <circle class="soft pulse" cx="170" cy="80" r="12"/><circle class="solid" cx="170" cy="80" r="6"/>`),
  diagnostics: wrap(`
    <path class="g" d="M30 120 H80 L100 70 L124 160 L148 50 L172 130 L190 110 H240" />
    <path class="l alt" d="M30 150 H310"/>
    <circle class="g spin" cx="272" cy="78" r="38" stroke-dasharray="6 9" opacity=".7"/>
    <circle class="n warm" cx="272" cy="78" r="18"/><circle class="soft pulse" cx="148" cy="50" r="12"/>`),
  command: wrap(`
    <g class="float"><rect class="n" x="46" y="28" width="248" height="136" rx="20"/></g>
    <circle class="solid warm" cx="70" cy="50" r="5"/><circle class="solid alt" cx="86" cy="50" r="5"/><circle class="solid" cx="102" cy="50" r="5"/>
    <path class="g" d="M70 86 l14 12 l-14 12 M98 110 h40" />
    <path class="g" d="M70 136 h110" opacity=".45"/><path class="g" d="M70 150 h70" opacity=".3"/>
    <rect class="solid alt pulse" x="146" y="104" width="10" height="12" rx="2"/>`),
  admin: wrap(`
    <g class="float d3"><rect class="n" x="70" y="96" width="200" height="70" rx="18" opacity=".7"/></g>
    <g class="float d2"><rect class="n alt" x="54" y="62" width="200" height="70" rx="18"/></g>
    <g class="float"><rect class="n" x="38" y="28" width="200" height="70" rx="18"/></g>
    <path class="g" d="M70 52 l-10 11 l10 11 M118 52 l10 11 l-10 11 M84 76 l18 -26" />
    <path class="l" d="M238 62 C 280 62, 290 110, 300 140"/><circle class="solid warm" cx="300" cy="140" r="8"/>`),
  tools: wrap(`
    <g class="spin" style="transform-origin: 96px 96px"><circle class="g" cx="96" cy="96" r="40" stroke-dasharray="14 10"/></g>
    <circle class="n" cx="96" cy="96" r="22"/>
    <g class="float"><rect class="n alt" x="170" y="36" width="58" height="58" rx="16"/></g>
    <g class="float d2"><rect class="n warm" x="240" y="62" width="58" height="58" rx="16"/></g>
    <g class="float d3"><rect class="n" x="190" y="112" width="58" height="58" rx="16"/></g>
    <path class="g" d="M190 64 h18 M198 56 v16 M260 92 h18 M210 141 l18 0" />`),
  minecraft: wrap(`
    <g class="float"><path class="n alt" d="M170 30 L226 58 L170 86 L114 58 Z"/><path class="n" d="M114 58 L170 86 V150 L114 122 Z"/><path class="n warm" d="M226 58 L170 86 V150 L226 122 Z"/></g>
    <g class="float d2"><path class="n alt" d="M262 96 L292 111 L262 126 L232 111 Z"/><path class="n" d="M232 111 L262 126 V156 L232 141 Z"/><path class="n warm" d="M292 111 L262 126 V156 L292 141 Z"/></g>
    <g class="float d3"><path class="n alt" d="M74 104 L100 117 L74 130 L48 117 Z"/><path class="n" d="M48 117 L74 130 V156 L48 143 Z"/><path class="n warm" d="M100 117 L74 130 V156 L100 143 Z"/></g>`),
  settings: wrap(`
    <path class="g" d="M50 60 H290 M50 104 H290 M50 148 H290" opacity=".45"/>
    <g class="float"><circle class="n" cx="120" cy="60" r="14"/></g><g class="float d2"><circle class="n alt" cx="222" cy="104" r="14"/></g><g class="float d3"><circle class="n warm" cx="160" cy="148" r="14"/></g>
    <path class="l" d="M50 60 H106 M50 104 H208 M50 148 H146"/>`),
  extensions: wrap(`
    <path class="l" d="M86 128 L170 96 L254 128"/><path class="l alt" d="M170 96 V44"/>
    <circle class="soft pulse" cx="170" cy="96" r="26"/><circle class="solid" cx="170" cy="96" r="12"/>
    <g class="float"><path class="n alt" d="M62 112 h18 a8 8 0 1 1 16 0 h18 v18 a8 8 0 1 1 0 16 v18 h-52 Z"/></g>
    <g class="float d2"><path class="n warm" d="M228 112 h52 v52 h-18 a8 8 0 1 0 -16 0 h-18 v-18 a8 8 0 1 0 0 -16 Z"/></g>
    <g class="float d3"><path class="n" d="M146 20 h48 v14 a8 8 0 1 1 0 16 v14 h-48 v-14 a8 8 0 1 0 0 -16 Z"/></g>`),
  disks: wrap(`
    <g class="float"><path class="n" d="M58 54 v40 a58 17 0 0 0 116 0 v-40"/><ellipse class="n alt" cx="116" cy="54" rx="58" ry="17"/></g>
    <g class="float d2"><path class="n" d="M170 96 v40 a58 17 0 0 0 116 0 v-40"/><ellipse class="n warm" cx="228" cy="96" rx="58" ry="17"/></g>
    <path class="l" d="M174 80 L196 90"/>
    <circle class="soft pulse" cx="116" cy="150" r="18"/><circle class="solid" cx="116" cy="150" r="8"/>
    <path class="g" d="M78 150 h-26 M154 150 h26" opacity=".6"/>`),
  models: wrap(`
    <path class="l" d="M92 56 L170 96 L92 136 M170 96 L248 56 M170 96 L248 136"/>
    <g class="float"><circle class="n" cx="92" cy="56" r="18"/></g>
    <g class="float d2"><circle class="n alt" cx="92" cy="136" r="18"/></g>
    <g class="float d3"><circle class="n warm" cx="248" cy="56" r="18"/></g>
    <g class="float d2"><circle class="n" cx="248" cy="136" r="18"/></g>
    <circle class="soft pulse" cx="170" cy="96" r="30"/><circle class="solid" cx="170" cy="96" r="14"/>`),
  checklist: wrap(`
    <g class="float"><rect class="n" x="100" y="26" width="136" height="142" rx="16"/></g>
    <path class="l alt" d="M122 62 l8 8 l16 -16"/><path class="g" d="M160 62 h54"/>
    <path class="l alt" d="M122 98 l8 8 l16 -16"/><path class="g" d="M160 98 h46"/>
    <circle class="soft pulse" cx="134" cy="134" r="10"/><path class="g" d="M160 134 h40" opacity=".6"/>
    <g class="float d2"><circle class="n warm" cx="262" cy="56" r="16"/></g>
    <g class="float d3"><rect class="n alt" x="52" y="118" width="30" height="30" rx="9"/></g>`),
  library: wrap(`
    <g class="float d3"><rect class="n" x="96" y="40" width="150" height="120" rx="16" opacity=".6" transform="rotate(-8 170 100)"/></g>
    <g class="float d2"><rect class="n alt" x="96" y="40" width="150" height="120" rx="16" transform="rotate(4 170 100)"/></g>
    <g class="float"><rect class="n" x="96" y="40" width="150" height="120" rx="16"/></g>
    <path class="g" d="M118 70 h90 M118 92 h106 M118 114 h70 M118 136 h88" opacity=".7"/>
    <circle class="soft pulse" cx="246" cy="40" r="14"/><circle class="solid warm" cx="246" cy="40" r="7"/>`)
};

/** Which illustration each destination uses. */
const FAMILY = {
  home: 'network', peers: 'network', status: 'network', notifications: 'security',
  exit: 'routes', routes: 'routes',
  serve: 'sharing', taildrop: 'sharing', drive: 'sharing', certs: 'security',
  lock: 'security', accounts: 'security',
  dns: 'dns', diagnostics: 'diagnostics',
  cli: 'command', console: 'command', admin: 'admin',
  tools: 'tools', authenticator: 'security', base64: 'tools', converter: 'tools', regex: 'tools', draw: 'tools', ollama: 'models', vdisks: 'disks', features: 'checklist',
  minecraft: 'minecraft', settings: 'settings', extensions: 'extensions',
  docs: 'library', changelog: 'library', history: 'library', about: 'library'
};

const artFor = (dest) => ART[FAMILY[dest] || 'network'];

module.exports = { ART, FAMILY, artFor };
