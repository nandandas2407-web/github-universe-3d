// ═══════════════════════════════════════════════
//  main.js — App Orchestration
//  Wires API + Engine + Ship + UI + game loop
// ═══════════════════════════════════════════════
'use strict';

(function () {

  const clock = new THREE.Clock();
  let running = false;
  let minimapCanvas;
  let currentProximity = null;
  const PROXIMITY_DIST = 12;  // units to trigger card

  // ─── ENTRY BACKGROUND ANIMATION ───────────────
  (function initEntryBG() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, stars = [];

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    function makeStars(n) {
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random()*W, y: Math.random()*H,
          r: Math.random()*1.5 + .3,
          alpha: Math.random()*.7 + .1,
          speed: Math.random()*.3 + .05,
          twinkleOffset: Math.random()*Math.PI*2,
        });
      }
    }
    let frame = 0;
    function draw() {
      requestAnimationFrame(draw);
      frame++;
      ctx.clearRect(0,0,W,H);
      // Nebula gradient
      const grad = ctx.createRadialGradient(W*.5,H*.55,0,W*.5,H*.55,W*.7);
      grad.addColorStop(0,'rgba(10,20,60,.5)');
      grad.addColorStop(.5,'rgba(8,10,30,.3)');
      grad.addColorStop(1,'rgba(6,9,18,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
      // Stars
      stars.forEach(s => {
        const alpha = s.alpha * (.6 + .4*Math.sin(frame*.02*s.speed + s.twinkleOffset));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`;
        ctx.fill();
      });
    }
    resize(); makeStars(180); draw();
    window.addEventListener('resize', () => { resize(); makeStars(180); });
  })();

  // ─── INIT ─────────────────────────────────────
  UI.init();

  UI.onLaunch = async (username) => {
    UI.clearEntryError();
    UI.setLaunchLoading(true);

    try {
      // Validate & fetch user
      UI.showLoader(`Contacting GitHub for "${username}"…`);
      UI.setLoaderProgress(10);

      let user;
      try {
        user = await API.getUser(username);
      } catch (e) {
        UI.hideLoader();
        UI.setLaunchLoading(false);
        UI.showEntryError(e.message);
        return;
      }

      UI.hideEntry();
      UI.setLoaderProgress(25);

      // Fetch repos
      let repoCount = 0;
      const repos = await API.getRepos(username, (count) => {
        repoCount = count;
        const pct = Math.min(90, 25 + count * .4);
        UI.setLoaderProgress(pct, count);
        document.getElementById('loader-title').textContent =
          `Mapping ${count} repositories…`;
      });

      if (!repos.length) {
        UI.showApp(); UI.hideLoader();
        UI.toast('No public repositories found.', 'warn');
        _initGalaxy(user, []);
        return;
      }

      UI.setLoaderProgress(95, repos.length);
      document.getElementById('loader-title').textContent = 'Building galaxy…';

      // Short delay for UX
      await new Promise(r => setTimeout(r, 400));

      UI.setLoaderProgress(100, repos.length);
      await new Promise(r => setTimeout(r, 200));

      UI.hideLoader();
      UI.showApp();
      _initGalaxy(user, repos);

    } catch (e) {
      UI.hideLoader();
      UI.setLaunchLoading(false);
      UI.showEntry();
      UI.showEntryError(e.message || 'Something went wrong. Try again.');
    }
  };

  UI.onBack = () => {
    running = false;
    Engine.stop();
    UI.hideApp();
    UI.hideCard();
    UI.showEntry();
  };

  UI.onSearch = (name) => {
    if (!name) return;
    const obj = Engine.focusPlanet(name);
    if (obj) {
      const worldPos = Engine.getPlanetWorldPos(obj);
      // Fly toward it
      const offset = new THREE.Vector3(0, obj.repo.radius*2, obj.repo.radius*4+6);
      Ship.travelTo(worldPos, offset);
      Ship.setLookAt(worldPos);
      UI.showCard(obj);
      UI.toast(`Warping to: ${obj.repo.name}`, 'success');
    } else {
      UI.toast(`"${name}" not found`, 'warn');
    }
  };

  UI.onMode = (mode) => {
    Engine.setMode(mode);
    UI.toast(`View: ${mode}`);
  };

  // ─── GALAXY INIT ──────────────────────────────
  function _initGalaxy(user, repos) {
    const canvas = document.getElementById('galaxy-canvas');
    minimapCanvas = document.getElementById('minimap');
    minimapCanvas.width  = 110;
    minimapCanvas.height = 110;

    Engine.init(canvas);
    Engine.buildPlanets(repos);
    Engine.startLoop();

    Ship.init(Engine.camera, canvas);

    UI.setUser(user, repos);
    UI.setLaunchLoading(false);

    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    crosshair.innerHTML = '<div class="crosshair-dot"></div>';
    document.getElementById('app').appendChild(crosshair);

    // Planet selection callback
    Engine.onSelect = (obj) => {
      if (obj) UI.showCard(obj);
      else UI.hideCard();
    };

    // Hover callback (desktop)
    Engine.onHover = (obj) => {};

    // Welcome
    UI.toast(`Welcome to ${user.login}'s galaxy — ${repos.length} repos`, 'success');

    // Supernova for hot repos on first load
    setTimeout(() => {
      const hot = Engine.planetObjs.filter(p => p.repo.isSuperNova);
      hot.slice(0,2).forEach(p => Engine.triggerSupernova(p));
      if (hot.length) UI.toast(`${hot.length} supernova repos detected! ✦`, 'warn');
    }, 1800);

    running = true;
    _gameLoop();
  }

  // ─── MAIN GAME LOOP ───────────────────────────
  function _gameLoop() {
    if (!running) return;
    requestAnimationFrame(_gameLoop);

    const dt = Math.min(clock.getDelta(), .05);

    // Update ship
    const speed = Ship.update(dt);

    // Speed HUD
    UI.updateSpeed(speed, 28);

    // Proximity detection
    const shipPos = Ship.getPosition();
    const near    = Engine.getClosestPlanet(shipPos, PROXIMITY_DIST);

    if (near !== currentProximity) {
      currentProximity = near;
      if (near) {
        UI.showProximity(near.repo);
      } else {
        UI.hideProximity();
      }
    }

    // E key / mobile inspect tap
    Ship.onNearPlanet = (action) => {
      if (action === 'inspect' && currentProximity) {
        UI.showCard(currentProximity);
        Engine.triggerSupernova(currentProximity); // visual flair on inspect
      }
    };

    // Minimap
    Engine.renderMinimap(minimapCanvas, shipPos, Ship.getForward());
  }

  // ─── KEYBOARD SHORTCUTS (global) ──────────────
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      UI.hideCard();
      Engine.deselectPlanet();
    }
  });

  // ─── HANDLE VISIBILITY ────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clock.getDelta(); // drain delta
  });

})();
