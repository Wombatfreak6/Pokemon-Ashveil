import Phaser from "phaser";

export type Direction = "up" | "down" | "left" | "right";

/**
 * InputController — clean abstraction over keyboard input.
 *
 * Wraps Phaser cursor keys (arrow keys) and WASD so the rest of the
 * codebase never touches raw key objects.  Intentionally decoupled from
 * any game-state so it can be reused for menu navigation, cutscene skip,
 * etc. in future sessions.
 *
 * Usage:
 *   const input = new InputController(scene);
 *   // in update():
 *   const dir = input.getDirection(); // 'up' | 'down' | 'left' | 'right' | null
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error("InputController: keyboard plugin is not available.");
    }

    this.cursors = scene.input.keyboard.createCursorKeys();

    this.wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /**
   * Returns the first pressed directional input, or null if no direction key
   * is held.  Priority order: up → down → left → right (arrow keys and WASD
   * are treated identically).
   */
  getDirection(): Direction | null {
    if (this.cursors.up.isDown || this.wasd.up.isDown) return "up";
    if (this.cursors.down.isDown || this.wasd.down.isDown) return "down";
    if (this.cursors.left.isDown || this.wasd.left.isDown) return "left";
    if (this.cursors.right.isDown || this.wasd.right.isDown) return "right";
    return null;
  }

  /**
   * Returns true if any directional key is currently held.
   */
  isAnyDirectionDown(): boolean {
    return this.getDirection() !== null;
  }
}
