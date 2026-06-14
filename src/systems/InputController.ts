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
 * CONFIRM KEY
 * ===========
 * Mapped to the Z key (classic GBA A-button mapping in fan emulators).
 * Also accepts Enter and Space for accessibility.
 * getConfirmJustPressed() is EDGE-TRIGGERED — returns true only on the
 * frame the key transitions from up→down.  This prevents rapid-fire
 * skipping through multiple dialogue lines on a held key.
 *
 * Usage:
 *   const input = new InputController(scene);
 *   // in update():
 *   const dir = input.getDirection();
 *   const confirm = input.getConfirmJustPressed();
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  /**
   * Confirm key: Z (GBA A-button), Enter, or Space.
   * All three map to the same action.
   */
  private confirmKeys: Phaser.Input.Keyboard.Key[];

  /**
   * Cancel key: X (GBA B-button).
   */
  private cancelKeys: Phaser.Input.Keyboard.Key[];

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

    this.confirmKeys = [
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    ];

    this.cancelKeys = [
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    ];
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

  /**
   * Returns true on the SINGLE FRAME when a confirm key (Z / Enter / Space)
   * transitions from released → pressed.
   *
   * Edge-triggered: will NOT return true on subsequent frames while the key
   * is held.  This prevents rapid-fire dialogue skipping.
   *
   * Mapped to: Z (primary, GBA A-button), Enter, Space (accessibility).
   */
  getConfirmJustPressed(): boolean {
    return this.confirmKeys.some((key) =>
      Phaser.Input.Keyboard.JustDown(key)
    );
  }

  /**
   * Returns true on the SINGLE FRAME when a cancel key (X)
   * transitions from released → pressed.
   *
   * Edge-triggered: will NOT return true on subsequent frames while the key
   * is held.
   *
   * Mapped to: X (GBA B-button).
   */
  getCancelJustPressed(): boolean {
    return this.cancelKeys.some((key) =>
      Phaser.Input.Keyboard.JustDown(key)
    );
  }
}
