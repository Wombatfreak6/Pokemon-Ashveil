import Phaser from "phaser";
import type { Direction } from "@systems/InputController";

/** Tile size in pixels — must match the Tiled map tile size. */
export const TILE_SIZE = 16;

/**
 * Duration (ms) for the tween that slides the player from one tile to the next.
 * 175ms approximates the GBA Pokémon movement feel (160–200ms range).
 */
export const MOVE_DURATION = 175;

/**
 * Player entity.
 *
 * Extends Phaser.Physics.Arcade.Sprite so the physics body is available
 * for arcade colliders against the tilemap collision layer.
 *
 * Movement is GRID-SNAPPED — the player moves exactly one tile per input.
 * A Phaser tween smoothly slides the sprite between positions.
 * Input is ignored while a tween is in progress (isMoving flag).
 *
 * Collision is checked BEFORE the tween starts:
 *   • tilemap collision layer (solid tiles)
 *   • map world bounds
 * If the target tile is blocked the player just faces that direction
 * (plays idle animation) but does not move.
 *
 * Animation keys follow the pattern:
 *   walk-<direction>   (looping, played during tween)
 *   idle-<direction>   (single frame, played when stopped)
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private isMoving = false;
  private facing: Direction = "down";

  // Reference to the collision tilemap layer — injected after construction.
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // World bounds (pixels) — set from the map dimensions.
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number) {
    // Position is given in tile coordinates; convert to pixel centre.
    const pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, pixelX, pixelY, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Shrink the physics body slightly so the player fits through
    // single-tile-wide gaps (optional — keeps collisions feeling tight).
    this.setSize(TILE_SIZE - 2, TILE_SIZE - 2);
    this.setDepth(5); // Above ground tiles, below "above player" tiles

    this.createAnimations();
    this.anims.play("idle-down", true);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Call this after construction to give the player access to the collision
   * layer so it can do pre-movement tile checks.
   */
  setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer): void {
    this.collisionLayer = layer;
  }

  /**
   * Set the world/map bounds so the player cannot walk off the edge.
   * Values should be the map's pixel dimensions.
   */
  setMapBounds(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  /**
   * Called each frame by OverworldScene.update().
   * @param direction — result of InputController.getDirection(); null = no input
   */
  handleInput(direction: Direction | null): void {
    if (this.isMoving) return; // Movement tween in progress — ignore all input
    if (direction === null) return; // No key held

    this.facing = direction;

    const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

    const targetX = this.x + dx * TILE_SIZE;
    const targetY = this.y + dy * TILE_SIZE;

    // Guard: map bounds
    if (targetX < TILE_SIZE / 2 || targetX > this.mapWidth - TILE_SIZE / 2) {
      this.anims.play(`idle-${this.facing}`, true);
      return;
    }
    if (targetY < TILE_SIZE / 2 || targetY > this.mapHeight - TILE_SIZE / 2) {
      this.anims.play(`idle-${this.facing}`, true);
      return;
    }

    // Guard: collision layer tile check
    if (this.collisionLayer) {
      const tile = this.collisionLayer.getTileAtWorldXY(targetX, targetY);
      if (tile !== null && tile.index !== -1) {
        // Target tile exists in the collision layer → blocked
        this.anims.play(`idle-${this.facing}`, true);
        return;
      }
    }

    this.startMove(targetX, targetY);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private startMove(targetX: number, targetY: number): void {
    this.isMoving = true;
    this.anims.play(`walk-${this.facing}`, true);

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: MOVE_DURATION,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.anims.play(`idle-${this.facing}`, true);
      },
    });
  }

  /**
   * Create all walk and idle animations from the "player" spritesheet.
   *
   * Spritesheet layout (generated procedurally in BootScene):
   *   Row 0 (frames  0-1): walk down
   *   Row 1 (frames  2-3): walk left
   *   Row 2 (frames  4-5): walk right
   *   Row 3 (frames  6-7): walk up
   *
   * Each direction has 2 frames (minimal for a recognisable walk cycle).
   */
  private createAnimations(): void {
    const scene = this.scene;

    const directions: Array<{ dir: Direction; row: number }> = [
      { dir: "down", row: 0 },
      { dir: "left", row: 1 },
      { dir: "right", row: 2 },
      { dir: "up", row: 3 },
    ];

    for (const { dir, row } of directions) {
      const frame0 = row * 2;
      const frame1 = row * 2 + 1;

      // Walk animation (loops)
      if (!scene.anims.exists(`walk-${dir}`)) {
        scene.anims.create({
          key: `walk-${dir}`,
          frames: scene.anims.generateFrameNumbers("player", {
            frames: [frame0, frame1],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }

      // Idle animation (single frame, no loop)
      if (!scene.anims.exists(`idle-${dir}`)) {
        scene.anims.create({
          key: `idle-${dir}`,
          frames: [{ key: "player", frame: frame0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }
}
