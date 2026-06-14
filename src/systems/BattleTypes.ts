/**
 * BattleTypes.ts — type definitions and interfaces for the Pokémon Ashveil battle system.
 */

export interface BattleMove {
  moveId: string;
  currentPp: number;
  maxPp: number;
}

export interface BattlePokemon {
  speciesId: number;
  nickname?: string;
  level: number;
  currentHp: number;
  maxHp: number;
  stats: {
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  moves: BattleMove[];
  types: string[];
  status?: "poison" | "burn" | "sleep" | "paralysis" | null;
}

export interface BattleState {
  phase: "intro" | "playerTurn" | "enemyTurn" | "animating" | "victory" | "defeat" | "fled";
  playerPokemon: BattlePokemon;
  enemyPokemon: BattlePokemon;
  isWildBattle: boolean;
  trainerId?: string;
  turn: number;
}

export type BattleEvent =
  | { type: "message"; text: string }
  | { type: "damage"; target: "player" | "enemy"; amount: number }
  | { type: "heal"; target: "player" | "enemy"; amount: number }
  | { type: "faint"; target: "player" | "enemy" }
  | { type: "phaseChange"; phase: BattleState["phase"] }
  | { type: "statChange"; target: "player" | "enemy"; stat: string; stages: number };

// ─── JSON Data Schemas ────────────────────────────────────────────────────────

export interface PokemonSpecies {
  id: number;
  name: string;
  types: string[];
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  learnset: Array<{
    level: number;
    moveId: string;
  }>;
  baseExp: number;
  evolvesTo?: string;
  evolvesAtLevel?: number;
}

export interface Move {
  id: string;
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  recoil?: number;
}

export interface TrainerPokemon {
  speciesId: number;
  level: number;
  moves: string[];
}

export interface Trainer {
  id: string;
  name: string;
  isGymLeader: boolean;
  badge?: string;
  party: TrainerPokemon[];
  defeatDialogue: string;
  winDialogue: string;
}
