import Phaser from "phaser";
import { GameConfig } from "@config/GameConfig";

/**
 * Entry point — instantiates the Phaser.Game with the config defined in
 * GameConfig.ts.  Keeps this file intentionally minimal.
 */
new Phaser.Game(GameConfig);
