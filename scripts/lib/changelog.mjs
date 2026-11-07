// Parses CHANGELOG.md into entries for the in-app changelog.
// "## Unreleased: Title" is work on main with no release yet. A release heading is
// "## v1.2.3 · 2026-01-02 · Code name · 代號 · sha": version first, then an optional
// date, the code name (which may itself contain " · ") and an optional commit.
// A release build (env.MT_VERSION set) stamps the unreleased entry with what it ships as.
export function parseChangelog(src, env = {}) {
  return String(src || '').split(/^## /m).slice(1).map((chunk) => {
    const [headLine, ...rest] = chunk.split('\n');
    const body = rest.join('\n').trim();
    const u = headLine.trim().match(/^unreleased\b[\s:·–-]*(.*)$/i);
    if (u) {
      const title = u[1].trim();
      if (!env.MT_VERSION) return { version: '', unreleased: true, title, date: '', codeName: '', sha: '', body };
      return { version: env.MT_VERSION, title, date: (env.MT_RELEASE_DATE || new Date().toISOString()).slice(0, 10), codeName: env.MT_CODENAME || '', sha: env.GITHUB_SHA || '', body };
    }
    const parts = headLine.trim().split(/\s+·\s+/);
    const version = (parts.shift() || '').replace(/^v/, '');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(parts[0] || '') ? parts.shift() : '';
    const sha = /^[0-9a-f]{7,40}$/.test(parts[parts.length - 1] || '') ? parts.pop() : '';
    return { version, date, codeName: parts.join(' · '), sha, body };
  });
}
