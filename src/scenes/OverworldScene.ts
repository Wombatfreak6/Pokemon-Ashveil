import Phaser from "phaser";
import { Player, TILE_SIZE } from "@entities/Player";
import { NPC } from "@entities/NPC";
import { InputController } from "@systems/InputController";
import { DialogueBox } from "@systems/DialogueBox";
import type { DialogueSequence } from "@systems/DialogueTypes";

/**
 * OverworldScene — the main overworld / exploration scene.
 *
 * Responsibilities (Session 1 + 2):
 *   • Create and configure the Tiled tilemap
 *   • Instantiate the Player and wire up collision
 *   • Instantiate NPC entities from the "NPCs" object layer
 *   • Instantiate DialogueBox and load dialogue sequences from JSON cache
 *   • Set camera bounds and follow behaviour
 *   • Delegate all input handling to InputController
 *   • Delegate all player movement logic to Player
 *   • Gate player movement when dialogue is active
 *   • Handle confirm-key NPC interaction (face + adjacent check)
 *
 * CAMERA: Lerp-follow (lerpX/Y = 0.08) — smooth GBA-style tracking.
 *
 * CONFIRM KEY: Z / Enter / Space (edge-triggered via InputController).
 * See InputController.getConfirmJustPressed() for details.
 *
 * NPC INTERACTION:
 *   Player must be facing the NPC's tile (adjacent, correct direction).
 *   Pressing confirm triggers dialogue.  While dialogue is active all
 *   movement input is suppressed.
 */
export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private inputCtrl!: InputController;
  private dialogueBox!: DialogueBox;
  private npcs: NPC[] = [];
  private dialogueMap = new Map<string, DialogueSequence>();

  constructor() {
    super({ key: "OverworldScene" });
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  create(): void {
    this.loadDialogueData();
    const map = this.createTilemap();
    this.createPlayer(map);
    this.createNpcs(map);
    this.createDialogueBox();
    this.setupCamera(map);
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    // Always tick the dialogue box (typewriter reveal + blink)
    this.dialogueBox.update(delta);

    const confirm = this.inputCtrl.getConfirmJustPressed();

    if (this.dialogueBox.isActive()) {
      // While dialogue is open: confirm advances, movement suppressed
      if (confirm) {
        this.dialogueBox.advance();
      }
      return; // DO NOT pass movement to player
    }

    // No dialogue active — handle movement normally
    const direction = this.inputCtrl.getDirection();
    this.player.handleInput(direction);

    // Check for NPC interaction on confirm press
    if (confirm) {
      this.tryInteractNpc();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Load dialogue sequences from the JSON file cached in BootScene.
   * Stores them in a Map<id, DialogueSequence> for O(1) lookup.
   */
  private loadDialogueData(): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw: unknown = this.cache.json.get("dialogue-npcs");
    if (!Array.isArray(raw)) {
      console.warn("OverworldScene: dialogue-npcs JSON not found in cache.");
      return;
    }
    for (const entry of raw as DialogueSequence[]) {
      this.dialogueMap.set(entry.id, entry);
    }
  }

  /**
   * Builds the tilemap, creates layers, and sets up collision.
   * Returns the Tilemap object so other helpers can query its dimensions.
   */
  private createTilemap(): Phaser.Tilemaps.Tilemap {
    const map = this.make.tilemap({ key: "test-map" });

    // "tiles" is the Phaser texture key created in BootScene.
    // The first arg must match the tileset name declared inside test_map.tmj.
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
    const collisionLayer = map.createLayer("Collision", tileset, 0, 0);
    if (!collisionLayer)
      throw new Error("OverworldScene: Collision layer missing.");

    // Make all non-empty tiles in the Collision layer solid.
    collisionLayer.setCollisionByExclusion([-1]);

    // Semi-transparent collision layer for dev visibility.
    collisionLayer.setAlpha(0.35);

    // Set physics world bounds to map pixel dimensions.
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    return map;
  }

  /**
   * Instantiates the Player, wires collision against the tilemap, and
   * creates the InputController.
   */
  private createPlayer(map: Phaser.Tilemaps.Tilemap): void {
    let spawnTileX = 3;
    let spawnTileY = 3;

    const objectLayer = map.getObjectLayer("Spawns");
    if (objectLayer) {
      const spawnObj = objectLayer.objects.find(
        (obj) => obj.name === "PlayerSpawn"
      );
      if (spawnObj && spawnObj.x !== undefined && spawnObj.y !== undefined) {
        spawnTileX = Math.floor(spawnObj.x / (map.tileWidth ?? 16));
        spawnTileY = Math.floor(spawnObj.y / (map.tileHeight ?? 16));
      }
    }

    this.player = new Player(this, spawnTileX, spawnTileY);
    this.player.setMapBounds(map.widthInPixels, map.heightInPixels);

    const collisionLayer = map.getLayer("Collision")?.tilemapLayer;
    if (collisionLayer) {
      this.player.setCollisionLayer(collisionLayer);
      this.physics.add.collider(this.player, collisionLayer);
    }

    this.inputCtrl = new InputController(this);
  }

  /**
   * Reads NPC objects from the Tiled "NPCs" object layer and creates NPC
   * entities with distinct tints.
   *
   * Tiled object custom property: dialogueId (string)
   * Coordinates in Tiled are pixel-based; we convert to tile coords.
   */
  private createNpcs(map: Phaser.Tilemaps.Tilemap): void {
    const npcLayer = map.getObjectLayer("NPCs");
    if (!npcLayer) {
      console.warn('OverworldScene: No "NPCs" object layer found in map.');
      return;
    }

    // Distinct tints for each NPC so they're visually identifiable
    const tints = [0x44ccff, 0xff8844, 0x88ff44];
    let tintIndex = 0;

    for (const obj of npcLayer.objects) {
      if (obj.x === undefined || obj.y === undefined) continue;

      // Tiled places object origin at the bottom-left of the tile for point objects
      const tileX = Math.floor(obj.x / (map.tileWidth ?? 16));
      const tileY = Math.floor(obj.y / (map.tileHeight ?? 16));

      // Read the dialogueId custom property
      const dialogueId = this.getTiledProperty<string>(obj, "dialogueId");
      if (!dialogueId) {
        console.warn(`OverworldScene: NPC "${obj.name}" has no dialogueId property.`);
        continue;
      }

      const tint = tints[tintIndex % tints.length] ?? 0xffffff;
      tintIndex++;

      const npc = new NPC(this, tileX, tileY, dialogueId, tint);
      this.npcs.push(npc);
    }
  }

  /**
   * Creates the DialogueBox UI (screen-fixed, depth 20).
   * The box starts hidden; show() is called when an NPC is interacted with.
   */
  private createDialogueBox(): void {
    this.dialogueBox = new DialogueBox(this);
  }

  /**
   * Configures the main camera to follow the player within map bounds.
   */
  private setupCamera(map: Phaser.Tilemaps.Tilemap): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player, true, 0.08, 0.08);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  /**
   * Checks if the player is facing an NPC at the adjacent tile and, if so,
   * triggers dialogue.
   *
   * Rules (classic Pokémon style):
   *   - Player must be facing an adjacent tile (distance = 1 tile in that direction)
   *   - The NPC must occupy exactly that tile
   *   - If multiple NPCs somehow share a tile, only the first is triggered
   */
  private tryInteractNpc(): void {
    const facing = this.player.getFacing();
    const playerTileX = Math.round((this.player.x - TILE_SIZE / 2) / TILE_SIZE);
    const playerTileY = Math.round((this.player.y - TILE_SIZE / 2) / TILE_SIZE);

    const targetTileX = playerTileX + (facing === "left" ? -1 : facing === "right" ? 1 : 0);
    const targetTileY = playerTileY + (facing === "up" ? -1 : facing === "down" ? 1 : 0);

    const npc = this.npcs.find(
      (n) => n.tileX === targetTileX && n.tileY === targetTileY
    );

    if (!npc) return; // No NPC in front — silent no-op

    const sequence = npc.getDialogue(this.dialogueMap);
    if (!sequence) {
      console.warn(`OverworldScene: No dialogue found for id "${npc.dialogueId}".`);
      return;
    }

    this.dialogueBox.show(sequence);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Reads a Tiled object's custom property by name.
   * Returns undefined if the property doesn't exist.
   */
  private getTiledProperty<T>(
    obj: Phaser.Types.Tilemaps.TiledObject,
    name: string
  ): T | undefined {
    if (!obj.properties) return undefined;
    const prop = (obj.properties as Array<{ name: string; value: unknown }>).find(
      (p) => p.name === name
    );
    return prop?.value as T | undefined;
  }
}
