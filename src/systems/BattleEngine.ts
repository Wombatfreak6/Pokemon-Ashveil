import type {
  BattlePokemon,
  BattleMove,
  BattleState,
  BattleEvent,
  PokemonSpecies,
  Move
} from "./BattleTypes";

/**
 * calculateStats — Simplified Gen 3 stat formula without EVs/IVs (IVs assumed to be 31).
 */
export function calculateStats(
  species: PokemonSpecies,
  level: number
): { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number } {
  const hp = Math.floor(((2 * species.baseStats.hp + 31) * level) / 100) + level + 10;
  const atk = Math.floor(((2 * species.baseStats.atk + 31) * level) / 100) + 5;
  const def = Math.floor(((2 * species.baseStats.def + 31) * level) / 100) + 5;
  const spAtk = Math.floor(((2 * species.baseStats.spAtk + 31) * level) / 100) + 5;
  const spDef = Math.floor(((2 * species.baseStats.spDef + 31) * level) / 100) + 5;
  const speed = Math.floor(((2 * species.baseStats.speed + 31) * level) / 100) + 5;

  return { hp, atk, def, spAtk, spDef, speed };
}

/**
 * createBattlePokemon — Instantiates a BattlePokemon from a species definition and level.
 */
export function createBattlePokemon(
  species: PokemonSpecies,
  movesData: Move[],
  level: number
): BattlePokemon {
  const stats = calculateStats(species, level);

  // Get moves from learnset up to this level
  const availableMoves = species.learnset
    .filter((m) => m.level <= level)
    .map((m) => m.moveId);

  // Take unique move IDs, and select up to the last 4
  const uniqueMoveIds = Array.from(new Set(availableMoves)).slice(-4);

  const moves: BattleMove[] = uniqueMoveIds.map((moveId) => {
    const moveData = movesData.find((m) => m.id === moveId);
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
    currentHp: stats.hp,
    maxHp: stats.hp,
    stats,
    moves,
    types: species.types
  };
}

/**
 * getTypeEffectiveness — Multiplies effectiveness values for all defender types.
 */
export function getTypeEffectiveness(
  moveType: string,
  defenderTypes: string[],
  typeChart: Record<string, Record<string, number>>
): number {
  let multiplier = 1;
  const chartRow = typeChart[moveType];
  if (!chartRow) return multiplier;

  for (const defType of defenderTypes) {
    if (chartRow[defType] !== undefined) {
      multiplier *= chartRow[defType];
    }
  }

  return multiplier;
}

/**
 * calculateDamage — Gen 1/2 damage formula with Gen 3 Special/Physical splits.
 */
export function calculateDamage(
  attacker: BattlePokemon,
  move: Move,
  defender: BattlePokemon,
  typeChart: Record<string, Record<string, number>>
): { damage: number; effectiveness: number; isStab: boolean } {
  if (move.category === "Status") {
    return { damage: 0, effectiveness: 1, isStab: false };
  }

  // Determine attack and defense stats depending on Physical vs Special category
  let atkVal = 1;
  let defVal = 1;

  if (move.category === "Physical") {
    atkVal = attacker.stats.atk;
    defVal = defender.stats.def;
  } else {
    atkVal = attacker.stats.spAtk;
    defVal = defender.stats.spDef;
  }

  // Gen 1/2 Base formula
  const levelPart = Math.floor((2 * attacker.level) / 5 + 2);
  const baseDamage = Math.floor((levelPart * move.power * atkVal) / defVal / 50) + 2;

  // STAB modifier
  const isStab = attacker.types.includes(move.type);
  const stabMultiplier = isStab ? 1.5 : 1.0;

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defender.types, typeChart);

  // Random factor between 0.85 and 1.00
  const randomFactor = 0.85 + Math.random() * 0.15;

  const damage = Math.floor(baseDamage * stabMultiplier * effectiveness * randomFactor);

  return {
    damage: Math.max(1, damage), // at least 1 damage
    effectiveness,
    isStab
  };
}

/**
 * expFormula — Calculate experience gain.
 */
export function calculateExpGain(
  isWildBattle: boolean,
  enemyBaseExp: number,
  enemyLevel: number
): number {
  const a = isWildBattle ? 1.0 : 1.5;
  return Math.floor((a * enemyBaseExp * enemyLevel) / 7);
}

/**
 * resolveTurn — Simulates a single round of turn-based combat.
 */
export function resolveTurn(
  state: BattleState,
  playerMoveId: string,
  pokemonData: PokemonSpecies[],
  movesData: Move[],
  typeChart: Record<string, Record<string, number>>
): { newState: BattleState; events: BattleEvent[] } {
  // Clone the state to keep the function pure
  const newState: BattleState = JSON.parse(JSON.stringify(state));
  const events: BattleEvent[] = [];

  const playerPokemon = newState.playerPokemon;
  const enemyPokemon = newState.enemyPokemon;

  const playerSpecies = pokemonData.find((s) => s.id === playerPokemon.speciesId);
  const enemySpecies = pokemonData.find((s) => s.id === enemyPokemon.speciesId);

  const playerName = playerSpecies?.name || "Player's Pokémon";
  const enemyName = (newState.isWildBattle ? "Wild " : "") + (enemySpecies?.name || "Enemy Pokémon");

  // 1. Choose enemy move
  // Filter enemy moves that have PP left, or fallback to first move
  const availableEnemyMoves = enemyPokemon.moves.filter((m) => m.currentPp > 0);
  const enemyMoveId =
    availableEnemyMoves.length > 0
      ? availableEnemyMoves[Math.floor(Math.random() * availableEnemyMoves.length)].moveId
      : enemyPokemon.moves[0].moveId;

  // 2. Fetch move data
  const playerMove = movesData.find((m) => m.id === playerMoveId);
  const enemyMove = movesData.find((m) => m.id === enemyMoveId);

  if (!playerMove || !enemyMove) {
    throw new Error("BattleEngine: Could not find move details in movesData.");
  }

  // 3. Determine turn order
  let playerFirst = true;

  if (playerMove.priority > enemyMove.priority) {
    playerFirst = true;
  } else if (enemyMove.priority > playerMove.priority) {
    playerFirst = false;
  } else {
    // Priority is tied -> compare speeds
    if (playerPokemon.stats.speed > enemyPokemon.stats.speed) {
      playerFirst = true;
    } else if (enemyPokemon.stats.speed > playerPokemon.stats.speed) {
      playerFirst = false;
    } else {
      // Speeds are tied -> random
      playerFirst = Math.random() < 0.5;
    }
  }

  const turnOrder = playerFirst
    ? [
        {
          attacker: playerPokemon,
          defender: enemyPokemon,
          move: playerMove,
          attackerRole: "player" as const,
          defenderRole: "enemy" as const,
          attackerName: playerName,
          defenderName: enemyName
        },
        {
          attacker: enemyPokemon,
          defender: playerPokemon,
          move: enemyMove,
          attackerRole: "enemy" as const,
          defenderRole: "player" as const,
          attackerName: enemyName,
          defenderName: playerName
        }
      ]
    : [
        {
          attacker: enemyPokemon,
          defender: playerPokemon,
          move: enemyMove,
          attackerRole: "enemy" as const,
          defenderRole: "player" as const,
          attackerName: enemyName,
          defenderName: playerName
        },
        {
          attacker: playerPokemon,
          defender: enemyPokemon,
          move: playerMove,
          attackerRole: "player" as const,
          defenderRole: "enemy" as const,
          attackerName: playerName,
          defenderName: enemyName
        }
      ];

  // Increment turn count
  newState.turn += 1;

  // 4. Execute moves
  for (const step of turnOrder) {
    // Stop immediately if either Pokémon is fainted
    if (playerPokemon.currentHp <= 0 || enemyPokemon.currentHp <= 0) {
      break;
    }

    const { attacker, defender, move, attackerRole, defenderRole, attackerName, defenderName } = step;

    // Deduct PP from attacker's move instance
    const battleMove = attacker.moves.find((m) => m.moveId === move.id);
    if (battleMove) {
      battleMove.currentPp = Math.max(0, battleMove.currentPp - 1);
    }

    // Event: Attacker uses move
    events.push({
      type: "message",
      text: `${attackerName} used ${move.name}!`
    });

    // Accuracy Check
    const isHit = Math.random() * 100 <= move.accuracy;
    if (!isHit) {
      events.push({
        type: "message",
        text: "But it missed!"
      });
      continue;
    }

    // Status category move check
    if (move.category === "Status") {
      // Growl is the only status move implemented; prints message, does nothing else.
      events.push({
        type: "message",
        text: "But it had no effect!"
      });
      continue;
    }

    // Damage Calculation
    const damageResult = calculateDamage(attacker, move, defender, typeChart);
    const damage = damageResult.damage;
    const eff = damageResult.effectiveness;

    // Apply Damage
    defender.currentHp = Math.max(0, defender.currentHp - damage);

    // Event: Damage hit
    events.push({
      type: "damage",
      target: defenderRole,
      amount: damage
    });

    // Effectiveness Messages
    if (eff === 0) {
      events.push({
        type: "message",
        text: `It doesn't affect ${defenderName}...`
      });
    } else if (eff >= 2) {
      events.push({
        type: "message",
        text: "It's super effective!"
      });
    } else if (eff > 0 && eff <= 0.5) {
      events.push({
        type: "message",
        text: "It's not very effective..."
      });
    }

    // Check Faint
    if (defender.currentHp <= 0) {
      events.push({
        type: "faint",
        target: defenderRole
      });

      const cleanDefName = defenderName.replace("Wild ", "");
      events.push({
        type: "message",
        text: `${cleanDefName} fainted!`
      });

      if (defenderRole === "enemy") {
        newState.phase = "victory";

        // Exp Reward
        const baseExp = enemySpecies?.baseExp || 50;
        const expGain = calculateExpGain(newState.isWildBattle, baseExp, enemyPokemon.level);
        events.push({
          type: "message",
          text: `${playerName} gained ${expGain} EXP!`
        });

        // Trigger Gym Leader / Trainer dialogues on Victory
        if (!newState.isWildBattle && newState.trainerId === "garnet") {
          events.push({
            type: "message",
            text: "Garnet: You've got fire in you, kid. Your mother would be proud."
          });
        }

        events.push({
          type: "phaseChange",
          phase: "victory"
        });
      } else {
        newState.phase = "defeat";
        events.push({
          type: "message",
          text: "You have no more Pokémon!"
        });
        events.push({
          type: "phaseChange",
          phase: "defeat"
        });
      }
      break;
    }

    // Apply recoil if move has it
    if (move.recoil && move.recoil > 0) {
      const recoilDamage = Math.max(1, Math.floor(damage * move.recoil));
      attacker.currentHp = Math.max(0, attacker.currentHp - recoilDamage);

      events.push({
        type: "damage",
        target: attackerRole,
        amount: recoilDamage
      });

      events.push({
        type: "message",
        text: `${attackerName} was hurt by recoil!`
      });

      // Check if attacker fainted from recoil
      if (attacker.currentHp <= 0) {
        events.push({
          type: "faint",
          target: attackerRole
        });

        const cleanAtkName = attackerName.replace("Wild ", "");
        events.push({
          type: "message",
          text: `${cleanAtkName} fainted!`
        });

        if (attackerRole === "enemy") {
          newState.phase = "victory";

          // Exp Reward
          const baseExp = enemySpecies?.baseExp || 50;
          const expGain = calculateExpGain(newState.isWildBattle, baseExp, enemyPokemon.level);
          events.push({
            type: "message",
            text: `${playerName} gained ${expGain} EXP!`
          });

          // Trigger Gym Leader / Trainer dialogues on Victory
          if (!newState.isWildBattle && newState.trainerId === "garnet") {
            events.push({
              type: "message",
              text: "Garnet: You've got fire in you, kid. Your mother would be proud."
            });
          }

          events.push({
            type: "phaseChange",
            phase: "victory"
          });
        } else {
          newState.phase = "defeat";
          events.push({
            type: "message",
            text: "You have no more Pokémon!"
          });
          events.push({
            type: "phaseChange",
            phase: "defeat"
          });
        }
        break;
      }
    }
  }

  // If neither side has fainted, transition phase back to playerTurn
  if (newState.phase === "animating") {
    newState.phase = "playerTurn";
    events.push({
      type: "phaseChange",
      phase: "playerTurn"
    });
  }

  return { newState, events };
}
