import Phaser from "phaser";
import type { DialogueSequence } from "@systems/DialogueTypes";
import { TILE_SIZE } from "@entities/Player";

/**
 * NPC — a static sprite placed on the tilemap at a given tile position.
 *
 * Each NPC holds a dialogueId string that maps to a DialogueSequence
 * entry in test_npcs.json.  The OverworldScene queries getNearbyNpc()
 * to find which (if any) NPC is in front of the player when confirm is pressed.
 *
 * NPCs are not physics bodies — they don't need collision; they're purely
 * visual and serve as interaction targets.  Interaction is handled via the
 * tile-position check in OverworldScene.
 *
 * Sprite: procedural NPC texture generated in BootScene ("npc").
 * Each NPC gets a tint to distinguish it visually from the player and
 * from other NPCs.
 */
export class NPC extends Phaser.GameObjects.Sprite {
  /** The dialogue sequence id to play when this NPC is talked to. */
  readonly dialogueId: string;

  /** Tile-grid position (for interaction distance check). */
  readonly tileX: number;
  readonly tileY: number;

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    dialogueId: string,
    tint: number = 0xffffff
  ) {
    // Centre of the tile in pixel space
    const pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, pixelX, pixelY, "npc");

    this.dialogueId = dialogueId;
    this.tileX = tileX;
    this.tileY = tileY;

    scene.add.existing(this);
    this.setDepth(5); // same depth as player
    this.setTint(tint);
  }

  /**
   * Look up this NPC's dialogue sequence in the provided map.
   * Returns null if the id is not found (graceful no-op).
   */
  getDialogue(
    sequences: Map<string, DialogueSequence>
  ): DialogueSequence | null {
    return sequences.get(this.dialogueId) ?? null;
  }

  getDialogueId(): string {
    return this.dialogueId;
  }
}
