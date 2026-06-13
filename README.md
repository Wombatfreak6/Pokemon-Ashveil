# Pokémon Ashveil — The Lost Cartridge

> A GBA-style Pokémon fan game for the web.  
> Built with **Phaser 3 · TypeScript · Vite**.

---

## Quick Start

```bash
git clone https://github.com/Wombatfreak6/Pokemon-ashveil.git
cd Pokemon-ashveil
npm install
npm run dev
```

Open **http://localhost:8080** in your browser.

---

## Tech Stack

| Tool | Version | Role |
|------|---------|------|
| [Phaser 3](https://phaser.io/) | 3.90.0 | Game engine |
| [TypeScript](https://www.typescriptlang.org/) | 6.x (strict) | Language |
| [Vite](https://vitejs.dev/) | 8.x | Dev server + bundler |
| [Tiled Map Editor](https://www.mapeditor.org/) | 1.10 (JSON format) | Map authoring |

---

## Project Structure

```
Pokemon-ashveil/
├── public/
│   └── assets/
│       └── maps/
│           └── test_map.tmj      ← Tiled JSON map (loaded at runtime)
├── src/
│   ├── config/
│   │   └── GameConfig.ts         ← Phaser game config (resolution, physics)
│   ├── entities/
│   │   └── Player.ts             ← Player sprite, grid movement, animations
│   ├── scenes/
│   │   ├── BootScene.ts          ← Asset loading, procedural placeholder textures
│   │   └── OverworldScene.ts     ← Main map scene, camera, collision
│   ├── systems/
│   │   └── InputController.ts    ← Arrow keys + WASD abstraction
│   └── main.ts                   ← Phaser.Game entry point
├── index.html                    ← Vite HTML entry point
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR at http://localhost:8080 |
| `npm run build` | TypeScript check + production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally to verify production build |
| `npm run typecheck` | Run `tsc --noEmit` for strict type checking only |

---

## GBA-Authentic Settings

The game targets the original Game Boy Advance resolution:

| Setting | Value | Reason |
|---------|-------|--------|
| Width | 240 px | GBA native width |
| Height | 160 px | GBA native height |
| Scale mode | `FIT` | Fills browser window, maintains aspect ratio |
| `pixelArt` | `true` | Disables WebGL texture smoothing (critical for crisp pixels) |
| `roundPixels` | `true` | Prevents sub-pixel camera jitter |
| Physics | Arcade, gravity 0 | Top-down collision, no gravity |

---

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move player |
| W / A / S / D | Move player (alternative) |

---

## Architecture Notes

### Grid-Based Movement
The player moves **exactly one tile (16 px) per key press** via a Phaser tween  
(duration: 175 ms, `ease: Linear`).  Input is ignored while a tween is running.  
Collision is checked **before** the tween starts — if the target tile exists in  
the Collision layer, movement is blocked and the player faces that direction.

### Camera
Uses `startFollow` with `lerpX/Y = 0.08` (smooth GBA-style tracking).  
Camera bounds are locked to map pixel dimensions — the void outside the map  
is never visible.

### Input System
`InputController.ts` is intentionally decoupled from the player and can be  
reused for menu navigation in future sessions.

---

## How to Add a New Map

1. Open your map in **Tiled Map Editor**
2. Use the same tileset (`placeholder_tiles`, 16×16 tiles) or add a new one
3. Create at minimum two layers: **"Ground"** and **"Collision"**
4. Add an **Object Layer** named `"Spawns"` with a **Point** named `"PlayerSpawn"`
5. Export as JSON (`.tmj`) into `public/assets/maps/`
6. In `BootScene.ts`, add a load call:
   ```ts
   this.load.tilemapTiledJSON('my-map', 'assets/maps/my_map.tmj');
   ```
7. In `OverworldScene.ts` (or a new scene), change the tilemap key to `'my-map'`

---

## How to Add a New Player Animation Frame

The player spritesheet is **generated programmatically** in `BootScene.ts`  
inside `createPlayerTexture()`.

**To add frames to the existing procedural sprite:**
1. Increase `COLS` (frames per direction) in `createPlayerTexture()`
2. Add the new frame drawing logic at the corresponding column index
3. Update the animation frame arrays in `Player.ts` → `createAnimations()`

**To replace with real sprite art:**
1. Add your spritesheet to `public/assets/sprites/player.png`
2. In `BootScene.ts → preload()`, add:
   ```ts
   this.load.spritesheet('player', 'assets/sprites/player.png',
     { frameWidth: 16, frameHeight: 16 });
   ```
3. Delete the `createPlayerTexture()` method and its call in `create()`
4. Adjust the frame index ranges in `Player.ts → createAnimations()` to match your sheet

---

## Asset Credits

### Placeholder Assets (Session 1)

All placeholder assets in this project are **procedurally generated at runtime**  
by `BootScene.ts` using Phaser's canvas API.  No external image files are used.

These assets are original work created for this project and are released under  
**CC0 1.0 Universal** (Public Domain Dedication).

| Asset | Key | Description | License |
|-------|-----|-------------|---------|
| Tileset | `tiles` | 8-tile 128×16 px tileset (grass, wall, path, water, etc.) | CC0 |
| Player sprite | `player` | 16×16 px 8-frame 4-direction spritesheet | CC0 |
| Test map | `test-map` | 20×20 Tiled JSON map with Ground + Collision layers | CC0 |

**These assets MUST be replaced before any public release.**  
See the _How to Add_ sections above for replacement instructions.

### Reference Architecture

This project's architecture is inspired by  
[Mike Westhad's Phaser 3 Tilemap Blog Series](https://medium.com/@michaelwesthadley/modular-game-worlds-in-phaser-3-tilemaps-1-958fc7e6bbd6)  
([GitHub](https://github.com/mikewesthad/phaser-3-tilemap-blog-posts)).

The code has been completely re-implemented from scratch in TypeScript with  
a Vite build system — no code from the original repository is used.

---

## Session Log

| Session | Date | Status | Summary |
|---------|------|--------|---------|
| Session 1 | 2026-06-13 | ✅ Complete | Foundation: Vite+TS+Phaser 3, tilemap, grid movement, collision, camera |

---

## Known Issues / TODOs for Session 2

- Placeholder procedural art needs replacing with real pixel sprites
- No tile extrusion (not needed for procedural textures; add if using real tilesets with bleeding)
- No audio system
- No scene transitions (beyond Boot → Overworld)
- Camera lerp value (0.08) may need tuning once real map size is known

---

## License

Fan game — all Pokémon IP belongs to Nintendo / Game Freak / Creatures Inc.  
This project is non-commercial and for educational/personal use only.
# Pokemon-Ashveil
# Pokemon-Ashveil
