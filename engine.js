// ═══════════════════════════════════════════════
//  engine.js — Three.js Galaxy Engine
//  Instanced meshes, clean visuals, full scene
// ═══════════════════════════════════════════════
'use strict';

const Engine = (() => {
  // Core
  let scene, camera, renderer, clock;
  let raycaster, _mouse = new THREE.Vector2(-9999,-9999);

  // Scene groups
  let starsPoints, nebulaGroup, dustPoints;
  let planetsGroup, ringsGroup, moonsGroup, asteroidsGroup;
  let blackHoleGroup, coreGroup;
  let constellationGroup;

  // Planet data
  let planetObjs = []; // { mesh, data, orbitAngle, orbitR, orbitSpeed, moonObjs[] }
  let allRepos   = [];

  // State
  let mode = 'default';
  let _hoveredPlanet = null;
  let _lockedPlanet  = null;
  let showConstellation = false;

  // Callbacks
  let _onHover  = null;
  let _onSelect = null;

  // Dummy for matrix updates
  const _dummy  = new THREE.Object3D();
  const _color  = new THREE.Color();

  // ─── INIT ────────────────────────────────────
  function init(canvas) {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 4000);
    camera.position.set(0, 18, 50);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x060912, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.5;

    // Lights
    scene.add(new THREE.AmbientLight(0x0d1a35, 1.0));
    const sun = new THREE.PointLight(0x88bbff, 2.5, 600);
    scene.add(sun);

    // Build static scene
    _buildStars();
    _buildNebula();
    _buildDust();
    _buildCore();
    _buildBlackHole();

    planetsGroup      = new THREE.Group(); scene.add(planetsGroup);
    ringsGroup        = new THREE.Group(); scene.add(ringsGroup);
    moonsGroup        = new THREE.Group(); scene.add(moonsGroup);
    asteroidsGroup    = new THREE.Group(); scene.add(asteroidsGroup);
    constellationGroup= new THREE.Group(); scene.add(constellationGroup);

    window.addEventListener('resize', _onResize);
    canvas.addEventListener('mousemove', e => {
      _mouse.x =  (e.clientX / window.innerWidth) * 2 - 1;
      _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    canvas.addEventListener('click', _handleClick);
  }

  // ─── STARS (instanced points) ─────────────────
  function _buildStars() {
    const N = 6000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const palettes = [
      [1,.97,.88],[.8,.9,1],[1,.85,.6],[.7,.8,1],[1,1,1]
    ];
    for (let i = 0; i < N; i++) {
      const phi   = Math.acos(2*Math.random()-1);
      const theta = Math.random()*Math.PI*2;
      const r     = 500 + Math.random()*1200;
      pos[i*3]   = r*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
      pos[i*3+2] = r*Math.cos(phi);
      const c = palettes[Math.floor(Math.random()*palettes.length)];
      const bright = 0.4 + Math.random()*0.6;
      col[i*3]   = c[0]*bright;
      col[i*3+1] = c[1]*bright;
      col[i*3+2] = c[2]*bright;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    starsPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.1, vertexColors: true, sizeAttenuation: true,
      transparent: true, opacity: .85,
    }));
    scene.add(starsPoints);
  }

  // ─── NEBULA ───────────────────────────────────
  function _buildNebula() {
    nebulaGroup = new THREE.Group();
    const defs = [
      { color: 0x0a1840, count: 500, r: 60,  spread: 30, y: 8  },
      { color: 0x12073a, count: 400, r: 100, spread: 45, y: -6 },
      { color: 0x001825, count: 350, r: 80,  spread: 40, y: 4  },
      { color: 0x0d0823, count: 300, r: 140, spread: 55, y: 0  },
    ];
    defs.forEach(({ color, count, r, spread, y }) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = Math.random()*Math.PI*2;
        const d = r + (Math.random()-.5)*spread;
        pos[i*3]   = Math.cos(a)*d + (Math.random()-.5)*20;
        pos[i*3+1] = y + (Math.random()-.5)*12;
        pos[i*3+2] = Math.sin(a)*d + (Math.random()-.5)*20;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      nebulaGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
        color, size: 10 + Math.random()*8,
        transparent: true, opacity: .13,
        sizeAttenuation: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })));
    });
    scene.add(nebulaGroup);
  }

  // ─── COSMIC DUST ─────────────────────────────
  function _buildDust() {
    const N = 3000;
    const pos = new Float32Array(N*3);
    const col = new Float32Array(N*3);
    for (let i=0;i<N;i++) {
      const a = Math.random()*Math.PI*2;
      const r = 15 + Math.pow(Math.random(),.6)*180;
      pos[i*3]   = Math.cos(a)*r + (Math.random()-.5)*15;
      pos[i*3+1] = (Math.random()-.5)*10;
      pos[i*3+2] = Math.sin(a)*r + (Math.random()-.5)*15;
      col[i*3]   = .08+Math.random()*.1;
      col[i*3+1] = .12+Math.random()*.12;
      col[i*3+2] = .22+Math.random()*.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col,3));
    dustPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .9, vertexColors: true, sizeAttenuation: true,
      transparent:true, opacity:.7, depthWrite:false,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(dustPoints);
  }

  // ─── GALACTIC CORE ───────────────────────────
  function _buildCore() {
    coreGroup = new THREE.Group();
    // Core sphere
    const coreGeo = new THREE.SphereGeometry(3, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent:true, opacity:.9 });
    coreGroup.add(new THREE.Mesh(coreGeo, coreMat));
    // Glow halos
    [6,10,16].forEach((r,i) => {
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(r,16,16),
        new THREE.MeshBasicMaterial({ color:0x2255cc, transparent:true, opacity:.05-i*.012, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.BackSide })
      );
      coreGroup.add(h);
    });
    // Spiral arms (dust lanes)
    for (let arm=0;arm<2;arm++) {
      const N=800, pos=new Float32Array(N*3);
      for (let i=0;i<N;i++) {
        const t = (i/N)*Math.PI*5;
        const r = 6 + t*9;
        const a = t + arm*Math.PI;
        const sp = (Math.random()-.5)*(3+r*.06);
        pos[i*3]   = Math.cos(a)*r+sp;
        pos[i*3+1] = (Math.random()-.5)*3;
        pos[i*3+2] = Math.sin(a)*r+sp;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
      coreGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
        color:arm?0x112255:0x0a1a44, size:1.6,
        transparent:true, opacity:.45, depthWrite:false,
        blending:THREE.AdditiveBlending,
      })));
    }
    scene.add(coreGroup);
  }

  // ─── BLACK HOLE ───────────────────────────────
  function _buildBlackHole() {
    blackHoleGroup = new THREE.Group();
    blackHoleGroup.position.set(110, 0, 60);

    // Core
    blackHoleGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    ));
    // Photon ring
    blackHoleGroup.add(new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 1.2, 8, 60),
      new THREE.MeshBasicMaterial({ color:0xff5500, transparent:true, opacity:.65, depthWrite:false, blending:THREE.AdditiveBlending })
    ));
    // Accretion disk
    blackHoleGroup.add(new THREE.Mesh(
      new THREE.RingGeometry(6, 18, 64),
      new THREE.MeshBasicMaterial({ color:0xff3300, side:THREE.DoubleSide, transparent:true, opacity:.28, depthWrite:false, blending:THREE.AdditiveBlending })
    ));
    // Outer glow
    blackHoleGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 16),
      new THREE.MeshBasicMaterial({ color:0x220a00, transparent:true, opacity:.35, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.BackSide })
    ));
    scene.add(blackHoleGroup);
  }

  // ─── BUILD PLANETS ───────────────────────────
  function buildPlanets(repos) {
    allRepos = repos;
    // Clear existing
    planetsGroup.clear(); ringsGroup.clear(); moonsGroup.clear(); asteroidsGroup.clear();
    planetObjs = [];

    repos.forEach((repo, i) => {
      const obj = _makePlanet(repo, i, repos.length);
      planetObjs.push(obj);
    });

    _buildAsteroids(repos);
    if (showConstellation) buildConstellations();
  }

  function _makePlanet(repo, idx, total) {
    const c = new THREE.Color(repo.color);

    // Orbit placement
    const band  = Math.floor(idx / 7);
    const inBand = idx % 7;
    const orbitR = 18 + band * 22 + (inBand/7)*18 + (Math.random()-.5)*4;
    const angle  = (idx/total)*Math.PI*2 + Math.random()*.25;

    const px = Math.cos(angle)*orbitR;
    const pz = Math.sin(angle)*orbitR;
    const py = (Math.random()-.5)*6;

    // Planet sphere
    const geo  = new THREE.SphereGeometry(repo.radius, 20, 20);
    const mat  = new THREE.MeshPhongMaterial({
      color: c,
      emissive: c.clone().multiplyScalar(repo.brightness * .35),
      shininess: 35,
      specular: new THREE.Color(.1,.15,.25),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    mesh.userData = { repoId: repo.id, type: 'planet' };

    // Atmosphere
    const atmMesh = new THREE.Mesh(
      new THREE.SphereGeometry(repo.radius * 1.28, 14, 14),
      new THREE.MeshBasicMaterial({
        color: c, transparent:true, opacity: .045 + repo.brightness*.04,
        depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.BackSide,
      })
    );
    mesh.add(atmMesh);

    planetsGroup.add(mesh);

    // Rings
    let ringMesh = null;
    if (repo.hasRings) {
      const rIn  = repo.radius*1.55, rOut = Math.min(repo.radius*2.6, repo.radius*1.55+1.6);
      ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rOut, 56),
        new THREE.MeshBasicMaterial({
          color: c.clone().lerp(new THREE.Color(1,1,1),.3),
          side:THREE.DoubleSide, transparent:true, opacity:.48,
          depthWrite:false, blending:THREE.AdditiveBlending,
        })
      );
      ringMesh.rotation.x = Math.PI/2 + (Math.random()-.5)*.25;
      ringMesh.position.copy(mesh.position);
      ringsGroup.add(ringMesh);
    }

    // Moons
    const moonObjs = [];
    for (let m=0;m<repo.moons;m++) {
      const mr  = .1 + Math.random()*.12;
      const md  = repo.radius*(1.7+m*.6)+.6;
      const mMesh = new THREE.Mesh(
        new THREE.SphereGeometry(mr, 7, 7),
        new THREE.MeshPhongMaterial({ color:0x8899bb, emissive:0x112233, shininess:20 })
      );
      const ma = Math.random()*Math.PI*2;
      mMesh.position.set(px+Math.cos(ma)*md, py, pz+Math.sin(ma)*md);
      moonsGroup.add(mMesh);
      moonObjs.push({ mesh:mMesh, dist:md, angle:ma, speed:.4+Math.random()*.6, cx:px, cy:py, cz:pz });
    }

    const obj = {
      mesh, ringMesh, moonObjs, repo,
      orbitAngle: angle,
      orbitR, orbitSpeed: .006 + Math.random()*.008,
      rotSpeed:   .003 + Math.random()*.012,
      targetPos: null,
    };
    return obj;
  }

  // ─── ASTEROIDS (recent repos) ─────────────────
  function _buildAsteroids(repos) {
    const recent = repos.filter(r => r.ageDays < 90).slice(0,18);
    recent.forEach(repo => {
      const c   = new THREE.Color(repo.color);
      const s   = .08 + Math.random()*.14;
      const geo = new THREE.IcosahedronGeometry(s, 0);
      const mat = new THREE.MeshPhongMaterial({ color:c, emissive:c.clone().multiplyScalar(.4) });
      const m   = new THREE.Mesh(geo, mat);
      // trail glow
      m.add(new THREE.Mesh(
        new THREE.SphereGeometry(s*2.2, 5, 5),
        new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:.2, depthWrite:false, blending:THREE.AdditiveBlending })
      ));
      const r = 12 + Math.random()*160;
      const a = Math.random()*Math.PI*2;
      m.position.set(Math.cos(a)*r, (Math.random()-.5)*25, Math.sin(a)*r);
      m.userData = { orbitR:r, angle:a, height:m.position.y, speed:.04+Math.random()*.1, tilt:(Math.random()-.5)*.5 };
      asteroidsGroup.add(m);
    });
  }

  // ─── CONSTELLATIONS ───────────────────────────
  function buildConstellations() {
    constellationGroup.clear();
    const byLang = {};
    planetObjs.forEach(p => {
      const l = p.repo.lang;
      if (!byLang[l]) byLang[l] = [];
      byLang[l].push(p);
    });
    Object.values(byLang).forEach(group => {
      if (group.length < 2) return;
      for (let i=0;i<group.length-1;i++) {
        const a = group[i].mesh.position.clone();
        const b = group[i+1].mesh.position.clone();
        const pts = [a,b];
        const g2  = new THREE.BufferGeometry().setFromPoints(pts);
        const c   = new THREE.Color(group[0].repo.color);
        const line = new THREE.Line(g2, new THREE.LineBasicMaterial({
          color:c, transparent:true, opacity:.12, depthWrite:false
        }));
        constellationGroup.add(line);
      }
    });
  }

  // ─── VISUALIZATION MODES ──────────────────────
  function setMode(newMode) {
    mode = newMode;
    const total = planetObjs.length;
    if (!total) return;

    planetObjs.forEach((p, i) => {
      let tx, ty, tz;
      const r = p.repo;

      if (newMode === 'language') {
        const langs = [...new Set(allRepos.map(x=>x.lang))];
        const li    = langs.indexOf(r.lang);
        const count = langs.length;
        const angle = (li/count)*Math.PI*2 + (i%5)*.25;
        const dist  = 28 + (li%4)*24 + (i%5)*6;
        tx = Math.cos(angle)*dist; ty = (Math.random()-.5)*8; tz = Math.sin(angle)*dist;

      } else if (newMode === 'stars') {
        const sorted = [...allRepos].sort((a,b)=>b.stars-a.stars);
        const rank   = sorted.findIndex(x=>x.id===r.id);
        const angle  = (rank/total)*Math.PI*2;
        const dist   = 20 + (rank/total)*120;
        tx = Math.cos(angle)*dist; ty = (Math.random()-.5)*6; tz = Math.sin(angle)*dist;

      } else if (newMode === 'activity') {
        const sorted = [...allRepos].sort((a,b)=>a.ageDays-b.ageDays);
        const rank   = sorted.findIndex(x=>x.id===r.id);
        const angle  = (rank/total)*Math.PI*2;
        const dist   = 18 + (rank/total)*130;
        tx = Math.cos(angle)*dist; ty = (Math.random()-.5)*6; tz = Math.sin(angle)*dist;

      } else {
        // restore default orbit
        tx = Math.cos(p.orbitAngle)*p.orbitR;
        ty = p.mesh.position.y;
        tz = Math.sin(p.orbitAngle)*p.orbitR;
      }
      p.targetPos = new THREE.Vector3(tx, ty, tz);
    });
  }

  // ─── HOVER / SELECT ──────────────────────────
  function _updateRaycaster() {
    raycaster.setFromCamera(_mouse, camera);
    const meshes = planetObjs.map(p=>p.mesh);
    const hits   = raycaster.intersectObjects(meshes);

    const newHover = hits.length ? planetObjs.find(p=>p.mesh===hits[0].object) : null;
    if (newHover !== _hoveredPlanet) {
      if (_hoveredPlanet && _hoveredPlanet !== _lockedPlanet) _setPlanetState(_hoveredPlanet, 'normal');
      _hoveredPlanet = newHover;
      if (_hoveredPlanet && _hoveredPlanet !== _lockedPlanet) _setPlanetState(_hoveredPlanet, 'hover');
      if (_onHover) _onHover(_hoveredPlanet);
    }
  }

  function _handleClick() {
    if (!_hoveredPlanet) return;
    if (_lockedPlanet) _setPlanetState(_lockedPlanet, 'normal');
    _lockedPlanet = _hoveredPlanet;
    _setPlanetState(_lockedPlanet, 'selected');
    if (_onSelect) _onSelect(_lockedPlanet);
  }

  function _setPlanetState(obj, state) {
    if (!obj) return;
    const c   = new THREE.Color(obj.repo.color);
    const mat = obj.mesh.material;
    if (state === 'hover') {
      mat.emissive = c.clone().multiplyScalar(.5);
    } else if (state === 'selected') {
      mat.emissive = c.clone().multiplyScalar(.7);
    } else {
      mat.emissive = c.clone().multiplyScalar(obj.repo.brightness * .35);
    }
  }

  function deselectPlanet() {
    if (_lockedPlanet) { _setPlanetState(_lockedPlanet,'normal'); _lockedPlanet=null; }
    if (_onSelect) _onSelect(null);
  }

  // ─── SUPERNOVA FLASH ──────────────────────────
  function _triggerSupernova(obj) {
    const originalColor = new THREE.Color(obj.repo.color);
    const mat = obj.mesh.material;
    let t = 0;
    const flash = setInterval(() => {
      t += .1;
      if (t >= 1) { clearInterval(flash); mat.emissive = originalColor.clone().multiplyScalar(obj.repo.brightness * .35); return; }
      const p = 1 - t;
      mat.emissive = new THREE.Color(1,1,.5).multiplyScalar(p * .8);
      const scale = 1 + Math.sin(t*Math.PI) * .12;
      obj.mesh.scale.setScalar(scale);
    }, 60);
  }

  // ─── MINIMAP ──────────────────────────────────
  function renderMinimap(mmCanvas, shipPos, shipDir) {
    if (!mmCanvas) return;
    const ctx   = mmCanvas.getContext('2d');
    const W = mmCanvas.width, H = mmCanvas.height;
    const cx = W/2, cy = H/2, scale = 0.55;
    ctx.clearRect(0,0,W,H);

    // Background
    ctx.fillStyle = 'rgba(6,9,18,.6)';
    ctx.beginPath(); ctx.arc(cx,cy,cx,0,Math.PI*2); ctx.fill();

    // Planets
    planetObjs.forEach(p => {
      const wx = p.mesh.position.x * scale + cx;
      const wy = p.mesh.position.z * scale + cy;
      if (wx<2||wx>W-2||wy<2||wy>H-2) return;
      const col = p.repo.color;
      ctx.beginPath();
      ctx.arc(wx, wy, Math.max(1.5, p.repo.radius*scale*1.2), 0, Math.PI*2);
      ctx.fillStyle = col;
      ctx.globalAlpha = .8; ctx.fill(); ctx.globalAlpha = 1;
    });

    // Black hole
    {
      const bx = blackHoleGroup.position.x*scale+cx;
      const bz = blackHoleGroup.position.z*scale+cy;
      ctx.beginPath(); ctx.arc(bx,bz,4,0,Math.PI*2);
      ctx.fillStyle='#ff3300'; ctx.globalAlpha=.6; ctx.fill(); ctx.globalAlpha=1;
    }

    // Ship
    if (shipPos) {
      const sx = shipPos.x*scale+cx;
      const sy = shipPos.z*scale+cy;
      ctx.save();
      ctx.translate(sx, sy);
      if (shipDir) ctx.rotate(Math.atan2(shipDir.x, shipDir.z));
      ctx.beginPath();
      ctx.moveTo(0,-5); ctx.lineTo(-3,3); ctx.lineTo(3,3); ctx.closePath();
      ctx.fillStyle = '#4f9eff'; ctx.globalAlpha = .95; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Border
    ctx.beginPath(); ctx.arc(cx,cy,cx-1,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.stroke();
  }

  // ─── ANIMATION LOOP ───────────────────────────
  let _animId;
  function startLoop() {
    const loop = () => {
      _animId = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      const t  = clock.getElapsedTime();
      _updateScene(dt, t);
      _updateRaycaster();
      renderer.render(scene, camera);
    };
    loop();
  }

  function _updateScene(dt, t) {
    // Slow galaxy core pulse
    coreGroup.children[0].material.opacity = .85 + Math.sin(t*.8)*.08;

    // Planet orbits + animations
    planetObjs.forEach(p => {
      p.mesh.rotation.y += p.rotSpeed;

      if (mode === 'default') {
        p.orbitAngle += p.orbitSpeed * dt;
        if (!p.targetPos) {
          p.mesh.position.x = Math.cos(p.orbitAngle) * p.orbitR;
          p.mesh.position.z = Math.sin(p.orbitAngle) * p.orbitR;
        }
      }

      // Lerp to target (mode switch)
      if (p.targetPos) {
        p.mesh.position.lerp(p.targetPos, .025);
        if (p.mesh.position.distanceTo(p.targetPos) < .08) p.targetPos = null;
        // Sync ring
        if (p.ringMesh) p.ringMesh.position.copy(p.mesh.position);
        // Sync moons center
        p.moonObjs.forEach(m => { m.cx=p.mesh.position.x; m.cy=p.mesh.position.y; m.cz=p.mesh.position.z; });
      }

      // Ring sync (continuous)
      if (p.ringMesh) p.ringMesh.position.copy(p.mesh.position);

      // Moon orbit
      p.moonObjs.forEach(m => {
        m.angle += m.speed * dt;
        m.mesh.position.set(
          m.cx + Math.cos(m.angle)*m.dist,
          m.cy + Math.sin(m.angle*.7)*.25,
          m.cz + Math.sin(m.angle)*m.dist
        );
      });

      // Inactive repos drift toward black hole
      if (p.repo.isInactive && mode === 'default') {
        const bhPos = blackHoleGroup.position;
        const dir   = bhPos.clone().sub(p.mesh.position).normalize();
        p.mesh.position.addScaledVector(dir, .003 * dt * 8);
        if (p.ringMesh) p.ringMesh.position.copy(p.mesh.position);
        p.moonObjs.forEach(m => { m.cx=p.mesh.position.x; m.cy=p.mesh.position.y; m.cz=p.mesh.position.z; });
      }

      // Supernova repo pulse
      if (p.repo.isSuperNova) {
        const pulse = 1 + Math.sin(t*2.5+p.orbitAngle)*.05;
        p.mesh.scale.setScalar(pulse);
        const atm = p.mesh.children[0];
        if (atm) atm.material.opacity = .06 + Math.sin(t*2)*.025;
      }
    });

    // Asteroids
    asteroidsGroup.children.forEach(m => {
      const d = m.userData;
      d.angle += d.speed * dt;
      m.position.set(
        Math.cos(d.angle)*d.orbitR,
        d.height + Math.sin(d.angle*1.5)*1.5,
        Math.sin(d.angle+d.tilt)*d.orbitR
      );
      m.rotation.x += .6*dt;
      m.rotation.z += .4*dt;
    });

    // Black hole rotation
    blackHoleGroup.rotation.y += .008;
    if (blackHoleGroup.children[1]) blackHoleGroup.children[1].rotation.z = t*1.2;
    if (blackHoleGroup.children[2]) blackHoleGroup.children[2].rotation.z = -t*.7;

    // Stars slow drift
    starsPoints.rotation.y += .000015;
  }

  // ─── FIND CLOSEST PLANET TO SHIP ─────────────
  function getClosestPlanet(pos, threshold) {
    let closest = null, minDist = Infinity;
    planetObjs.forEach(p => {
      const d = p.mesh.position.distanceTo(pos);
      if (d < minDist) { minDist = d; closest = p; }
    });
    if (minDist <= threshold) return closest;
    return null;
  }

  function focusPlanet(name) {
    const obj = planetObjs.find(p => p.repo.name.toLowerCase() === name.toLowerCase());
    if (!obj) return null;
    if (_lockedPlanet) _setPlanetState(_lockedPlanet, 'normal');
    _lockedPlanet = obj;
    _setPlanetState(obj, 'selected');
    if (_onSelect) _onSelect(obj);
    return obj;
  }

  function getPlanetWorldPos(obj) {
    return obj.mesh.position.clone();
  }

  // ─── UTILS ───────────────────────────────────
  function _onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // PUBLIC
  return {
    init, buildPlanets, setMode, startLoop,
    buildConstellations, deselectPlanet,
    getClosestPlanet, focusPlanet, getPlanetWorldPos,
    renderMinimap, triggerSupernova: _triggerSupernova,
    get camera() { return camera; },
    get planetObjs() { return planetObjs; },
    set onHover(fn)  { _onHover  = fn; },
    set onSelect(fn) { _onSelect = fn; },
    set showConstellations(v) {
      showConstellation = v;
      constellationGroup.visible = v;
      if (v) buildConstellations();
    },
    stop() { cancelAnimationFrame(_animId); },
  };
})();
