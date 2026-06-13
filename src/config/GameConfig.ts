import Phaser from "phaser";
import { BootScene } from "@scenes/BootScene";
import { OverworldScene } from "@scenes/OverworldScene";

/**
 * GBA-authentic Phaser game configuration.
 *
 * Resolution: 240×160 — the true GBA screen resolution.
 * The Phaser Scale Manager (FIT mode) scales this up to fill the
 * browser window while maintaining the aspect ratio and using
 * integer scaling where possible.
 *
 * pixelArt: true  → disables WebGL texture anti-aliasing (CRITICAL for crisp pixels)
 * roundPixels: true → prevents sub-pixel rendering jitter during camera movement
 */
export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL preferred, Canvas fallback
  width: 240, // GBA native width  (240px)
  height: 160, // GBA native height (160px)
  backgroundColor: "#0a0a0f",
  parent: "game-container",

  pixelArt: true, // Disables texture smoothing — mandatory for pixel art
  roundPixels: true, // Prevents sub-pixel camera jitter

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 }, // Top-down — no gravity
      debug: false, // Set to true to see physics bodies during development
    },
  },

  scene: [BootScene, OverworldScene],
};
