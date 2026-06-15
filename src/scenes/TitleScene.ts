import Phaser from "phaser";
import { GameStateManager } from "@systems/GameStateManager";
import { SceneTransition } from "@systems/SceneTransition";
import { InputController } from "@systems/InputController";

const SCREEN_W = 240;
const SCREEN_H = 160;

export class TitleScene extends Phaser.Scene {
  private hasSave = false;
  private options: string[] = [];
  private selectedIndex = 0;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private inputCtrl!: InputController;

  private state: "MENU" | "CONFIRM_ERASE" = "MENU";
  private confirmOptions: string[] = ["NO", "YES"];
  private confirmIndex = 0;
  
  // Prompt UI
  private promptBg!: Phaser.GameObjects.Rectangle;
  private promptBorder!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private promptOptionTexts: Phaser.GameObjects.Text[] = [];
  private promptCursor!: Phaser.GameObjects.Text;

  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    const gameState = GameStateManager.getInstance();
    this.hasSave = gameState.hasSave();
    this.inputCtrl = new InputController(this);

    if (this.input.keyboard) {
      this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    }

    // Fade in from BootScene
    SceneTransition.fadeIn(this, 300);

    // Background (Navy dotted pattern or solid)
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x0a0a1e).setOrigin(0, 0);

    // Title text
    this.add
      .text(SCREEN_W / 2, 40, "POKÉMON ASHVEIL", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f8d020", // Gold
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(SCREEN_W / 2, 60, "The Lost Cartridge", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Options
    this.options = this.hasSave ? ["CONTINUE", "NEW GAME"] : ["NEW GAME"];
    this.selectedIndex = 0;

    const startY = 90;
    this.options.forEach((opt, idx) => {
      const t = this.add
        .text(SCREEN_W / 2, startY + idx * 20, opt, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.optionTexts.push(t);
    });

    // Cursor
    this.cursor = this.add
      .text(0, 0, "▶", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5);
    
    this.updateCursor();

    // Hint
    this.add
      .text(SCREEN_W / 2, SCREEN_H - 10, "Press Z to select", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    this.createPromptUI();
  }

  private createPromptUI(): void {
    const depth = 50;
    const boxW = 140;
    const boxH = 60;
    const boxX = (SCREEN_W - boxW) / 2;
    const boxY = (SCREEN_H - boxH) / 2;

    this.promptBg = this.add.rectangle(boxX, boxY, boxW, boxH, 0x0a0a1e, 0.95).setOrigin(0, 0).setDepth(depth).setVisible(false);
    this.promptBorder = this.add.rectangle(boxX, boxY, boxW, boxH).setOrigin(0, 0).setStrokeStyle(2, 0x4a4a5e).setDepth(depth).setVisible(false);
    
    this.promptText = this.add.text(SCREEN_W / 2, boxY + 10, "Erase existing save?", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    const startY = boxY + 30;
    this.confirmOptions.forEach((opt, idx) => {
      const t = this.add.text(SCREEN_W / 2, startY + idx * 14, opt, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff"
      }).setOrigin(0.5).setDepth(depth).setVisible(false);
      this.promptOptionTexts.push(t);
    });

    this.promptCursor = this.add.text(0, 0, "▶", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(1, 0.5).setDepth(depth).setVisible(false);
  }

  private updateCursor(): void {
    const targetText = this.optionTexts[this.selectedIndex];
    this.cursor.setPosition(targetText.x - targetText.width / 2 - 8, targetText.y);
  }

  private updatePromptCursor(): void {
    const targetText = this.promptOptionTexts[this.confirmIndex];
    this.promptCursor.setPosition(targetText.x - targetText.width / 2 - 8, targetText.y);
  }

  update(): void {
    const confirm = this.inputCtrl.getConfirmJustPressed();
    const upJustPressed = Phaser.Input.Keyboard.JustDown(this.keyUp) || Phaser.Input.Keyboard.JustDown(this.keyW);
    const downJustPressed = Phaser.Input.Keyboard.JustDown(this.keyDown) || Phaser.Input.Keyboard.JustDown(this.keyS);

    if (this.state === "MENU") {
      if (upJustPressed) {
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.updateCursor();
        }
      } else if (downJustPressed) {
        if (this.selectedIndex < this.options.length - 1) {
          this.selectedIndex++;
          this.updateCursor();
        }
      }

      if (confirm) {
        const selection = this.options[this.selectedIndex];
        if (selection === "CONTINUE") {
          GameStateManager.getInstance().load();
          this.startGame(true);
        } else if (selection === "NEW GAME") {
          if (this.hasSave) {
            this.state = "CONFIRM_ERASE";
            this.showPrompt();
          } else {
            this.startGame(false);
          }
        }
      }
    } else if (this.state === "CONFIRM_ERASE") {
      if (upJustPressed) {
        if (this.confirmIndex > 0) {
          this.confirmIndex--;
          this.updatePromptCursor();
        }
      } else if (downJustPressed) {
        if (this.confirmIndex < this.confirmOptions.length - 1) {
          this.confirmIndex++;
          this.updatePromptCursor();
        }
      }

      if (confirm) {
        if (this.confirmOptions[this.confirmIndex] === "YES") {
          GameStateManager.getInstance().deleteSave();
          this.startGame(false);
        } else {
          this.hidePrompt();
          this.state = "MENU";
        }
      }
    }
  }

  private showPrompt(): void {
    this.promptBg.setVisible(true);
    this.promptBorder.setVisible(true);
    this.promptText.setVisible(true);
    this.promptOptionTexts.forEach((t) => t.setVisible(true));
    this.promptCursor.setVisible(true);
    this.confirmIndex = 0;
    this.updatePromptCursor();
  }

  private hidePrompt(): void {
    this.promptBg.setVisible(false);
    this.promptBorder.setVisible(false);
    this.promptText.setVisible(false);
    this.promptOptionTexts.forEach((t) => t.setVisible(false));
    this.promptCursor.setVisible(false);
  }

  private startGame(isContinue: boolean): void {
    // Disable input
    this.state = "MENU";
    SceneTransition.fadeOut(this, 300, () => {
      this.scene.start("OverworldScene", { returnFromBattle: isContinue, whiteout: false });
    });
  }
}
