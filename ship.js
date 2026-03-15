// ═══════════════════════════════════════════════
//  ship.js — Spaceship Flight Controller
//  Smooth first-person-ish space navigation
//  WASD + mouse look + NippleJS joystick
// ═══════════════════════════════════════════════
'use strict';

const Ship = (() => {

  // Three.js refs
  let camera;

  // State
  const pos     = new THREE.Vector3(0, 8, 60);
  const vel     = new THREE.Vector3();
  let yaw   = 0;   // horizontal rotation (radians)
  let pitch = 0;   // vertical rotation
  const MAX_SPEED = 28;
  const ACCEL     = 22;
  const DRAG      = 0.88;
  const MAX_PITCH = Math.PI * .38;

  // Input state
  const keys = {};
  let moveStick  = { x: 0, y: 0 }; // joystick move (forward/strafe)
  let lookStick  = { x: 0, y: 0 }; // joystick look (yaw/pitch)
  let mouseLocked= false;
  let mouseDeltaX= 0, mouseDeltaY = 0;
  let dragActive = false, lastMx = 0, lastMy = 0;
  let targetSpeed = 0; // user-set speed via scroll

  // Callbacks
  let _onNearPlanet = null;

  // ─── INIT ─────────────────────────────────────
  function init(cam, canvas) {
    camera = cam;
    camera.position.copy(pos);

    // Keyboard
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'KeyE') { if (_onNearPlanet) _onNearPlanet('inspect'); }
    });
    window.addEventListener('keyup',   e => { keys[e.code] = false; });

    // Mouse drag for look (desktop non-pointer-lock)
    canvas.addEventListener('mousedown', e => {
      if (e.button === 2 || e.button === 0) {
        dragActive = true; lastMx = e.clientX; lastMy = e.clientY;
      }
    });
    window.addEventListener('mouseup', () => { dragActive = false; });
    window.addEventListener('mousemove', e => {
      if (dragActive) {
        mouseDeltaX += e.clientX - lastMx;
        mouseDeltaY += e.clientY - lastMy;
        lastMx = e.clientX; lastMy = e.clientY;
      }
    });

    // Scroll to set base speed
    canvas.addEventListener('wheel', e => {
      targetSpeed = Math.max(0, Math.min(MAX_SPEED, targetSpeed - e.deltaY * .06));
    }, { passive: true });

    // Pointer lock (click on canvas)
    canvas.addEventListener('dblclick', () => {
      canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      mouseLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', e => {
      if (mouseLocked) {
        mouseDeltaX += e.movementX;
        mouseDeltaY += e.movementY;
      }
    });

    // Touch swipe for look (non-joystick area)
    let touchId = -1, lastTx = 0, lastTy = 0;
    canvas.addEventListener('touchstart', e => {
      // Only handle touches not in joystick zones
      for (const t of e.changedTouches) {
        const isLeft  = t.clientX < window.innerWidth * .35;
        const isRight = t.clientX > window.innerWidth * .65;
        const isBottom = t.clientY > window.innerHeight * .55;
        if (!(isBottom && (isLeft || isRight))) {
          touchId = t.identifier; lastTx = t.clientX; lastTy = t.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          mouseDeltaX += (t.clientX - lastTx) * 1.2;
          mouseDeltaY += (t.clientY - lastTy) * 1.2;
          lastTx = t.clientX; lastTy = t.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) touchId = -1;
      }
    }, { passive: true });

    // NippleJS joysticks
    _initJoysticks();
  }

  // ─── NIPPLEJS ─────────────────────────────────
  function _initJoysticks() {
    if (typeof nipplejs === 'undefined') return;

    // Left joystick = move (forward/back/strafe)
    const leftZone = document.getElementById('joystick-move');
    if (leftZone) {
      const moveManager = nipplejs.create({
        zone: leftZone, mode: 'static', position: { left: '50%', top: '50%' },
        size: 100, color: 'rgba(79,158,255,0.4)',
      });
      moveManager.on('move', (_, data) => {
        const angle = data.angle.radian;
        const force = Math.min(data.force, 1);
        moveStick.x = Math.cos(angle) * force;
        moveStick.y = Math.sin(angle) * force;
      });
      moveManager.on('end', () => { moveStick.x = 0; moveStick.y = 0; });
    }

    // Right joystick = look (yaw/pitch)
    const rightZone = document.getElementById('joystick-look');
    if (rightZone) {
      const lookManager = nipplejs.create({
        zone: rightZone, mode: 'static', position: { left: '50%', top: '50%' },
        size: 100, color: 'rgba(124,111,255,0.4)',
      });
      lookManager.on('move', (_, data) => {
        const angle = data.angle.radian;
        const force = Math.min(data.force, 1);
        lookStick.x = Math.cos(angle) * force;
        lookStick.y = Math.sin(angle) * force;
      });
      lookManager.on('end', () => { lookStick.x = 0; lookStick.y = 0; });
    }
  }

  // ─── UPDATE (called every frame) ─────────────
  function update(dt, nearPlanetCallback) {
    if (!camera) return;

    // Mouse look
    const MOUSE_SENS = .0022;
    const STICK_SENS = 1.4;
    yaw   -= mouseDeltaX * MOUSE_SENS + lookStick.x * STICK_SENS * dt;
    pitch -= mouseDeltaY * MOUSE_SENS + lookStick.y * STICK_SENS * dt;
    pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
    mouseDeltaX = 0; mouseDeltaY = 0;

    // Build orientation quaternion
    const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), pitch);
    const orient = qYaw.clone().multiply(qPitch);
    camera.quaternion.slerp(orient, .15);

    // Forward & right vectors
    const fwd   = new THREE.Vector3(0,0,-1).applyQuaternion(qYaw);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(qYaw);
    const up    = new THREE.Vector3(0,1,0);

    // Acceleration from input
    const moveInput = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp'])    moveInput.addScaledVector(fwd,   1);
    if (keys['KeyS'] || keys['ArrowDown'])  moveInput.addScaledVector(fwd,  -1);
    if (keys['KeyA'] || keys['ArrowLeft'])  moveInput.addScaledVector(right,-1);
    if (keys['KeyD'] || keys['ArrowRight']) moveInput.addScaledVector(right, 1);
    if (keys['Space'])                       moveInput.addScaledVector(up,    1);
    if (keys['ShiftLeft'])                   moveInput.addScaledVector(up,   -1);

    // Joystick move input
    moveInput.addScaledVector(fwd,   moveStick.y); // forward = up on stick
    moveInput.addScaledVector(right, moveStick.x);

    // Continuous forward speed (scroll-set)
    moveInput.addScaledVector(fwd, targetSpeed * .04);

    if (moveInput.lengthSq() > 0) {
      moveInput.normalize();
      vel.addScaledVector(moveInput, ACCEL * dt);
    }

    // Speed limit
    const spd = vel.length();
    if (spd > MAX_SPEED) vel.multiplyScalar(MAX_SPEED / spd);

    // Drag
    vel.multiplyScalar(Math.pow(DRAG, dt * 60));

    // Integrate position
    pos.addScaledVector(vel, dt);

    // Soft boundary — pull back toward origin if too far
    if (pos.length() > 280) {
      const pull = pos.clone().negate().normalize().multiplyScalar(.5 * dt);
      vel.add(pull);
    }

    camera.position.copy(pos);

    return vel.length(); // return current speed
  }

  // ─── TELEPORT ─────────────────────────────────
  function travelTo(target, offset) {
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const dest = target.clone().add(offset || new THREE.Vector3(0, 0, 8));
    // Smooth warp — lerp position over 60 frames
    let t = 0;
    const from = pos.clone();
    const interval = setInterval(() => {
      t += .05;
      if (t >= 1) { pos.copy(dest); vel.set(0,0,0); clearInterval(interval); return; }
      const eased = t < .5 ? 2*t*t : -1+(4-2*t)*t;
      pos.lerpVectors(from, dest, eased);
      camera.position.copy(pos);
    }, 16);
  }

  function setLookAt(target) {
    const dir = target.clone().sub(pos).normalize();
    yaw   = Math.atan2(-dir.x, -dir.z);
    pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  }

  function getPosition() { return pos.clone(); }
  function getVelocity() { return vel.length(); }
  function getForward()  {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  }

  return {
    init, update, travelTo, setLookAt,
    getPosition, getVelocity, getForward,
    set onNearPlanet(fn) { _onNearPlanet = fn; },
  };
})();
