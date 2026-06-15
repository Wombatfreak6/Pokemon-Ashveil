import type { BattlePokemon } from "@systems/BattleTypes";

export interface GameState {
  playerName: string;
  party: BattlePokemon[];
  flags: {
    starterChosen: boolean;
    starterSpeciesId: number | null;
    growlitheCaught: boolean;
    garnetDefeated: boolean;
    emberBadgeEarned: boolean;
    aldwynMet: boolean;
    mirefall_intro_seen: boolean;
    route2_unlocked: boolean;
    cinderpeak_unlocked: boolean;
  };
  lastMapKey: string;
  lastPlayerTileX: number;
  lastPlayerTileY: number;
  lastPlayerFacing: "up" | "down" | "left" | "right";
  defeatedTrainers: string[];
  stepCount: number;
  playTimeSeconds: number;
  lastSaveTimestamp: number;
}

const DEFAULT_STATE: GameState = {
  playerName: "Kael",
  party: [],
  flags: {
    starterChosen: false,
    starterSpeciesId: null,
    growlitheCaught: false,
    garnetDefeated: false,
    emberBadgeEarned: false,
    aldwynMet: false,
    mirefall_intro_seen: false,
    route2_unlocked: false,
    cinderpeak_unlocked: false,
  },
  lastMapKey: "test-map",
  lastPlayerTileX: 9,
  lastPlayerTileY: 9,
  lastPlayerFacing: "down",
  defeatedTrainers: [],
  stepCount: 0,
  playTimeSeconds: 0,
  lastSaveTimestamp: 0,
};

const SAVE_KEY = "ashveil_save";

/**
 * Single source of truth for persistent game data.
 * Pure TypeScript (no Phaser imports) to ensure easy serialization.
 */
export class GameStateManager {
  private static instance: GameStateManager;
  private state: GameState;

  private constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)) as GameState;
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  public getState(): GameState {
    return this.state;
  }

  public updateState(partial: Partial<GameState> & { flags?: Partial<GameState["flags"]> }): void {
    // Merge partial state. For flags, we also merge deeply.
    if (partial.flags) {
      this.state.flags = { ...this.state.flags, ...partial.flags };
    }
    
    // Copy remaining top-level properties
    for (const key in partial) {
      if (key !== "flags" && partial.hasOwnProperty(key)) {
        // @ts-ignore - dynamic key assignment
        this.state[key] = partial[key];
      }
    }
  }

  public save(): void {
    this.state.lastSaveTimestamp = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Failed to save to localStorage", e);
    }
  }

  public load(): boolean {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        // Merge with default state to pick up any new schema fields
        this.state = {
          ...DEFAULT_STATE,
          ...parsed,
          flags: {
            ...DEFAULT_STATE.flags,
            ...(parsed.flags || {})
          }
        };
        return true;
      }
    } catch (e) {
      console.warn("Failed to load from localStorage", e);
    }
    return false;
  }

  public deleteSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn("Failed to clear localStorage", e);
    }
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)) as GameState;
  }

  public hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  public addDefeatedTrainer(id: string): void {
    if (!this.state.defeatedTrainers.includes(id)) {
      this.state.defeatedTrainers.push(id);
    }
  }

  public isTrainerDefeated(id: string): boolean {
    return this.state.defeatedTrainers.includes(id);
  }

  public addToParty(pokemon: BattlePokemon): boolean {
    if (this.state.party.length >= 6) {
      return false;
    }
    this.state.party.push(pokemon);
    return true;
  }

  public updatePartyMember(index: number, partial: Partial<BattlePokemon>): void {
    if (index >= 0 && index < this.state.party.length) {
      const member = this.state.party[index];
      if (member) {
        this.state.party[index] = { ...member, ...partial };
      }
    }
  }
}
