import Phaser from "phaser";
import { Player } from "@entities/Player";
import { InputController } from "@systems/InputController";

/**
 * OverworldScene — the main overworld / exploration scene.
 *
 * Responsibilities:
 *   • Create and configure the Tiled tilemap
 *   • Instantiate the Player and wire up collision
 *   • Set camera bounds and follow behaviour
 *   • Delegate all input handling to InputController
 *   • Delegate all player movement logic to Player
 *
 * This scene intentionally contains NO movement or physics logic directly.
 * Those concerns live in Player.ts and InputController.ts respectively.
 *
 * CAMERA DECISION
 * ===============
 * Lerp-follow (lerpX/Y = 0.08) rather than snap-follow.
 * Rationale: the lerp matches the smooth tile-tween feel and hides the
 * seam when the player accelerates into movement. Classic GBA Pokémon used
 * per-frame scroll that effectively feels like lerp ≈ 0.2.  Snap-follow
 * can be enabled for Session 2 if preferred — just pass (true, true, 1, 1).
 */
export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private inputCtrl!: InputController;

  constructor() {
    super({ key: "OverworldScene" });
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  create(): void {
    const map = this.createTilemap();
    this.createPlayer(map);
    this.setupCamera(map);
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  update(): void {
    const direction = this.inputCtrl.getDirection();
    this.player.handleInput(direction);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds the tilemap, creates layers, and sets up collision.
   * Returns the Tilemap object so other helpers can query its dimensions.
   */
  private createTilemap(): Phaser.Tilemaps.Tilemap {
    const map = this.make.tilemap({ key: "test-map" });

    // "tiles" is the Phaser texture key created in BootScene.
    // The first arg must match the tileset name declared inside test_map.tmj.
    // No margin/spacing because we're using a plain (non-extruded) generated texture.
    const tileset = map.addTilesetImage("placeholder_tiles", "tiles");
    if (!tileset) {
      throw new Error(
        'OverworldScene: tileset "placeholder_tiles" not found in map.'
      );
    }

    // Ground layer — visual only, no collision
    const groundLayer = map.createLayer("Ground", tileset, 0, 0);
    if (!groundLayer) throw new Error("OverworldScene: Ground layer missing.");

    // Collision layer — tiles here block the player.
    // Uses setCollisionByExclusion so every tile present in this layer is solid.
    const collisionLayer = map.createLayer("Collision", tileset, 0, 0);
    if (!collisionLayer)
      throw new Error("OverworldScene: Collision layer missing.");

    // Make all non-empty tiles in the Collision layer solid.
    // -1 is Phaser's sentinel for "empty cell".
    collisionLayer.setCollisionByExclusion([-1]);

    // Keep collision layer visible (slightly transparent) in dev mode.
    // Comment this line out for production / when using real art.
    collisionLayer.setAlpha(0.35);

    // Set physics world bounds to map pixel dimensions so the player
    // cannot walk into the void beyond the map edge.
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    return map;
  }

  /**
   * Instantiates the Player, wires collision against the tilemap, and
   * creates the InputController.
   */
  private createPlayer(map: Phaser.Tilemaps.Tilemap): void {
    // Find the spawn point from the Tiled "Objects" layer.
    // Falls back to tile (3, 3) if no spawn object is defined.
    let spawnTileX = 3;
    let spawnTileY = 3;

    const objectLayer = map.getObjectLayer("Spawns");
    if (objectLayer) {
      const spawnObj = objectLayer.objects.find(
        (obj) => obj.name === "PlayerSpawn"
      );
      if (spawnObj && spawnObj.x !== undefined && spawnObj.y !== undefined) {
        // Tiled object coordinates are pixel-based, convert to tile coords.
        spawnTileX = Math.floor(spawnObj.x / (map.tileWidth ?? 16));
        spawnTileY = Math.floor(spawnObj.y / (map.tileHeight ?? 16));
      }
    }

    this.player = new Player(this, spawnTileX, spawnTileY);
    this.player.setMapBounds(map.widthInPixels, map.heightInPixels);

    // Wire collision layer reference for pre-move tile checks in Player.ts
    const collisionLayer = map.getLayer("Collision")?.tilemapLayer;
    if (collisionLayer) {
      this.player.setCollisionLayer(collisionLayer);

      // Arcade collider as a fallback safety net (physics body vs layer)
      this.physics.add.collider(this.player, collisionLayer);
    }

    this.inputCtrl = new InputController(this);
  }

  /**
   * Configures the main camera to follow the player within map bounds.
   */
  private setupCamera(map: Phaser.Tilemaps.Tilemap): void {
    const cam = this.cameras.main;

    // Lock camera to map dimensions — never show the void outside the map.
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Smooth lerp-follow.  lerpX/Y = 0.08 gives a nice GBA-style tracking feel.
    // The second argument (roundPixels) is set to true to avoid sub-pixel jitter.
    cam.startFollow(this.player, true, 0.08, 0.08);
  }
}
