// ═══════════════════════════════════════════════
//  api.js — GitHub API layer
//  Handles pagination, rate limits, caching
// ═══════════════════════════════════════════════
'use strict';

const API = (() => {
  const BASE   = 'https://api.github.com';
  const cache  = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 min

  // Language → color map (GitHub-accurate)
  const LANG_COLORS = {
    'JavaScript':  '#f1e05a', 'TypeScript': '#3178c6',
    'Python':      '#3572a5', 'Java':       '#b07219',
    'C':           '#555555', 'C++':        '#f34b7d',
    'C#':          '#178600', 'Go':         '#00add8',
    'Rust':        '#dea584', 'Ruby':       '#701516',
    'PHP':         '#4f5d95', 'Swift':      '#f05138',
    'Kotlin':      '#a97bff', 'HTML':       '#e34c26',
    'CSS':         '#563d7c', 'SCSS':       '#c6538c',
    'Shell':       '#89e051', 'Lua':        '#000080',
    'Dart':        '#00b4ab', 'R':          '#198ce7',
    'Vue':         '#41b883', 'Elixir':     '#6e4a7e',
    'Haskell':     '#5e5086', 'Scala':      '#c22d40',
    'Clojure':     '#db5855', 'Perl':       '#0298c3',
    'MATLAB':      '#e16737', 'Objective-C':'#438eff',
    'Assembly':    '#6e4c13', 'Dockerfile': '#384d54',
    'Unknown':     '#586069',
  };

  async function _fetch(url) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 403) {
      const reset = res.headers.get('X-RateLimit-Reset');
      const mins  = reset ? Math.ceil((+reset * 1000 - Date.now()) / 60000) : '?';
      throw new Error(`GitHub rate limit hit. Resets in ~${mins} min.`);
    }
    if (res.status === 404) throw new Error(`User not found on GitHub.`);
    if (!res.ok) throw new Error(`GitHub API error ${res.status}.`);
    const data = await res.json();
    cache.set(url, { data, ts: Date.now() });
    return data;
  }

  async function getUser(username) {
    return _fetch(`${BASE}/users/${encodeURIComponent(username)}`);
  }

  async function getRepos(username, onProgress) {
    const perPage = 100;
    let page = 1, all = [];
    while (all.length < 500) {
      const batch = await _fetch(`${BASE}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&sort=pushed`);
      if (!batch.length) break;
      all = all.concat(batch);
      if (onProgress) onProgress(all.length, batch.length < perPage);
      if (batch.length < perPage) break;
      page++;
    }
    return all.map(normalize);
  }

  function normalize(r) {
    const now = Date.now();
    const pushed = new Date(r.pushed_at || r.updated_at).getTime();
    const ageDays = (now - pushed) / 86400000;
    const sizeKB  = r.size || 0;
    return {
      id:          r.id,
      name:        r.name,
      fullName:    r.full_name,
      desc:        r.description || '',
      url:         r.html_url,
      stars:       r.stargazers_count || 0,
      forks:       r.forks_count      || 0,
      watchers:    r.watchers_count   || 0,
      issues:      r.open_issues_count|| 0,
      size:        sizeKB,
      lang:        r.language || 'Unknown',
      license:     r.license?.spdx_id || null,
      topics:      r.topics  || [],
      createdAt:   r.created_at,
      updatedAt:   r.updated_at,
      pushedAt:    r.pushed_at,
      isFork:      r.fork     || false,
      isArchived:  r.archived || false,
      ageDays,
      isInactive:  ageDays > 365,
      isHot:       r.stargazers_count >= 50,
      isSuperNova: r.stargazers_count >= 200,
      // visual
      color:       LANG_COLORS[r.language] || LANG_COLORS.Unknown,
      radius:      Math.max(0.45, Math.min(2.8, 0.5 + Math.log2(sizeKB + 2) * 0.28)),
      brightness:  Math.min(1, 0.15 + (r.stargazers_count || 0) / 300),
      hasRings:    (r.forks_count || 0) >= 3,
      moons:       Math.min(4, Math.floor(((r.watchers_count||0) + (r.open_issues_count||0)) / 6)),
    };
  }

  function langColor(lang) {
    return LANG_COLORS[lang] || LANG_COLORS.Unknown;
  }

  return { getUser, getRepos, langColor, LANG_COLORS };
})();
