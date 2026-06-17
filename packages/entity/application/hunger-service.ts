import { Effect, Ref } from 'effect'
import {
  PlayerHunger,
  addExhaustionToHunger,
  eatFood,
  advanceFoodTimer,
  type HungerState,
  type HungerTickEffect,
} from '../domain/player-hunger'
import {
  FOOD_TICK_INTERVAL,
  MAX_EXHAUSTION,
  MAX_FOOD_LEVEL,
  REGEN_FOOD_THRESHOLD,
  START_FOOD_LEVEL,
  START_SATURATION,
  EXHAUSTION_PER_REGEN,
} from './hunger-service.config'

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: HungerState = {
  hunger: new PlayerHunger({ foodLevel: START_FOOD_LEVEL, saturation: START_SATURATION, exhaustion: 0 }),
  tickTimer: 0,
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class HungerService extends Effect.Service<HungerService>()(
  '@minecraft/application/HungerService',
  {
    // Single Ref for all hunger state — reset() is atomic, and tick() reads the
    // timer and produces its effect in one Ref.modify (no read-then-write TOCTOU).
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<HungerState>(INITIAL_STATE)
      return {
      getHunger: (): Effect.Effect<PlayerHunger, never> =>
        Effect.gen(function* () {
          const s = yield* Ref.get(stateRef)
          return s.hunger
        }),

      // Accumulate exhaustion from an action (sprinting, jumping, attacking, …).
      addExhaustion: (amount: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({
          ...s,
          hunger: addExhaustionToHunger(s.hunger, amount, MAX_EXHAUSTION),
        })),

      // Consume a food item: food drumsticks restored, saturationModifier
      // is the item's vanilla saturation modifier (e.g. 0.6 for bread).
      eat: (food: number, saturationModifier: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({
          ...s,
          hunger: eatFood(s.hunger, food, saturationModifier, MAX_FOOD_LEVEL),
        })),

      // Advance one game tick; returns the regen/starve signal for the caller to
      // apply to HealthService. `canRegen` must be true only when the player is below
      // max health (vanilla: regen and its food cost only happen while healing).
      // Atomic: timer advance and effect decision are one write.
      tick: (canRegen: boolean): Effect.Effect<HungerTickEffect, never> =>
        Ref.modify(stateRef, (s) =>
          advanceFoodTimer(s, FOOD_TICK_INTERVAL, REGEN_FOOD_THRESHOLD, EXHAUSTION_PER_REGEN, MAX_EXHAUSTION, canRegen)
        ),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(stateRef, INITIAL_STATE),

      // Restore persisted hunger (e.g. on world load). Clamps to valid bounds and
      // enforces the saturation≤foodLevel invariant; resets exhaustion + tick timer.
      restore: (foodLevel: number, saturation: number): Effect.Effect<void, never> => {
        const clampedFood = Math.max(0, Math.min(MAX_FOOD_LEVEL, Math.floor(foodLevel)))
        const clampedSat = Math.max(0, Math.min(clampedFood, saturation))
        return Ref.set(stateRef, {
          hunger: new PlayerHunger({ foodLevel: clampedFood, saturation: clampedSat, exhaustion: 0 }),
          tickTimer: 0,
        })
      },
      }
    }),
  }
) {}
