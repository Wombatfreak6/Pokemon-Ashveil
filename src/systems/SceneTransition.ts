import Phaser from "phaser";

export const TRANSITION_DURATION_MS = 300;

export class SceneTransition {
  /**
   * Fades the screen out to black.
   * Creates a black rectangle covering the viewport and tweens its alpha from 0 to 1.
   *
   * @param scene The Phaser scene making the transition
   * @param duration Duration of the fade out in ms
   * @param callback Called when the fade out completes
   */
  public static fadeOut(
    scene: Phaser.Scene,
    duration: number = TRANSITION_DURATION_MS,
    callback: () => void
  ): void {
    const { width, height } = scene.scale;

    // Create a black rectangle covering the screen
    const blackScreen = scene.add
      .rectangle(0, 0, width, height, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0) // Fixed to screen
      .setDepth(999)      // Above everything else
      .setAlpha(0);       // Start transparent

    // Tween to opaque
    scene.tweens.add({
      targets: blackScreen,
      alpha: 1,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        callback();
      },
    });
  }

  /**
   * Fades the screen in from black.
   * Creates a black rectangle and tweens its alpha from 1 to 0, then destroys it.
   *
   * @param scene The Phaser scene making the transition
   * @param duration Duration of the fade in in ms
   * @param callback Optional callback when fade in completes
   */
  public static fadeIn(
    scene: Phaser.Scene,
    duration: number = TRANSITION_DURATION_MS,
    callback?: () => void
  ): void {
    const { width, height } = scene.scale;

    // Create a black rectangle covering the screen
    const blackScreen = scene.add
      .rectangle(0, 0, width, height, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999)
      .setAlpha(1); // Start fully opaque

    // Tween to transparent
    scene.tweens.add({
      targets: blackScreen,
      alpha: 0,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        blackScreen.destroy();
        if (callback) {
          callback();
        }
      },
    });
  }
}
