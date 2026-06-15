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

interface MapExit {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  facing: Direction;
}

export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private inputCtrl!: InputController;
  private dialogueBox!: DialogueBox;
  private npcs: NPC[] = [];
  private dialogueMap = new Map<string, DialogueSequence>();
  private encounterManager!: EncounterManager;
  
  private trainerTriggers: Array<{ x: number, y: number, trainerId: string, facing: Direction }> = [];
  private mapExits: MapExit[] = [];
  private growlitheZone: { x: number, y: number, w: number, h: number } | null = null;
  
  private isTransitioning = false;
  
  private currentMap?: Phaser.Tilemaps.Tilemap;
  private groundLayer?: Phaser.Tilemaps.TilemapLayer;
  private collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  private abovePlayerLayer?: Phaser.Tilemaps.TilemapLayer;

  // From init
  private returnFromBattle = false;
  private whiteout = false;
  
  // Custom Prompts
  private isStarterMenuOpen = false;
  private isGrowlitheMenuOpen = false;
  private starterOptions = ["Mudkip", "Torchic", "Treecko"];
  private starterSelectedIndex = 0;
  private menuTextObjects: Phaser.GameObjects.Text[] = [];
  private menuCursor?: Phaser.GameObjects.Text;
  private menuBg?: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data: any): void {
    this.returnFromBattle = data?.returnFromBattle || false;
    this.whiteout = data?.whiteout || false;
    this.isTransitioning = false;
    this.isStarterMenuOpen = false;
    this.isGrowlitheMenuOpen = false;
  }

  create(): void {
    const gameState = GameStateManager.getInstance();
    
    // Initialize EncounterManager
    const encountersData = this.cache.json.get("encounters-data") as EncountersData;
    this.encounterManager = new EncounterManager(encountersData);

    this.loadDialogueData();
    this.createDialogueBox();
    
    this.inputCtrl = new InputController(this);

    // Load initial map
    this.loadMap(gameState.getState().lastMapKey);

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
      // Check for badge ceremony immediately if returning from Garnet win
      if (this.returnFromBattle && gameState.getState().lastMapKey === "garnet_gym" && gameState.getState().flags.garnetDefeated && !gameState.getState().flags.emberBadgeEarned) {
        // Wait! The badge is already earned by BattleScene!
        // We should just show the dialogue.
        // But how do we know if we JUST won?
        // We can just show it and THEN transition, but wait, if it's already earned, we don't know if we just got it.
        // Let's use a small hack for the demo: if returnFromBattle && garnetDefeated is true but we haven't set a local 'badgeShown' flag...
        // Actually, if we just won, we can set `flags.emberBadgeEarned` to false in BattleScene? No, prompt says:
        // "After garnetDefeated flag is set and BattleScene returns... Show a simple badge notification using DialogueBox... Then auto-transition: SceneTransition.fadeOut() -> reload garnet_gym map"
      }

      if (this.returnFromBattle && gameState.getState().lastMapKey === "garnet_gym") {
        // Did we just beat Garnet? If the garnet_post_battle NPC is not there but the flag is true, it means we need to refresh.
        // Wait, loadMap already handles the flag for garnet_post_battle!
        // Let's just check if the player's last defeated trainer was garnet?
        // We can just show the badge dialogue if we are returning and she was defeated. We'll add a `badgeShown` flag.
        if (gameState.getState().flags.garnetDefeated && !(gameState.getState() as any).badgeShown) {
          (gameState.getState() as any).badgeShown = true;
          this.dialogueBox.show({
            id: "badge_get",
            lines: [{ speaker: "", text: "Kael received the EMBER BADGE!" }]
          });
          // Note: update loop will intercept this finish
        }
      }

      if (this.whiteout) {
        this.dialogueBox.show({
          id: "whiteout",
          lines: [{ speaker: "", text: "Kael blacked out and scurried back to safety..." }]
        });
        this.whiteout = false;
      }
    });
  }

  private loadMap(mapKey: string): void {
    const gameState = GameStateManager.getInstance().getState();

    // Cleanup old map
    if (this.currentMap) {
      this.groundLayer?.destroy();
      this.collisionLayer?.destroy();
      this.abovePlayerLayer?.destroy();
      this.currentMap.destroy();
      this.npcs.forEach(n => n.destroy());
      this.npcs = [];
      this.player?.destroy();
      this.trainerTriggers = [];
      this.mapExits = [];
      this.growlitheZone = null;
    }

    this.encounterManager.loadTable(mapKey);

    this.currentMap = this.make.tilemap({ key: mapKey });
    const tileset = this.currentMap.addTilesetImage("procedural", "tiles");
    if (!tileset) throw new Error("Missing tileset");

    this.groundLayer = this.currentMap.createLayer("Ground", tileset, 0, 0)!;
    this.collisionLayer = this.currentMap.createLayer("Collision", tileset, 0, 0)!;
    this.collisionLayer.setCollisionByExclusion([-1, 0]);
    this.collisionLayer.setAlpha(0.0); // Hide collision
    
    this.abovePlayerLayer = this.currentMap.createLayer("AbovePlayer", tileset, 0, 0)!;
    if (this.abovePlayerLayer) {
      this.abovePlayerLayer.setDepth(10);
    }

    this.physics.world.setBounds(0, 0, this.currentMap.widthInPixels, this.currentMap.heightInPixels);

    let spawnTileX = gameState.lastPlayerTileX;
    let spawnTileY = gameState.lastPlayerTileY;
    let facing: Direction = gameState.lastPlayerFacing;

    if (!this.returnFromBattle) {
      // If there's a Spawns layer, use it (fallback)
      const spawnLayer = this.currentMap.getObjectLayer("Spawns");
      if (spawnLayer && spawnLayer.objects.length > 0) {
        const spawnObj = spawnLayer.objects[0];
        if (spawnObj.x !== undefined && spawnObj.y !== undefined) {
          spawnTileX = Math.floor(spawnObj.x / (this.currentMap.tileWidth ?? 16));
          spawnTileY = Math.floor(spawnObj.y / (this.currentMap.tileHeight ?? 16));
        }
      }
    }

    this.player = new Player(this, spawnTileX, spawnTileY);
    this.player.setMapBounds(this.currentMap.widthInPixels, this.currentMap.heightInPixels);
    this.player.setFacing(facing);
    this.player.setDepth(5);
    
    this.player.setCollisionLayer(this.collisionLayer);
    this.physics.add.collider(this.player, this.collisionLayer);

    this.player.onStepComplete = (tileX, tileY) => this.onPlayerStep(tileX, tileY);

    this.createNpcs(this.currentMap);
    this.createTrainerTriggers(this.currentMap);
    this.createMapExits(this.currentMap);

    const growlitheLayer = this.currentMap.getObjectLayer("GrowlitheZone");
    if (growlitheLayer && growlitheLayer.objects.length > 0) {
      const g = growlitheLayer.objects[0];
      this.growlitheZone = { x: g.x || 0, y: g.y || 0, w: g.width || 0, h: g.height || 0 };
      
      // Inject Growlithe NPC if not caught
      if (!GameStateManager.getInstance().getState().flags.growlitheCaught) {
         const gTileX = Math.floor((this.growlitheZone.x + 16) / 16);
         const gTileY = Math.floor((this.growlitheZone.y + 16) / 16);
         const gNpc = new NPC(this, gTileX, gTileY, "growlithe_first_encounter", 0xff8800);
         gNpc.setDepth(5);
         this.npcs.push(gNpc);
         this.player.getBlockedTiles().add(`${gTileX},${gTileY}`);
      }
    }

    this.setupCamera(this.currentMap);
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    if (this.isStarterMenuOpen) {
      this.updateStarterMenu();
      return;
    }
    
    if (this.isGrowlitheMenuOpen) {
      this.updateGrowlitheMenu();
      return;
    }

    this.dialogueBox.update(delta);

    const confirm = this.inputCtrl.getConfirmJustPressed();

    if (this.dialogueBox.isActive()) {
      if (confirm) {
        this.dialogueBox.advance();
        if (!this.dialogueBox.isActive()) {
          const currentSequence = (this.dialogueBox as any).sequence as DialogueSequence;
          this.handleDialogueComplete(currentSequence?.id);
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

  private handleDialogueComplete(dialogueId?: string): void {
    const gameState = GameStateManager.getInstance();
    const state = gameState.getState();

    if (dialogueId === "aldwyn_mirefall") {
      gameState.updateState({ flags: { ...state.flags, aldwyn_mirefall_spoken: true } });
      gameState.save();
      
      if (!state.flags.starterChosen) {
        this.openStarterMenu();
      }
    } else if (dialogueId === "pokecenter_nurse") {
      // Heal party
      const party = state.party;
      for (const p of party) {
        p.currentHp = p.maxHp;
        // Also restore PP
        for (const m of p.moves) m.currentPp = m.maxPp;
      }
      gameState.updateState({ party });
      gameState.save();
      
      // Auto trigger line 3
      this.time.delayedCall(800, () => {
        this.dialogueBox.show({
          id: "nurse_heal_done",
          lines: [{ speaker: "Nurse", text: "All better. Good luck at the gym." }]
        });
      });
    } else if (dialogueId === "growlithe_first_encounter") {
      this.openGrowlitheMenu();
    } else if (dialogueId === "garnet_pre_battle" && !state.flags.garnetDefeated) {
      this.startTrainerBattle("garnet");
    } else if (dialogueId === "badge_get") {
      // Auto-reload to garnet_gym
      this.isTransitioning = true;
      SceneTransition.fadeOut(this, 300, () => {
        this.scene.restart();
      });
    }
  }

  private openStarterMenu(): void {
    this.isStarterMenuOpen = true;
    this.starterSelectedIndex = 0;
    
    this.dialogueBox.show({
      id: "starter_prompt",
      lines: [{ speaker: "", text: "Which Pokémon will you take?" }]
    });

    const cam = this.cameras.main;
    const cx = cam.worldView.x + cam.width / 2;
    const cy = cam.worldView.y + cam.height / 2;

    this.menuBg = this.add.rectangle(cx, cy, 120, 80, 0x000000, 0.8).setDepth(20).setScrollFactor(0);
    this.menuBg.setStrokeStyle(2, 0xffffff);

    for (let i = 0; i < this.starterOptions.length; i++) {
      const txt = this.add.text(cx - 30, cy - 25 + i * 20, this.starterOptions[i], {
        fontSize: "10px", fontFamily: '"Press Start 2P"', color: "#ffffff"
      }).setDepth(21).setScrollFactor(0);
      this.menuTextObjects.push(txt);
    }

    this.menuCursor = this.add.text(cx - 45, cy - 25, "▶", {
      fontSize: "10px", fontFamily: '"Press Start 2P"', color: "#ffffff"
    }).setDepth(21).setScrollFactor(0);
  }

  private updateStarterMenu(): void {
    const up = this.inputCtrl.getDirection() === "up";
    const down = this.inputCtrl.getDirection() === "down";
    const confirm = this.inputCtrl.getConfirmJustPressed();

    if (up && this.inputCtrl.getUpJustPressed()) {
      this.starterSelectedIndex = (this.starterSelectedIndex - 1 + 3) % 3;
    } else if (down && this.inputCtrl.getDownJustPressed()) {
      this.starterSelectedIndex = (this.starterSelectedIndex + 1) % 3;
    }

    if (this.menuCursor) {
      this.menuCursor.y = this.menuTextObjects[0].y + this.starterSelectedIndex * 20;
    }

    if (confirm) {
      this.isStarterMenuOpen = false;
      
      this.menuBg?.destroy();
      this.menuCursor?.destroy();
      this.menuTextObjects.forEach(t => t.destroy());
      this.menuTextObjects = [];

      const choice = this.starterOptions[this.starterSelectedIndex];
      
      // Grant starter
      const pokemonJson = this.cache.json.get("pokemon-data") as PokemonSpecies[];
      const movesJson = this.cache.json.get("moves-data") as Move[];
      
      let speciesId = 1;
      let startMoves = ["tackle", "water-gun"];
      if (choice === "Mudkip") { speciesId = 1; startMoves = ["tackle", "water-gun"]; }
      if (choice === "Torchic") { speciesId = 2; startMoves = ["scratch", "ember"]; }
      if (choice === "Treecko") { speciesId = 3; startMoves = ["scratch", "absorb"]; }

      const species = pokemonJson.find(s => s.id === speciesId)!;
      const starter = createBattlePokemon(species, movesJson, 5);
      
      // Override moves
      starter.moves = startMoves.map(mid => {
        const mdata = movesJson.find(m => m.id === mid)!;
        return { moveId: mid, name: mdata.name, currentPp: mdata.pp, maxPp: mdata.pp };
      });

      const gameState = GameStateManager.getInstance();
      const state = gameState.getState();
      gameState.updateState({ 
        party: [...state.party, starter],
        flags: { ...state.flags, starterChosen: true, starterSpeciesId: speciesId } 
      });
      gameState.save();

      this.dialogueBox.show({
        id: "starter_chosen",
        lines: [{ speaker: "", text: `${choice} chose you.` }]
      });
    }
  }

  private openGrowlitheMenu(): void {
    this.isGrowlitheMenuOpen = true;
    this.starterSelectedIndex = 0;
    this.starterOptions = ["YES", "NO"];
    
    this.dialogueBox.show({
      id: "growlithe_prompt",
      lines: [{ speaker: "", text: "Approach carefully?" }]
    });

    const cam = this.cameras.main;
    const cx = cam.worldView.x + cam.width / 2;
    const cy = cam.worldView.y + cam.height / 2;

    this.menuBg = this.add.rectangle(cx, cy, 80, 60, 0x000000, 0.8).setDepth(20).setScrollFactor(0);
    this.menuBg.setStrokeStyle(2, 0xffffff);

    for (let i = 0; i < this.starterOptions.length; i++) {
      const txt = this.add.text(cx - 20, cy - 15 + i * 20, this.starterOptions[i], {
        fontSize: "10px", fontFamily: '"Press Start 2P"', color: "#ffffff"
      }).setDepth(21).setScrollFactor(0);
      this.menuTextObjects.push(txt);
    }

    this.menuCursor = this.add.text(cx - 35, cy - 15, "▶", {
      fontSize: "10px", fontFamily: '"Press Start 2P"', color: "#ffffff"
    }).setDepth(21).setScrollFactor(0);
  }

  private updateGrowlitheMenu(): void {
    const up = this.inputCtrl.getDirection() === "up";
    const down = this.inputCtrl.getDirection() === "down";
    const confirm = this.inputCtrl.getConfirmJustPressed();

    if (up && this.inputCtrl.getUpJustPressed()) {
      this.starterSelectedIndex = (this.starterSelectedIndex - 1 + 2) % 2;
    } else if (down && this.inputCtrl.getDownJustPressed()) {
      this.starterSelectedIndex = (this.starterSelectedIndex + 1) % 2;
    }

    if (this.menuCursor) {
      this.menuCursor.y = this.menuTextObjects[0].y + this.starterSelectedIndex * 20;
    }

    if (confirm) {
      this.isGrowlitheMenuOpen = false;
      this.menuBg?.destroy();
      this.menuCursor?.destroy();
      this.menuTextObjects.forEach(t => t.destroy());
      this.menuTextObjects = [];

      const choice = this.starterOptions[this.starterSelectedIndex];
      if (choice === "YES") {
        const pokemonJson = this.cache.json.get("pokemon-data") as PokemonSpecies[];
        const movesJson = this.cache.json.get("moves-data") as Move[];
        const growlitheSp = pokemonJson.find(s => s.id === 6)!;
        const growlithe = createBattlePokemon(growlitheSp, movesJson, 5);

        const gameState = GameStateManager.getInstance();
        const state = gameState.getState();
        gameState.updateState({ 
          party: [...state.party, growlithe],
          flags: { ...state.flags, growlitheCaught: true } 
        });
        gameState.save();

        this.dialogueBox.show({
          id: "growlithe_caught",
          lines: [{ speaker: "", text: "The Growlithe sniffs your hand. It seems to remember something." }]
        });
        
        // Remove NPC
        const gNpc = this.npcs.find(n => n.getDialogueId() === "growlithe_first_encounter");
        if (gNpc) {
          gNpc.destroy();
          this.npcs = this.npcs.filter(n => n !== gNpc);
          this.player.getBlockedTiles().delete(`${gNpc.tileX},${gNpc.tileY}`);
        }
      } else {
        this.dialogueBox.show({
          id: "growlithe_declined",
          lines: [{ speaker: "", text: "You step back. Maybe next time." }]
        });
      }
    }
  }

  private loadDialogueData(): void {
    this.dialogueMap.clear();
    const rawNpcs: unknown = this.cache.json.get("dialogue-npcs");
    if (Array.isArray(rawNpcs)) {
      for (const entry of rawNpcs as DialogueSequence[]) this.dialogueMap.set(entry.id, entry);
    }
    const rawStory: unknown = this.cache.json.get("story-dialogue");
    // Object format for story_dialogue
    if (rawStory && typeof rawStory === 'object' && !Array.isArray(rawStory)) {
       for (const [id, lines] of Object.entries(rawStory)) {
         this.dialogueMap.set(id, { id, lines } as DialogueSequence);
       }
    }
  }

  private createNpcs(map: Phaser.Tilemaps.Tilemap): void {
    const npcLayer = map.getObjectLayer("NPCs");
    if (!npcLayer) return;

    const tints = [0x44ccff, 0xff8844, 0x88ff44];
    let tintIndex = 0;
    const blockedTiles = new Set<string>();
    
    const state = GameStateManager.getInstance().getState();

    for (const obj of npcLayer.objects) {
      if (obj.x === undefined || obj.y === undefined) continue;

      const tileX = Math.floor(obj.x / (map.tileWidth ?? 16));
      const tileY = Math.floor(obj.y / (map.tileHeight ?? 16));

      let dialogueId = this.getTiledProperty<string>(obj, "dialogueId");
      if (!dialogueId) continue;
      
      // Dynamic dialogue overrides
      if (dialogueId === "aldwyn_mirefall" && state.flags.aldwyn_mirefall_spoken) {
        dialogueId = "aldwyn_mirefall_repeat";
      }
      if (dialogueId === "gym_gate_guard" && !state.flags.starterChosen) {
        dialogueId = "gym_gate_guard_block";
      }
      if (dialogueId === "garnet_pre_battle" && state.flags.garnetDefeated) {
        dialogueId = "garnet_post_battle";
      }

      const tint = tints[tintIndex % tints.length] ?? 0xffffff;
      tintIndex++;

      const npc = new NPC(this, tileX, tileY, dialogueId, tint);
      npc.setDepth(5);
      
      if (dialogueId === "sable_mirefall" && state.flags.starterChosen) {
        npc.destroy();
        continue;
      }
      
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

  private createMapExits(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer("MapExits");
    if (!layer) return;

    for (const obj of layer.objects) {
      if (obj.x === undefined || obj.y === undefined) continue;
      const tileX = Math.floor(obj.x / (map.tileWidth ?? 16));
      const tileY = Math.floor(obj.y / (map.tileHeight ?? 16));
      
      const targetMap = this.getTiledProperty<string>(obj, "targetMap");
      const targetX = this.getTiledProperty<number>(obj, "targetX");
      const targetY = this.getTiledProperty<number>(obj, "targetY");
      const facing = this.getTiledProperty<Direction>(obj, "facing");

      if (targetMap && targetX !== undefined && targetY !== undefined && facing) {
        this.mapExits.push({ x: tileX, y: tileY, targetMap, targetX, targetY, facing });
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
    cam.startFollow(this.player, true, 1, 1);
  }

  private tryInteractNpc(): void {
    const facing = this.player.getFacing();
    const playerTileX = Math.round((this.player.x - TILE_SIZE / 2) / TILE_SIZE);
    const playerTileY = Math.round((this.player.y - TILE_SIZE / 2) / TILE_SIZE);

    const targetTileX = playerTileX + (facing === "left" ? -1 : facing === "right" ? 1 : 0);
    const targetTileY = playerTileY + (facing === "up" ? -1 : facing === "down" ? 1 : 0);

    const npc = this.npcs.find((n) => n.tileX === targetTileX && n.tileY === targetTileY);
    if (!npc) return;

    const dialogueId = npc.getDialogueId();
    if (dialogueId === "gym_gate_guard_block") {
      // Gate guard logic handled above
    }
    const sequence = npc.getDialogue(this.dialogueMap);
    if (!sequence) return;

    this.dialogueBox.show(sequence);
  }

  private onPlayerStep(tileX: number, tileY: number): void {
    if (this.isTransitioning) return;

    // Check MapExits
    const exit = this.mapExits.find(e => e.x === tileX && e.y === tileY);
    if (exit) {
      this.isTransitioning = true;
      const gameState = GameStateManager.getInstance();
      
      if (exit.targetMap === "garnet_gym" && !gameState.getState().flags.starterChosen) {
        this.isTransitioning = false;
        return; 
      }

      gameState.updateState({
        lastMapKey: exit.targetMap,
        lastPlayerTileX: exit.targetX,
        lastPlayerTileY: exit.targetY,
        lastPlayerFacing: exit.facing
      });
      gameState.save();
      
      SceneTransition.fadeOut(this, 300, () => {
        this.scene.restart();
      });
      return;
    }

    if (this.groundLayer) {
      const tile = this.groundLayer.getTileAt(tileX, tileY);
      if (tile) {
        const encounter = this.encounterManager.onPlayerStep(tile.index);
        if (encounter) {
          this.startWildBattle(encounter.speciesId, encounter.level);
          return;
        }
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
      lastMapKey: gameState.getState().lastMapKey,
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
