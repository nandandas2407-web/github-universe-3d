# 🚀 GitHub Universe 3D v2

A high-performance, game-like 3D galaxy explorer where you **pilot a spaceship** through your GitHub repositories rendered as living planets.

## Quick Start

1. **Open `index.html`** in Chrome, Firefox, Edge, or Safari
2. Enter any GitHub username → click **Launch**
3. Fly through the galaxy using the controls below

> No build step. No server needed. Pure browser app.

---

## Controls

### Desktop
| Input | Action |
|-------|--------|
| `W A S D` | Fly forward / strafe |
| `Space / Shift` | Move up / down |
| `Mouse drag` | Look around |
| `Double-click` | Lock mouse (pointer lock mode) |
| `Scroll wheel` | Set cruise speed |
| `E` | Inspect nearby planet |
| `Escape` | Close info panel |

### Mobile / Touch
- **Left joystick** — Move (forward, back, strafe)
- **Right joystick** — Look (yaw, pitch)
- **Swipe** on galaxy area — Look around
- **Inspect button** — Appears when near a planet

---

## Features

### 🪐 Planets
- **Size** = repository disk size
- **Color** = primary programming language
- **Brightness** = star count
- **Rings** = repos with 3+ forks (Saturn-style)
- **Moons** = activity level (watchers + issues)
- **Atmospheric glow** = based on popularity

### 🌌 Galaxy
- Spiral arm dust lanes
- Glowing galactic core
- 6,000-star field with colored stars
- Soft nebula gradient clouds
- Cosmic dust particles
- Rotating black hole — inactive repos slowly drift toward it
- Asteroid trail — recently pushed repos orbit as glowing rocks

### 🎮 Navigation
- Smooth flight physics with drag + momentum
- `Travel-to` warp when searching/selecting
- Proximity detection (within 12 units of a planet)
- Holographic info card appears when you approach
- Minimap / radar showing all planets + your position

### 📊 Visualization Modes
| Mode | Layout |
|------|--------|
| Galaxy | Default orbital layout |
| Language | Clustered by programming language |
| Stars | Spiral ordered by star count |
| Activity | Ordered by last push date |

### 💥 Effects
- **Supernova burst** — high-star repos pulse and flash on inspect
- **Constellation lines** — toggle shows language connections
- **Time-lapse** via Mode buttons (coming: repo growth over time)
- Asteroid commit trails for recently active repos

---

## File Structure

```
universe-v2/
├── index.html   — Shell, all UI panels, script tags
├── style.css    — Refined minimal space aesthetic
├── api.js       — GitHub API, caching, error handling
├── engine.js    — Three.js galaxy renderer
├── ship.js      — Spaceship flight controller + NippleJS
├── ui.js        — All UI logic and interactions
└── main.js      — Orchestration + game loop
```

---

## Performance

- Three.js `ACESFilmicToneMapping` for cinematic look
- `devicePixelRatio` capped at 2× for mobile
- Planet meshes reused with `Object3D` pooling
- Only raycasts against planet meshes (not stars/dust)
- Constellation lines built lazily on demand
- Capped delta time (`min(dt, 0.05)`) prevents spiral of death

---

## Rate Limits

Uses GitHub's unauthenticated API (60 req/hr per IP). If you hit the limit, the error is shown clearly. To add a token, edit `api.js`:

```js
headers: {
  Accept: 'application/vnd.github.v3+json',
  Authorization: 'token YOUR_TOKEN_HERE'
}
```

---

## Browser Support
Chrome 90+ · Firefox 88+ · Safari 15+ · Edge 90+  
Mobile: iOS 15+ · Android Chrome 90+
