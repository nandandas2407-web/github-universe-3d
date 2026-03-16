// ═══════════════════════════════════════════════
//  ui.js — UI Layer
//  Entry, loading, planet card, search, toasts
// ═══════════════════════════════════════════════
'use strict';

const UI = (() => {

  let _repos = [];

  // Callbacks
  let _onLaunch = null;
  let _onSearch = null;
  let _onMode   = null;
  let _onBack   = null;

  // ─── INIT ─────────────────────────────────────
  function init() {
    // Entry screen
    const launchBtn = document.getElementById('launch-btn');
    const input     = document.getElementById('username-input');
    launchBtn?.addEventListener('click', () => _tryLaunch());
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') _tryLaunch(); });

    // Example users
    document.querySelectorAll('.ex-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (input) input.value = b.dataset.u;
        _tryLaunch();
      });
    });

    // Back button
    document.getElementById('btn-back')?.addEventListener('click', () => {
      if (_onBack) _onBack();
    });

    // Search
    const searchInput = document.getElementById('search-input');
    const dropdown    = document.getElementById('search-dropdown');
    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q || !_repos.length) { dropdown.classList.remove('open'); return; }
      const matches = _repos.filter(r =>
        r.name.toLowerCase().includes(q) || r.desc?.toLowerCase().includes(q)
      ).slice(0, 10);
      dropdown.innerHTML = matches.map(r => `
        <div class="sdrop-item" data-name="${r.name}">
          <div class="sdrop-dot" style="background:${r.color}"></div>
          <span class="sdrop-name">${r.name}</span>
          <span class="sdrop-stars">★ ${_fmt(r.stars)}</span>
        </div>`).join('');
      dropdown.classList.toggle('open', matches.length > 0);
      dropdown.querySelectorAll('.sdrop-item').forEach(el => {
        el.addEventListener('click', () => {
          searchInput.value = el.dataset.name;
          dropdown.classList.remove('open');
          if (_onSearch) _onSearch(el.dataset.name);
        });
      });
    });
    searchInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        dropdown.classList.remove('open');
        if (_onSearch) _onSearch(searchInput.value.trim());
      }
      if (e.key === 'Escape') dropdown.classList.remove('open');
    });
    document.addEventListener('click', e => {
      if (!searchInput?.contains(e.target) && !dropdown?.contains(e.target)) {
        dropdown?.classList.remove('open');
      }
    });

    // Mode pills
    document.querySelectorAll('.mode-pill').forEach(btn => {
      if (btn.id === 'toggle-constellations') return;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-pill:not(#toggle-constellations)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (_onMode) _onMode(btn.dataset.mode);
      });
    });

    // Constellations toggle
    const constToggle = document.getElementById('toggle-constellations');
    if (constToggle) {
      let constOn = false;
      constToggle.addEventListener('click', () => {
        constOn = !constOn;
        constToggle.textContent = `Constellations: ${constOn ? 'ON' : 'OFF'}`;
        constToggle.classList.toggle('active', constOn);
        Engine.showConstellations = constOn;
      });
    }

    // Card close
    document.getElementById('card-close')?.addEventListener('click', () => {
      hideCard();
      Engine.deselectPlanet();
    });
    // Mobile inspect button
    document.getElementById('mobile-inspect')?.addEventListener('click', () => {
      Ship.onNearPlanet?.('inspect'); // handled in main
    });
  }

  function _tryLaunch() {
    const input = document.getElementById('username-input');
    const val   = input?.value.trim();
    if (!val) { showEntryError('Please enter a GitHub username.'); return; }
    clearEntryError();
    if (_onLaunch) _onLaunch(val);
  }

  // ─── ENTRY SCREEN ─────────────────────────────
  function showEntry()  {
    const el = document.getElementById('entry');
    el.classList.remove('leaving');
    el.style.display = 'flex';
  }
  function hideEntry()  {
    const el = document.getElementById('entry');
    el.classList.add('leaving');
    setTimeout(() => el.style.display = 'none', 650);
  }
  function showEntryError(msg) {
    const el = document.getElementById('entry-error');
    if (el) el.textContent = msg;
  }
  function clearEntryError() {
    const el = document.getElementById('entry-error');
    if (el) el.textContent = '';
  }
  function setLaunchLoading(v) {
    const btn = document.getElementById('launch-btn');
    if (!btn) return;
    btn.classList.toggle('loading', v);
    btn.disabled = v;
  }

  // ─── LOADER ───────────────────────────────────
  function showLoader(msg) {
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('loader-title').textContent = msg || 'Loading…';
    setLoaderProgress(0);
  }
  function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  }
  function setLoaderProgress(pct, count) {
    const fill = document.getElementById('loader-fill');
    const cnt  = document.getElementById('loader-count');
    if (fill) fill.style.width = pct + '%';
    if (cnt && count !== undefined) cnt.textContent = `${count} repos found`;
  }

  // ─── APP ──────────────────────────────────────
  function showApp() {
    document.getElementById('app').classList.remove('hidden');
  }
  function hideApp() {
    document.getElementById('app').classList.add('hidden');
  }

  // ─── USER INFO ────────────────────────────────
  function setUser(user, repos) {
    _repos = repos;
    document.getElementById('user-name').textContent = user.login;
    const totalStars = repos.reduce((s, r) => s + r.stars, 0);
    document.getElementById('user-stats').textContent =
      `${repos.length} repos · ${_fmt(totalStars)} stars`;
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && user.avatar_url) {
      avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="${user.login}">`;
    }
    document.getElementById('topbar-user').style.display = 'flex';
  }

  // ─── PLANET CARD ──────────────────────────────
  function showCard(planetObj) {
    if (!planetObj) return;
    const r = planetObj.repo;
    const card = document.getElementById('planet-card');

    // Preview sphere
    const preview = document.getElementById('card-preview');
    preview.innerHTML = `<div class="card-planet-sphere" style="background:radial-gradient(circle at 35% 35%, ${_lighten(r.color,.4)}, ${r.color} 55%, ${_darken(r.color,.3)} 100%)"></div>`;
    // Subtle bg tint
    card.style.background = `linear-gradient(160deg, rgba(12,18,36,.9) 0%, ${r.color}11 100%)`;

    document.getElementById('card-lang-dot').style.background = r.color;
    document.getElementById('card-title').textContent   = r.name;
    document.getElementById('card-lang').textContent    = r.lang + (r.license ? ` · ${r.license}` : '');
    document.getElementById('card-desc').textContent    = r.desc || 'No description available.';
    document.getElementById('cm-stars').textContent     = _fmt(r.stars);
    document.getElementById('cm-forks').textContent     = _fmt(r.forks);
    document.getElementById('cm-issues').textContent    = _fmt(r.issues);
    document.getElementById('cm-watchers').textContent  = _fmt(r.watchers);
    document.getElementById('card-size').textContent    = _fmtSize(r.size);
    document.getElementById('card-updated').textContent = 'Updated ' + _ago(r.pushedAt || r.updatedAt);
    document.getElementById('card-link').href           = r.url;

    card.classList.remove('hidden');
  }
  function hideCard() {
    document.getElementById('planet-card').classList.add('hidden');
  }

  // ─── PROXIMITY LABEL ──────────────────────────
  function showProximity(repo) {
    const el = document.getElementById('prox-label');
    if (!el || !repo) return;
    document.getElementById('prox-name').textContent = repo.name;
    el.classList.remove('hidden');
    // Show mobile inspect button on touch devices
    const mi = document.getElementById('mobile-inspect');
    if (mi && window.matchMedia('(pointer:coarse)').matches) mi.classList.remove('hidden');
  }
  function hideProximity() {
    document.getElementById('prox-label')?.classList.add('hidden');
    document.getElementById('mobile-inspect')?.classList.add('hidden');
  }

  // ─── SPEED HUD ────────────────────────────────
  function updateSpeed(speed, maxSpeed) {
    const pct = Math.min(1, speed / maxSpeed);
    const bar = document.getElementById('speed-bar');
    const lbl = document.getElementById('speed-label');
    if (bar) {
      bar.style.width = (pct * 100) + '%';
      // Color: green → yellow → red
      const h = Math.round((1 - pct) * 120);
      bar.style.background = `hsl(${h},80%,55%)`;
      bar.style.boxShadow  = `0 0 6px hsl(${h},80%,55%)`;
    }
    if (lbl) lbl.textContent = speed.toFixed(1);
  }

  // ─── TOAST ────────────────────────────────────
  function toast(msg, type = '', duration = 2800) {
    const root  = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), duration + 300);
  }

  // ─── HELPERS ──────────────────────────────────
  function _fmt(n) {
    if (n >= 1000) return (n/1000).toFixed(1) + 'k';
    return String(n);
  }
  function _fmtSize(kb) {
    if (!kb) return '—';
    if (kb < 1024) return kb + ' KB';
    return (kb/1024).toFixed(1) + ' MB';
  }
  function _ago(str) {
    if (!str) return '—';
    const d = Math.floor((Date.now() - new Date(str)) / 86400000);
    if (d < 1)  return 'today';
    if (d < 7)  return `${d}d ago`;
    if (d < 30) return `${Math.floor(d/7)}w ago`;
    if (d < 365) return `${Math.floor(d/30)}mo ago`;
    return `${Math.floor(d/365)}y ago`;
  }
  function _lighten(hex, amt) {
    const c = new THREE.Color(hex);
    return `#${c.clone().lerp(new THREE.Color(1,1,1),amt).getHexString()}`;
  }
  function _darken(hex, amt) {
    const c = new THREE.Color(hex);
    return `#${c.clone().lerp(new THREE.Color(0,0,0),amt).getHexString()}`;
  }

  return {
    init,
    showEntry, hideEntry, showEntryError, clearEntryError, setLaunchLoading,
    showLoader, hideLoader, setLoaderProgress,
    showApp, hideApp,
    setUser,
    showCard, hideCard,
    showProximity, hideProximity,
    updateSpeed, toast,
    set onLaunch(fn) { _onLaunch = fn; },
    set onSearch(fn) { _onSearch = fn; },
    set onMode(fn)   { _onMode   = fn; },
    set onBack(fn)   { _onBack   = fn; },
  };
})();
