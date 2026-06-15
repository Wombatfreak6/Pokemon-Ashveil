import { GameStateManager } from "./GameStateManager";

export interface EncounterResult {
  speciesId: number;
  level: number;
}

interface EncounterPokemonData {
  speciesId: number;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

interface EncounterTable {
  mapKey: string;
  grassTileIds: number[];
  encounterRate: number;
  pokemon: EncounterPokemonData[];
}

export interface EncountersData {
  tables: EncounterTable[];
}

export class EncounterManager {
  private tables: EncounterTable[] = [];
  private activeTable: EncounterTable | null = null;

  constructor(data: EncountersData) {
    this.tables = data.tables;
  }

  public loadTable(mapKey: string): void {
    const table = this.tables.find((t) => t.mapKey === mapKey);
    this.activeTable = table || null;
  }

  public onPlayerStep(tileId: number): EncounterResult | null {
    if (!this.activeTable) return null;

    // Check if the current tile is an encounter tile (grass)
    if (!this.activeTable.grassTileIds.includes(tileId)) {
      return null;
    }

    const gameState = GameStateManager.getInstance();
    const currentState = gameState.getState();
    const newStepCount = currentState.stepCount + 1;
    gameState.updateState({ stepCount: newStepCount });

    // Check encounter rate
    if (newStepCount % this.activeTable.encounterRate === 0) {
      // 40% chance per check
      if (Math.random() < 0.4) {
        return this.rollEncounter();
      }
    }

    return null;
  }

  private rollEncounter(): EncounterResult | null {
    if (!this.activeTable || this.activeTable.pokemon.length === 0) return null;

    const totalWeight = this.activeTable.pokemon.reduce(
      (sum, p) => sum + p.weight,
      0
    );
    let roll = Math.random() * totalWeight;

    for (const p of this.activeTable.pokemon) {
      roll -= p.weight;
      if (roll <= 0) {
        return {
          speciesId: p.speciesId,
          level: this.getRandomLevel(p.minLevel, p.maxLevel),
        };
      }
    }

    // Fallback in case of rounding errors
    const lastP = this.activeTable.pokemon[this.activeTable.pokemon.length - 1];
    return {
      speciesId: lastP.speciesId,
      level: this.getRandomLevel(lastP.minLevel, lastP.maxLevel),
    };
  }

  private getRandomLevel(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
