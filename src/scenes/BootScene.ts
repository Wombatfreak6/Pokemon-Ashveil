import Phaser from "phaser";

/**
 * BootScene — loads all game assets and shows a loading bar.
 *
 * This is the first scene to run.  It uses Phaser's file-load pipeline
 * to fetch assets, then transitions to OverworldScene on complete.
 *
 * PLACEHOLDER ASSETS
 * ==================
 * Both the tileset and player spritesheet are generated programmatically
 * using Phaser's CanvasTexture API.  This removes any dependency on
 * external image files and makes the project fully reproducible from a
 * fresh clone.
 *
 * When custom art is ready (Session N), replace the two `createXxxTexture`
 * calls with real `this.load.image` / `this.load.spritesheet` calls and
 * delete the generator functions.
 *
 * Tileset layout  (128 × 16 px, 8 tiles of 16 × 16 px in a single row):
 *   [0] grass   [1] stone wall   [2] dirt path   [3] water
 *   [4] dark grass   [5] sand   [6] flowers   [7] void
 *
 * Player spritesheet layout  (32 × 64 px, 2 columns × 4 rows):
 *   row 0 → walk-down  (frames 0, 1)
 *   row 1 → walk-left  (frames 2, 3)
 *   row 2 → walk-right (frames 4, 5)
 *   row 3 → walk-up    (frames 6, 7)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.createLoadingBar();

    // Load the Tiled JSON map. Vite serves files in /public as root-relative paths.
    this.load.tilemapTiledJSON("test-map", "assets/maps/test_map.tmj");

    // Load dialogue data. Loaded as a JSON file — Phaser.Loader.LoaderPlugin
    // stores it under the key 'dialogue-npcs' and it is retrieved in
    // OverworldScene via this.cache.json.get('dialogue-npcs').
    this.load.json("dialogue-npcs", "assets/data/dialogue/test_npcs.json");
  }

  create(): void {
    // Build placeholder textures synchronously after load completes.
    this.createTilesetTexture();
    this.createPlayerTexture();
    this.createNpcTexture();

    this.scene.start("OverworldScene");
  }

  // ---------------------------------------------------------------------------
  // Loading bar
  // ---------------------------------------------------------------------------

  private createLoadingBar(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add
      .text(cx, cy - 30, "Pokémon Ashveil", {
        fontSize: "10px",
        color: "#e8e8e8",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Bar background
    this.add.rectangle(cx, cy, 140, 8, 0x333355).setOrigin(0.5);

    // Bar fill (starts at 0 width, anchored left)
    const barFill = this.add
      .rectangle(cx - 70, cy, 0, 8, 0x66aaff)
      .setOrigin(0, 0.5);

    const statusText = this.add
      .text(cx, cy + 14, "Loading…", {
        fontSize: "6px",
        color: "#aaaacc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      barFill.width = 140 * value;
    });

    this.load.on("fileprogress", (file: Phaser.Loader.File) => {
      statusText.setText(file.key);
    });
  }

  // ---------------------------------------------------------------------------
  // Procedural tileset texture
  // ---------------------------------------------------------------------------

  /**
   * Generates the "tiles" CanvasTexture at runtime.
   *
   * Dimensions: 128 × 16 px  (8 tiles of 16 × 16 px in a single row).
   * Each tile is registered as a named frame equal to its tile index
   * so Phaser's tilemap system can look them up correctly.
   *
   * Tile palette:
   *   0  grass        #4a8c3f
   *   1  stone wall   #6b6b7a  ← used in Collision layer
   *   2  dirt path    #a07850
   *   3  water        #3a6ea8
   *   4  dark grass   #2d5c28
   *   5  sand         #c8a860
   *   6  flowers      #4a8c3f + dots
   *   7  void         #222230
   */
  private createTilesetTexture(): void {
    const TILE = 16;
    const COLS = 8;

    if (this.textures.exists("tiles")) {
      this.textures.remove("tiles");
    }

    const tex = this.textures.createCanvas("tiles", TILE * COLS, TILE);
    if (!tex) return;

    const c = tex.context;

    const palette: string[] = [
      "#4a8c3f", // 0 grass
      "#6b6b7a", // 1 stone wall
      "#a07850", // 2 dirt path
      "#3a6ea8", // 3 water
      "#2d5c28", // 4 dark grass
      "#c8a860", // 5 sand
      "#4a8c3f", // 6 flowers base
      "#222230", // 7 void
    ];

    for (let i = 0; i < COLS; i++) {
      const x = i * TILE;

      c.fillStyle = palette[i];
      c.fillRect(x, 0, TILE, TILE);

      // Detail markings
      c.globalAlpha = 0.25;
      c.fillStyle = "#ffffff";

      if (i === 0) {
        // Grass highlights
        c.fillRect(x + 1, 1, 4, 1);
        c.fillRect(x + 8, 5, 3, 1);
        c.fillRect(x + 3, 10, 5, 1);
      } else if (i === 1) {
        // Stone wall brick pattern
        c.globalAlpha = 0.15;
        c.fillStyle = "#000000";
        c.fillRect(x, 5, TILE, 1);
        c.fillRect(x, 11, TILE, 1);
        c.fillRect(x + 8, 0, 1, 5);
        c.fillRect(x + 4, 6, 1, 5);
      } else if (i === 2) {
        // Dirt path lighter strip
        c.globalAlpha = 0.12;
        c.fillRect(x + 4, 2, 8, 12);
      } else if (i === 3) {
        // Water waves
        c.globalAlpha = 0.3;
        c.fillStyle = "#aaddff";
        c.fillRect(x + 2, 4, 5, 1);
        c.fillRect(x + 9, 4, 4, 1);
        c.fillRect(x + 1, 9, 4, 1);
        c.fillRect(x + 8, 10, 6, 1);
      } else if (i === 6) {
        // Flower dots
        c.globalAlpha = 1;
        c.fillStyle = "#dd44aa";
        c.fillRect(x + 3, 4, 2, 2);
        c.fillRect(x + 10, 9, 2, 2);
        c.fillStyle = "#eecc44";
        c.fillRect(x + 7, 3, 2, 2);
      }

      c.globalAlpha = 1;

      // Subtle border on each tile
      c.strokeStyle = "rgba(0,0,0,0.2)";
      c.lineWidth = 0.5;
      c.strokeRect(x + 0.25, 0.25, TILE - 0.5, TILE - 0.5);
    }

    tex.refresh();
  }

  // ---------------------------------------------------------------------------
  // Procedural player spritesheet
  // ---------------------------------------------------------------------------

  /**
   * Generates the "player" CanvasTexture spritesheet at runtime.
   *
   * Dimensions: 32 × 64 px (2 cols × 4 rows, 16 × 16 px per frame).
   * Frames are registered with integer keys 0–7 matching Player.ts animation
   * frame arrays.
   *
   * Frame map:
   *   0, 1 → walk-down
   *   2, 3 → walk-left
   *   4, 5 → walk-right
   *   6, 7 → walk-up
   *
   * When real art is ready: delete this method and add in preload():
   *   this.load.spritesheet('player', 'assets/sprites/player.png',
   *     { frameWidth: 16, frameHeight: 16 });
   * Then adjust frame indices in Player.ts → createAnimations().
   */
  private createPlayerTexture(): void {
    const FW = 16;
    const FH = 16;
    const COLS = 2; // frames per direction
    const ROWS = 4; // directions

    if (this.textures.exists("player")) {
      this.textures.remove("player");
    }

    const tex = this.textures.createCanvas("player", FW * COLS, FH * ROWS);
    if (!tex) return;

    const c = tex.context;

    const dirs = [
      { name: "down" as const,  row: 0, legDx: [-1, 1], armColor: "#cc4444" },
      { name: "left" as const,  row: 1, legDx: [-1, 1], armColor: "#4444cc" },
      { name: "right" as const, row: 2, legDx: [1, -1],  armColor: "#44cc44" },
      { name: "up" as const,    row: 3, legDx: [-1, 1], armColor: "#cc8844" },
    ];

    for (const dir of dirs) {
      for (let frame = 0; frame < COLS; frame++) {
        const px = frame * FW;
        const py = dir.row * FH;
        const isWalking = frame === 1;
        const legShift = isWalking ? dir.legDx[0] : 0;

        c.clearRect(px, py, FW, FH);

        // Shadow
        c.globalAlpha = 0.2;
        c.fillStyle = "#000000";
        c.beginPath();
        c.ellipse(px + 8, py + 15, 4, 1.5, 0, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;

        // Torso
        c.fillStyle = "#3a5fc8";
        c.fillRect(px + 5, py + 6, 6, 5);

        // Head
        c.fillStyle = "#f0c890";
        c.fillRect(px + 5, py + 1, 6, 5);

        // Face / eyes
        c.fillStyle = "#1a1a2e";
        if (dir.name === "down") {
          c.fillRect(px + 6, py + 3, 1, 1);
          c.fillRect(px + 9, py + 3, 1, 1);
        } else if (dir.name === "up") {
          c.fillStyle = "#5c3a1a";
          c.fillRect(px + 5, py + 1, 6, 3); // hair on back
        } else if (dir.name === "left") {
          c.fillRect(px + 6, py + 3, 1, 1);
        } else {
          c.fillRect(px + 9, py + 3, 1, 1);
        }

        // Hat
        c.fillStyle = "#cc2222";
        c.fillRect(px + 4, py + 0, 8, 2);
        c.fillRect(px + 5, py + 1, 6, 1);

        // Legs
        c.fillStyle = "#2a2a4a";
        if (isWalking) {
          c.fillRect(px + 5 + legShift, py + 11, 3, 4);
          c.fillRect(px + 8 - legShift, py + 11, 3, 3);
        } else {
          c.fillRect(px + 5, py + 11, 3, 4);
          c.fillRect(px + 8, py + 11, 3, 4);
        }

        // Shoes
        c.fillStyle = "#331a0a";
        if (isWalking) {
          c.fillRect(px + 4 + legShift, py + 14, 4, 2);
          c.fillRect(px + 8 - legShift, py + 13, 4, 2);
        } else {
          c.fillRect(px + 4, py + 14, 4, 2);
          c.fillRect(px + 8, py + 14, 4, 2);
        }

        // Direction-coloured scarf
        c.fillStyle = dir.armColor;
        c.globalAlpha = 0.8;
        c.fillRect(px + 5, py + 6, 6, 1);
        c.globalAlpha = 1;
      }
    }

    // Register integer-indexed frames so animation system can reference 0..7.
    // signature: tex.add(name, sourceIndex, x, y, width, height)
    const totalFrames = COLS * ROWS;
    for (let i = 0; i < totalFrames; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      tex.add(i, 0, col * FW, row * FH, FW, FH);
    }

    tex.refresh();
  }

  // ---------------------------------------------------------------------------
  // Procedural NPC texture
  // ---------------------------------------------------------------------------

  /**
   * Generates the "npc" CanvasTexture: a 16×16 pixel sprite.
   *
   * NPCs are visually distinct from the player:
   *   - Rounder head shape
   *   - No hat
   *   - Yellow body (coat) instead of blue shirt
   *   - A small question mark on the torso (classic Pokémon cue)
   *
   * In-world each NPC gets a unique .setTint() colour applied by OverworldScene
   * so three NPCs are immediately distinguishable from one another.
   *
   * When real NPC art is ready:
   *   - Add this.load.spritesheet('npc', 'assets/sprites/npc.png', {…}) to preload()
   *   - Delete this method and its call in create()
   */
  private createNpcTexture(): void {
    const FW = 16;
    const FH = 16;

    if (this.textures.exists("npc")) {
      this.textures.remove("npc");
    }

    const tex = this.textures.createCanvas("npc", FW, FH);
    if (!tex) return;

    const c = tex.context;

    // Shadow
    c.globalAlpha = 0.2;
    c.fillStyle = "#000000";
    c.beginPath();
    c.ellipse(8, 15, 4, 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // Body / coat (yellow)
    c.fillStyle = "#c8a020";
    c.fillRect(4, 7, 8, 5);

    // Head (rounder — slightly wider)
    c.fillStyle = "#f0c890";
    c.fillRect(4, 1, 8, 6);

    // Eyes (two dots, centred, facing down/camera)
    c.fillStyle = "#1a1a2e";
    c.fillRect(6, 3, 1, 1);
    c.fillRect(9, 3, 1, 1);

    // Smile line
    c.fillRect(6, 5, 4, 1);

    // Hair tuft on top
    c.fillStyle = "#5c3a1a";
    c.fillRect(5, 0, 6, 2);

    // Legs
    c.fillStyle = "#2a2a4a";
    c.fillRect(5, 12, 3, 3);
    c.fillRect(8, 12, 3, 3);

    // Question mark on coat (classic NPC cue)
    c.fillStyle = "#ffffff";
    c.globalAlpha = 0.7;
    c.fillRect(8, 8, 1, 1); // dot
    c.fillRect(7, 7, 2, 1); // top
    c.fillRect(8, 7, 1, 2); // stem + hook
    c.globalAlpha = 1;

    tex.refresh();
  }
}
