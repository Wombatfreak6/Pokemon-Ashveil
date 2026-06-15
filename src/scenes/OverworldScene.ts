import Phaser from "phaser";
import { Player, TILE_SIZE } from "@entities/Player";
import { NPC } from "@entities/NPC";
import { InputController, type Direction } from "@systems/InputController";
import { DialogueBox } from "@systems/DialogueBox";
import type { DialogueSequence } from "@systems/DialogueTypes";
import { GameStateManager } from "@systems/GameStateManager";
import { EncounterManager, type EncountersData } from "@systems/EncounterManager";
import { SceneTransition } from "@systems/SceneTransition";
import { createBattlePokemon } from "@systems/BattleEngine";
import type { PokemonSpecies, Move } from "@systems/BattleTypes";

export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private inputCtrl!: InputController;
  private dialogueBox!: DialogueBox;
  private npcs: NPC[] = [];
  private dialogueMap = new Map<string, DialogueSequence>();
  private encounterManager!: EncounterManager;
  
  private trainerTriggers: Array<{ x: number, y: number, trainerId: string, facing: Direction }> = [];
  
  private isTransitioning = false;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;

  // From init
  private returnFromBattle = false;
  private whiteout = false;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data: any): void {
    this.returnFromBattle = data?.returnFromBattle || false;
    this.whiteout = data?.whiteout || false;
    this.isTransitioning = false;
  }

  create(): void {
    const gameState = GameStateManager.getInstance();
    
    // Initialize EncounterManager
    const encountersData = this.cache.json.get("encounters-data") as EncountersData;
    this.encounterManager = new EncounterManager(encountersData);
    this.encounterManager.loadTable(gameState.getState().lastMapKey);

    this.loadDialogueData();
    const map = this.createTilemap();
    this.createPlayer(map);
    this.createNpcs(map);
    this.createTrainerTriggers(map);
    this.createDialogueBox();
    this.setupCamera(map);

    // Playtime tracking
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const state = gameState.getState();
        gameState.updateState({ playTimeSeconds: state.playTimeSeconds + 1 });
      }
    });

    // Fade in
    SceneTransition.fadeIn(this, 300, () => {
      if (this.whiteout) {
        this.dialogueBox.show({
          id: "whiteout",
          lines: [{ speaker: "", text: "Kael blacked out and scurried back to safety..." }]
        });
        this.whiteout = false;
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    this.dialogueBox.update(delta);

    const confirm = this.inputCtrl.getConfirmJustPressed();

    if (this.dialogueBox.isActive()) {
      if (confirm) {
        this.dialogueBox.advance();
        if (!this.dialogueBox.isActive()) {
          // Check if aldwyn dialogue just finished
          const currentSequence = (this.dialogueBox as any).sequence as DialogueSequence;
          if (currentSequence?.id === "aldwyn") {
            const gameState = GameStateManager.getInstance();
            if (!gameState.getState().flags.aldwynMet) {
              gameState.updateState({ flags: { aldwynMet: true } as any });
              gameState.save();
            }
          }
        }
      }
      return;
    }

    const direction = this.inputCtrl.getDirection();
    this.player.handleInput(direction);

    if (confirm) {
      this.tryInteractNpc();
    }
  }

  private loadDialogueData(): void {
    const raw: unknown = this.cache.json.get("dialogue-npcs");
    if (!Array.isArray(raw)) return;
    for (const entry of raw as DialogueSequence[]) {
      this.dialogueMap.set(entry.id, entry);
    }
  }

  private createTilemap(): Phaser.Tilemaps.Tilemap {
    const map = this.make.tilemap({ key: "test-map" });
    const tileset = map.addTilesetImage("placeholder_tiles", "tiles");
    if (!tileset) throw new Error("Missing tileset");

    this.groundLayer = map.createLayer("Ground", tileset, 0, 0)!;
    const collisionLayer = map.createLayer("Collision", tileset, 0, 0)!;
    collisionLayer.setCollisionByExclusion([-1]);
    collisionLayer.setAlpha(0.35);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    return map;
  }

  private createPlayer(map: Phaser.Tilemaps.Tilemap): void {
    const gameState = GameStateManager.getInstance().getState();

    let spawnTileX = 3;
    let spawnTileY = 3;
    let facing: Direction = "down";

    if (this.returnFromBattle && gameState.lastMapKey === "test-map") {
      spawnTileX = gameState.lastPlayerTileX;
      spawnTileY = gameState.lastPlayerTileY;
      facing = gameState.lastPlayerFacing;
    } else {
      const objectLayer = map.getObjectLayer("Spawns");
      if (objectLayer) {
        const spawnObj = objectLayer.objects.find((obj) => obj.name === "PlayerSpawn");
        if (spawnObj && spawnObj.x !== undefined && spawnObj.y !== undefined) {
          spawnTileX = Math.floor(spawnObj.x / (map.tileWidth ?? 16));
          spawnTileY = Math.floor(spawnObj.y / (map.tileHeight ?? 16));
        }
      }
    }

    this.player = new Player(this, spawnTileX, spawnTileY);
    this.player.setMapBounds(map.widthInPixels, map.heightInPixels);
    this.player.setFacing(facing);

    const collisionLayer = map.getLayer("Collision")?.tilemapLayer;
    if (collisionLayer) {
      this.player.setCollisionLayer(collisionLayer);
      this.physics.add.collider(this.player, collisionLayer);
    }

    this.inputCtrl = new InputController(this);

    // Wire up step complete handler
    this.player.onStepComplete = (tileX, tileY) => this.onPlayerStep(tileX, tileY);
  }

  private createNpcs(map: Phaser.Tilemaps.Tilemap): void {
    const npcLayer = map.getObjectLayer("NPCs");
    if (!npcLayer) return;

    const tints = [0x44ccff, 0xff8844, 0x88ff44];
    let tintIndex = 0;
    const blockedTiles = new Set<string>();

    for (const obj of npcLayer.objects) {
      if (obj.x === undefined || obj.y === undefined) continue;

      const tileX = Math.floor(obj.x / (map.tileWidth ?? 16));
      const tileY = Math.floor(obj.y / (map.tileHeight ?? 16));

      const dialogueId = this.getTiledProperty<string>(obj, "dialogueId");
      if (!dialogueId) continue;

      const tint = tints[tintIndex % tints.length] ?? 0xffffff;
      tintIndex++;

      const npc = new NPC(this, tileX, tileY, dialogueId, tint);
      this.npcs.push(npc);
      blockedTiles.add(`${tileX},${tileY}`);
    }

    if (this.player) {
      this.player.setBlockedTiles(blockedTiles);
    }
  }

  private createTrainerTriggers(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer("TrainerTriggers");
    if (!layer) return;

    for (const obj of layer.objects) {
      if (obj.x === undefined || obj.y === undefined) continue;
      const tileX = Math.floor(obj.x / (map.tileWidth ?? 16));
      const tileY = Math.floor(obj.y / (map.tileHeight ?? 16));
      
      const trainerId = this.getTiledProperty<string>(obj, "trainerId");
      const facing = this.getTiledProperty<Direction>(obj, "facing");

      if (trainerId && facing) {
        this.trainerTriggers.push({ x: tileX, y: tileY, trainerId, facing });
      }
    }
  }

  private createDialogueBox(): void {
    this.dialogueBox = new DialogueBox(this);
  }

  private setupCamera(map: Phaser.Tilemaps.Tilemap): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true, 0.08, 0.08);
  }

  private tryInteractNpc(): void {
    const facing = this.player.getFacing();
    const playerTileX = Math.round((this.player.x - TILE_SIZE / 2) / TILE_SIZE);
    const playerTileY = Math.round((this.player.y - TILE_SIZE / 2) / TILE_SIZE);

    const targetTileX = playerTileX + (facing === "left" ? -1 : facing === "right" ? 1 : 0);
    const targetTileY = playerTileY + (facing === "up" ? -1 : facing === "down" ? 1 : 0);

    const npc = this.npcs.find((n) => n.tileX === targetTileX && n.tileY === targetTileY);
    if (!npc) return;

    const sequence = npc.getDialogue(this.dialogueMap);
    if (!sequence) return;

    this.dialogueBox.show(sequence);
  }

  private onPlayerStep(tileX: number, tileY: number): void {
    if (this.isTransitioning) return;

    const tile = this.groundLayer.getTileAt(tileX, tileY);
    if (tile) {
      const encounter = this.encounterManager.onPlayerStep(tile.index);
      if (encounter) {
        this.startWildBattle(encounter.speciesId, encounter.level);
        return;
      }
    }

    this.checkTrainerLineOfSight(tileX, tileY);
  }

  private checkTrainerLineOfSight(playerX: number, playerY: number): void {
    const gameState = GameStateManager.getInstance();

    for (const t of this.trainerTriggers) {
      if (gameState.isTrainerDefeated(t.trainerId)) continue;

      let inSight = false;
      
      if (t.facing === "down" && playerX === t.x && playerY > t.y && playerY <= t.y + 3) inSight = true;
      if (t.facing === "up" && playerX === t.x && playerY < t.y && playerY >= t.y - 3) inSight = true;
      if (t.facing === "right" && playerY === t.y && playerX > t.x && playerX <= t.x + 3) inSight = true;
      if (t.facing === "left" && playerY === t.y && playerX < t.x && playerX >= t.x - 3) inSight = true;

      if (inSight) {
        this.startTrainerBattle(t.trainerId);
        return;
      }
    }
  }

  private saveMapStateBeforeBattle(): void {
    const gameState = GameStateManager.getInstance();
    const playerTileX = Math.round((this.player.x - TILE_SIZE / 2) / TILE_SIZE);
    const playerTileY = Math.round((this.player.y - TILE_SIZE / 2) / TILE_SIZE);
    
    // Ensure player has at least one valid party member for battle if they don't already
    let party = gameState.getState().party;
    if (party.length === 0) {
      const pokemonJson = this.cache.json.get("pokemon-data") as PokemonSpecies[];
      const movesJson = this.cache.json.get("moves-data") as Move[];
      const mudkip = pokemonJson.find((s) => s.id === 1)!;
      party = [createBattlePokemon(mudkip, movesJson, 10)];
    }

    gameState.updateState({
      lastMapKey: "test-map",
      lastPlayerTileX: playerTileX,
      lastPlayerTileY: playerTileY,
      lastPlayerFacing: this.player.getFacing(),
      party: party
    });
  }

  private startWildBattle(speciesId: number, level: number): void {
    this.isTransitioning = true;
    this.saveMapStateBeforeBattle();
    const gameState = GameStateManager.getInstance().getState();

    SceneTransition.fadeOut(this, 300, () => {
      this.scene.start("BattleScene", {
        isWildBattle: true,
        wildSpeciesId: speciesId,
        wildLevel: level,
        playerParty: gameState.party
      });
    });
  }

  private startTrainerBattle(trainerId: string): void {
    this.isTransitioning = true;
    this.saveMapStateBeforeBattle();
    const gameState = GameStateManager.getInstance().getState();

    SceneTransition.fadeOut(this, 300, () => {
      this.scene.start("BattleScene", {
        isWildBattle: false,
        trainerId: trainerId,
        playerParty: gameState.party
      });
    });
  }

  private getTiledProperty<T>(obj: Phaser.Types.Tilemaps.TiledObject, name: string): T | undefined {
    if (!obj.properties) return undefined;
    const prop = (obj.properties as Array<{ name: string; value: unknown }>).find((p) => p.name === name);
    return prop?.value as T | undefined;
  }
}

