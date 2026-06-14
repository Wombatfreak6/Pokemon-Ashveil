import Phaser from "phaser";
import { InputController } from "@systems/InputController";
import { resolveTurn } from "@systems/BattleEngine";
import type {
  BattlePokemon,
  BattleState,
  BattleEvent,
  PokemonSpecies,
  Move,
  Trainer
} from "@systems/BattleTypes";

/** Native GBA screen resolution */
const SCREEN_W = 240;

export class BattleScene extends Phaser.Scene {
  private inputCtrl!: InputController;

  // ─── JSON Datasets ──────────────────────────────────────────────────────────
  private pokemonData!: PokemonSpecies[];
  private movesData!: Move[];
  private typeChart!: Record<string, Record<string, number>>;
  private trainersData!: Trainer[];

  // ─── Battle State ────────────────────────────────────────────────────────────
  private battleState!: BattleState;
  private selectedMenuRow = 0;
  private selectedMenuCol = 0;

  // ─── Phaser GameObjects ─────────────────────────────────────────────────────

  // Sprites
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite;

  // HP Bars (must be class fields — updated during battle)
  private enemyHpBarFill!: Phaser.GameObjects.Graphics;
  private playerHpBarFill!: Phaser.GameObjects.Graphics;
  private playerHpValueText!: Phaser.GameObjects.Text;

  // Log Area
  private battleLogText!: Phaser.GameObjects.Text;

  // Move Menu Elements
  private moveTexts: Phaser.GameObjects.Text[] = [];
  private menuCursor!: Phaser.GameObjects.Text;
  private moveTypeLabel!: Phaser.GameObjects.Text;
  private movePpLabel!: Phaser.GameObjects.Text;
  private runLabelText!: Phaser.GameObjects.Text;

  // Animation Queue
  private eventsQueue: BattleEvent[] = [];
  private isAnimatingEvent = false;

  constructor() {
    super({ key: "BattleScene" });
  }

  init(data: {
    isWildBattle: boolean;
    wildSpeciesId?: number;
    wildLevel?: number;
    trainerId?: string;
    playerParty: BattlePokemon[];
  }): void {
    // Load JSON data cached in BootScene
    this.pokemonData = this.cache.json.get("pokemon-data") as PokemonSpecies[];
    this.movesData = this.cache.json.get("moves-data") as Move[];
    this.typeChart = this.cache.json.get("type-chart") as Record<string, Record<string, number>>;
    this.trainersData = this.cache.json.get("trainers-data") as Trainer[];

    // Clone player's first party member as the active combatant
    const playerPokemon = JSON.parse(JSON.stringify(data.playerParty[0])) as BattlePokemon;

    // Resolve enemy pokemon
    let enemyPokemon: BattlePokemon;

    if (data.isWildBattle) {
      const wildId = data.wildSpeciesId ?? 5; // Rattata default
      const wildLevel = data.wildLevel ?? 8;
      const species = this.pokemonData.find((s) => s.id === wildId);
      if (!species) {
        throw new Error(`BattleScene: Unknown species ID ${wildId}`);
      }
      // Set stats and moves based on level
      enemyPokemon = this.createBattlePokemonFromData(species, wildLevel);
    } else {
      // Trainer Battle
      const trainer = this.trainersData.find((t) => t.id === data.trainerId);
      if (!trainer) {
        throw new Error(`BattleScene: Unknown trainer ID ${data.trainerId}`);
      }
      const trainerActive = trainer.party[0]; // first Pokémon
      const species = this.pokemonData.find((s) => s.id === trainerActive.speciesId);
      if (!species) {
        throw new Error(`BattleScene: Unknown trainer Pokémon species ${trainerActive.speciesId}`);
      }
      enemyPokemon = this.createBattlePokemonFromData(species, trainerActive.level);

      // Apply trainer's custom moveset if specified
      if (trainerActive.moves && trainerActive.moves.length > 0) {
        enemyPokemon.moves = trainerActive.moves.map((moveId) => {
          const moveDetails = this.movesData.find((m) => m.id === moveId);
          const maxPp = moveDetails ? moveDetails.pp : 35;
          return {
            moveId,
            currentPp: maxPp,
            maxPp
          };
        });
      }
    }

    this.battleState = {
      phase: "intro",
      playerPokemon,
      enemyPokemon,
      isWildBattle: data.isWildBattle,
      turn: 0
    };

    if (data.trainerId !== undefined) {
      this.battleState.trainerId = data.trainerId;
    }

    this.eventsQueue = [];
    this.isAnimatingEvent = false;
    this.selectedMenuRow = 0;
    this.selectedMenuCol = 0;
  }

  create(): void {
    this.inputCtrl = new InputController(this);

    // Ensure camera rounds pixels
    this.cameras.main.setRoundPixels(true);

    // ── Create Background & Platforms ─────────────────────────────────────────
    const bgDepth = 0;
    this.add.rectangle(0, 0, SCREEN_W, 80, 0x8cc6ff).setOrigin(0, 0).setDepth(bgDepth);
    this.add.rectangle(0, 80, SCREEN_W, 80, 0x5c9e3b).setOrigin(0, 0).setDepth(bgDepth);

    // Platforms
    this.add.ellipse(65, 120, 90, 24, 0x4c8e2b).setDepth(bgDepth + 1);
    this.add.ellipse(175, 60, 80, 20, 0x4c8e2b).setDepth(bgDepth + 1);

    // ── Create Sprites ────────────────────────────────────────────────────────
    const spriteDepth = 5;
    const playerSpeciesId = this.battleState.playerPokemon.speciesId;
    const enemySpeciesId = this.battleState.enemyPokemon.speciesId;

    this.playerSprite = this.add
      .sprite(50, 115, `pokemon_${playerSpeciesId}_back`)
      .setOrigin(0.5, 1)
      .setDepth(spriteDepth);

    this.enemySprite = this.add
      .sprite(180, 55, `pokemon_${enemySpeciesId}_front`)
      .setOrigin(0.5, 1)
      .setDepth(spriteDepth);

    // ── Create UI Panels ──────────────────────────────────────────────────────
    const uiDepth = 10;
    const panelY = 100;
    const panelH = 60;

    this.add
      .rectangle(0, panelY, SCREEN_W, panelH, 0x1a2e4c, 0.95)
      .setOrigin(0, 0)
      .setDepth(uiDepth);

    this.add
      .rectangle(0, panelY, SCREEN_W, panelH, 0, 0)
      .setOrigin(0, 0)
      .setDepth(uiDepth)
      .setStrokeStyle(1.5, 0x5c8cd8, 1);

    // ── Enemy Stats Panel (Upper-Left) ─────────────────────────────────────────
    const enemyName = this.getSpeciesName(enemySpeciesId).toUpperCase();
    this.add
      .text(10, 10, enemyName, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff"
      })
      .setDepth(uiDepth + 1);

    this.add
      .text(80, 10, `Lv${this.battleState.enemyPokemon.level}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66"
      })
      .setDepth(uiDepth + 1);

    // Enemy HP Bar
    this.add
      .rectangle(10, 22, 60, 4, 0x4c4c4c)
      .setOrigin(0, 0)
      .setDepth(uiDepth + 1);

    this.enemyHpBarFill = this.add.graphics().setDepth(uiDepth + 2);
    this.enemyHpBarFill.setPosition(10, 22);

    // ── Player Stats Panel (Lower-Right) ───────────────────────────────────────
    const playerName = this.getSpeciesName(playerSpeciesId).toUpperCase();
    this.add
      .text(140, 52, playerName, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff"
      })
      .setDepth(uiDepth + 1);

    this.add
      .text(210, 52, `Lv${this.battleState.playerPokemon.level}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66"
      })
      .setDepth(uiDepth + 1);

    // Player HP Bar
    this.add
      .rectangle(140, 64, 60, 4, 0x4c4c4c)
      .setOrigin(0, 0)
      .setDepth(uiDepth + 1);

    this.playerHpBarFill = this.add.graphics().setDepth(uiDepth + 2);
    this.playerHpBarFill.setPosition(140, 64);

    // Player HP numeric value
    this.playerHpValueText = this.add
      .text(
        140,
        71,
        `${this.battleState.playerPokemon.currentHp}/${this.battleState.playerPokemon.maxHp}`,
        {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#ffffff"
        }
      )
      .setDepth(uiDepth + 1);

    // Draw initial HP bars
    this.updateHpBarFill("player");
    this.updateHpBarFill("enemy");

    // ── Battle Log Message Box ─────────────────────────────────────────────────
    this.battleLogText = this.add
      .text(10, panelY + 8, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
        wordWrap: { width: 220 }
      })
      .setDepth(uiDepth + 1);

    // ── 2x2 Fight Move Grid Menu (Bottom-Right) ──────────────────────────────────
    const gridStartX = 115;
    const gridStartY = panelY + 12;
    const gridColW = 60;
    const gridRowH = 20;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = gridStartX + col * gridColW;
        const y = gridStartY + row * gridRowH;

        const textObj = this.add
          .text(x, y, "", {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ffffff"
          })
          .setDepth(uiDepth + 1)
          .setVisible(false);

        this.moveTexts.push(textObj);
      }
    }

    // Grid cursor selector (">")
    this.menuCursor = this.add
      .text(0, 0, ">", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66"
      })
      .setDepth(uiDepth + 2)
      .setVisible(false);

    // Move stats panel (Left side of FIGHT menu)
    this.movePpLabel = this.add
      .text(10, panelY + 12, "PP: --/--", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff"
      })
      .setDepth(uiDepth + 1)
      .setVisible(false);

    this.moveTypeLabel = this.add
      .text(10, panelY + 32, "TYPE: -----", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66"
      })
      .setDepth(uiDepth + 1)
      .setVisible(false);

    // Wild Flee Hotkey Indicator "[X] Run" (left bottom panel area)
    this.runLabelText = this.add
      .text(10, panelY + 44, "[X] Run", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ffdd66"
      })
      .setDepth(uiDepth + 1)
      .setVisible(false);

    // Bind edge-triggered directional events for menu grid
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.battleState.phase !== "playerTurn") return;

      const movesCount = this.battleState.playerPokemon.moves.length;
      if (movesCount === 0) return;

      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        const newRow = (this.selectedMenuRow - 1 + 2) % 2;
        const targetIndex = newRow * 2 + this.selectedMenuCol;
        if (targetIndex < movesCount) {
          this.selectedMenuRow = newRow;
          this.updateMenuCursor();
        }
      } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        const newRow = (this.selectedMenuRow + 1) % 2;
        const targetIndex = newRow * 2 + this.selectedMenuCol;
        if (targetIndex < movesCount) {
          this.selectedMenuRow = newRow;
          this.updateMenuCursor();
        }
      } else if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        const newCol = (this.selectedMenuCol - 1 + 2) % 2;
        const targetIndex = this.selectedMenuRow * 2 + newCol;
        if (targetIndex < movesCount) {
          this.selectedMenuCol = newCol;
          this.updateMenuCursor();
        }
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        const newCol = (this.selectedMenuCol + 1) % 2;
        const targetIndex = this.selectedMenuRow * 2 + newCol;
        if (targetIndex < movesCount) {
          this.selectedMenuCol = newCol;
          this.updateMenuCursor();
        }
      }
    });

    // Start Intro
    this.runIntro();
  }

  update(_time: number, _delta: number): void {
    // 1. Process Event Animation Queue
    if (this.eventsQueue.length > 0 && !this.isAnimatingEvent) {
      this.processNextEvent();
      return;
    }

    // 2. Handle Inputs in Player Turn
    if (this.battleState.phase === "playerTurn" && !this.isAnimatingEvent) {
      const confirm = this.inputCtrl.getConfirmJustPressed();
      const cancel = this.inputCtrl.getCancelJustPressed();

      // Confirm selected move
      if (confirm) {
        const moves = this.battleState.playerPokemon.moves;
        const selectedIndex = this.selectedMenuRow * 2 + this.selectedMenuCol;

        if (selectedIndex < moves.length) {
          const selectedMove = moves[selectedIndex];
          if (selectedMove.currentPp > 0) {
            // Hide menu and process turn resolver
            this.hideMoveMenu();

            this.battleState.phase = "animating";
            const turnResult = resolveTurn(
              this.battleState,
              selectedMove.moveId,
              this.pokemonData,
              this.movesData,
              this.typeChart
            );

            this.battleState = turnResult.newState;
            this.eventsQueue = turnResult.events;
            this.processNextEvent();
          } else {
            // Flash red on PP error (or simple print message)
            this.battleLogText.setText("No PP left for this move!");
            this.time.delayedCall(1000, () => {
              this.updateMoveStatsDisplay();
            });
          }
        }
      }

      // Cancel button triggers Run flee option (wild battles only)
      if (cancel && this.battleState.isWildBattle) {
        this.hideMoveMenu();
        this.battleState.phase = "fled";

        this.eventsQueue.push({
          type: "message",
          text: "Got away safely!"
        });
        this.eventsQueue.push({
          type: "phaseChange",
          phase: "fled"
        });
        this.processNextEvent();
      }
    }

    // 3. Return to Overworld on press key after Battle Complete phases
    const battleEnded =
      this.battleState.phase === "victory" ||
      this.battleState.phase === "defeat" ||
      this.battleState.phase === "fled";

    if (battleEnded && !this.isAnimatingEvent) {
      if (this.inputCtrl.getConfirmJustPressed() || this.inputCtrl.getCancelJustPressed()) {
        this.scene.start("OverworldScene");
      }
    }
  }

  // ─── Event Processing Engine ───────────────────────────────────────────────

  private processNextEvent(): void {
    if (this.eventsQueue.length === 0) {
      this.isAnimatingEvent = false;
      return;
    }

    this.isAnimatingEvent = true;
    const event = this.eventsQueue.shift()!;

    switch (event.type) {
      case "message":
        this.battleLogText.setVisible(true).setText(event.text);
        this.time.delayedCall(750, () => {
          this.isAnimatingEvent = false;
        });
        break;

      case "damage":
        this.animateHpDamage(event.target, event.amount);
        break;

      case "faint":
        this.animateFaint(event.target);
        break;

      case "phaseChange":
        this.battleState.phase = event.phase;
        if (event.phase === "playerTurn") {
          this.showMoveMenu();
        }
        this.isAnimatingEvent = false;
        break;

      default:
        // Graceful skip for unsupported events (e.g. status changes or stat changes)
        this.isAnimatingEvent = false;
        break;
    }
  }

  // ─── Animations ─────────────────────────────────────────────────────────────

  private animateHpDamage(target: "player" | "enemy", amount: number): void {
    const pkmn = target === "player" ? this.battleState.playerPokemon : this.battleState.enemyPokemon;
    // Calculate intermediate HP bounds
    const startHp = pkmn.currentHp + amount;
    const endHp = pkmn.currentHp;

    const hpTracker = { hp: startHp };

    // Flashing visual feedback on the sprite
    const sprite = target === "player" ? this.playerSprite : this.enemySprite;
    this.tweens.add({
      targets: sprite,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      repeat: 2
    });

    // Tween HP bar drain
    this.tweens.add({
      targets: hpTracker,
      hp: endHp,
      duration: 450,
      onUpdate: () => {
        // Redraw bar at current ratio
        const currentHpVal = Math.round(hpTracker.hp);
        this.updateHpBarFillOverride(target, currentHpVal, pkmn.maxHp);

        // Update player HP label text dynamically
        if (target === "player") {
          this.playerHpValueText.setText(`${currentHpVal}/${pkmn.maxHp}`);
        }
      },
      onComplete: () => {
        // Ensure exact final coordinates
        this.updateHpBarFill(target);
        if (target === "player") {
          this.playerHpValueText.setText(`${pkmn.currentHp}/${pkmn.maxHp}`);
        }
        this.time.delayedCall(200, () => {
          this.isAnimatingEvent = false;
        });
      }
    });
  }

  private animateFaint(target: "player" | "enemy"): void {
    const sprite = target === "player" ? this.playerSprite : this.enemySprite;

    // Slide down animation
    this.tweens.add({
      targets: sprite,
      y: sprite.y + 40,
      alpha: 0,
      duration: 350,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.isAnimatingEvent = false;
      }
    });
  }

  // ─── UI Layout Helpers ───────────────────────────────────────────────────────

  private runIntro(): void {
    const pSpecies = this.pokemonData.find((s) => s.id === this.battleState.playerPokemon.speciesId);
    const eSpecies = this.pokemonData.find((s) => s.id === this.battleState.enemyPokemon.speciesId);

    const pName = pSpecies?.name || "Pokémon";
    const eName = eSpecies?.name || "Pokémon";

    this.battleLogText.setVisible(true);

    if (this.battleState.isWildBattle) {
      this.eventsQueue.push({
        type: "message",
        text: `Wild ${eName} appeared!`
      });
    } else {
      const trainer = this.trainersData.find((t) => t.id === this.battleState.trainerId);
      const tName = trainer?.name || "Trainer";
      this.eventsQueue.push({
        type: "message",
        text: `${tName} wants to battle!`
      });
    }

    this.eventsQueue.push({
      type: "message",
      text: `Go, ${pName}!`
    });

    this.eventsQueue.push({
      type: "phaseChange",
      phase: "playerTurn"
    });

    this.processNextEvent();
  }

  private showMoveMenu(): void {
    this.battleLogText.setVisible(false);

    const moves = this.battleState.playerPokemon.moves;

    // Render move names
    for (let i = 0; i < 4; i++) {
      const txt = this.moveTexts[i];
      if (i < moves.length) {
        const moveData = this.movesData.find((m) => m.id === moves[i].moveId);
        txt.setText(moveData?.name || "???").setVisible(true);
      } else {
        txt.setText("-").setVisible(true);
      }
    }

    // Default cursor
    this.selectedMenuRow = 0;
    this.selectedMenuCol = 0;
    this.menuCursor.setVisible(true);
    this.movePpLabel.setVisible(true);
    this.moveTypeLabel.setVisible(true);

    if (this.battleState.isWildBattle) {
      this.runLabelText.setVisible(true);
    }

    this.updateMenuCursor();
  }

  private updateMenuCursor(): void {
    const gridStartX = 115;
    const gridStartY = 112;
    const gridColW = 60;
    const gridRowH = 20;

    const x = gridStartX + this.selectedMenuCol * gridColW - 8;
    const y = gridStartY + this.selectedMenuRow * gridRowH;

    this.menuCursor.setPosition(x, y);
    this.updateMoveStatsDisplay();
  }

  private updateMoveStatsDisplay(): void {
    const moves = this.battleState.playerPokemon.moves;
    const selectedIndex = this.selectedMenuRow * 2 + this.selectedMenuCol;

    if (selectedIndex < moves.length) {
      const battleMove = moves[selectedIndex];
      const moveDetails = this.movesData.find((m) => m.id === battleMove.moveId);
      if (moveDetails) {
        this.movePpLabel.setText(`PP: ${battleMove.currentPp}/${battleMove.maxPp}`);
        this.moveTypeLabel.setText(`TYPE: ${moveDetails.type.toUpperCase()}`);
        return;
      }
    }

    this.movePpLabel.setText("PP: --/--");
    this.moveTypeLabel.setText("TYPE: -----");
  }

  private hideMoveMenu(): void {
    this.moveTexts.forEach((t) => t.setVisible(false));
    this.menuCursor.setVisible(false);
    this.movePpLabel.setVisible(false);
    this.moveTypeLabel.setVisible(false);
    this.runLabelText.setVisible(false);
  }

  // ─── HP Bar Graphic Drawing ──────────────────────────────────────────────────

  private updateHpBarFill(target: "player" | "enemy"): void {
    const pkmn = target === "player" ? this.battleState.playerPokemon : this.battleState.enemyPokemon;
    this.updateHpBarFillOverride(target, pkmn.currentHp, pkmn.maxHp);
  }

  private updateHpBarFillOverride(target: "player" | "enemy", hp: number, maxHp: number): void {
    const barFill = target === "player" ? this.playerHpBarFill : this.enemyHpBarFill;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    barFill.clear();
    if (ratio <= 0) return;

    let color = 0x4fc84f; // green
    if (ratio <= 0.2) {
      color = 0xf85838; // red
    } else if (ratio <= 0.5) {
      color = 0xf8d020; // yellow
    }

    barFill.fillStyle(color, 1);
    barFill.fillRect(0, 0, 60 * ratio, 4);
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private createBattlePokemonFromData(species: PokemonSpecies, level: number): BattlePokemon {
    const hp = Math.floor(((2 * species.baseStats.hp + 31) * level) / 100) + level + 10;
    const stats = {
      hp,
      atk: Math.floor(((2 * species.baseStats.atk + 31) * level) / 100) + 5,
      def: Math.floor(((2 * species.baseStats.def + 31) * level) / 100) + 5,
      spAtk: Math.floor(((2 * species.baseStats.spAtk + 31) * level) / 100) + 5,
      spDef: Math.floor(((2 * species.baseStats.spDef + 31) * level) / 100) + 5,
      speed: Math.floor(((2 * species.baseStats.speed + 31) * level) / 100) + 5
    };

    const availableMoves = species.learnset.filter((m) => m.level <= level).map((m) => m.moveId);
    const uniqueMoveIds = Array.from(new Set(availableMoves)).slice(-4);

    const moves = uniqueMoveIds.map((moveId) => {
      const moveData = this.movesData.find((m) => m.id === moveId);
      const maxPp = moveData ? moveData.pp : 35;
      return {
        moveId,
        currentPp: maxPp,
        maxPp
      };
    });

    return {
      speciesId: species.id,
      level,
      currentHp: hp,
      maxHp: hp,
      stats,
      moves,
      types: species.types
    };
  }

  private getSpeciesName(speciesId: number): string {
    const species = this.pokemonData.find((s) => s.id === speciesId);
    return species ? species.name : "Pokémon";
  }
}
