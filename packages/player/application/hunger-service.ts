import { Effect, Ref } from 'effect'
import { PlayerHunger } from '../domain/player-hunger'
import {
  EXHAUSTION_PER_REGEN,
  FOOD_TICK_INTERVAL,
  MAX_EXHAUSTION,
  MAX_FOOD_LEVEL,
  REGEN_FOOD_THRESHOLD,
  START_FOOD_LEVEL,
  START_SATURATION,
} from './hunger-service.config'

// ─── Types ──────────────────────────────────────────────────────────────────

// Outcome of a single food tick — the signal a coordinator applies to HealthService.
//   'regen'  → heal the player 1 HP (foodLevel was high enough)
//   'starve' → deal 1 starvation damage (foodLevel was empty)
//   'none'   → no health change this tick (interval not elapsed, or food is mid-range)
export type HungerTickEffect = 'none' | 'regen' | 'starve'

type HungerState = {
  readonly hunger: PlayerHunger
  // Counts up to FOOD_TICK_INTERVAL; the regen/starve decision fires when it wraps.
  readonly tickTimer: number
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: HungerState = {
  hunger: new PlayerHunger({ foodLevel: START_FOOD_LEVEL, saturation: START_SATURATION, exhaustion: 0 }),
  tickTimer: 0,
}

// ─── Pure hunger transformers ───────────────────────────────────────────────

// Drains accumulated exhaustion over raw numeric fields: every whole
// MAX_EXHAUSTION unit consumes one saturation point, falling back to foodLevel
// once the saturation reserve is dry. Works on numbers (never constructing an
// out-of-bounds PlayerHunger intermediate) and is tail-recursive, so even a
// large exhaustion add is fully resolved down to a residue < MAX_EXHAUSTION.
const cascadeRaw = (foodLevel: number, saturation: number, exhaustion: number): PlayerHunger => {
  if (exhaustion < MAX_EXHAUSTION) {
    return new PlayerHunger({ foodLevel, saturation, exhaustion })
  }
  const remaining = exhaustion - MAX_EXHAUSTION
  return saturation > 0
    ? cascadeRaw(foodLevel, Math.max(0, saturation - 1), remaining)
    : cascadeRaw(Math.max(0, foodLevel - 1), 0, remaining)
}

export const applyExhaustionCascade = (h: PlayerHunger): PlayerHunger =>
  cascadeRaw(h.foodLevel, h.saturation, h.exhaustion)

export const addExhaustionToHunger = (h: PlayerHunger, amount: number): PlayerHunger =>
  amount <= 0 ? h : cascadeRaw(h.foodLevel, h.saturation, h.exhaustion + amount)

// Eating restores foodLevel by `food` points and saturation by `food *
// saturationModifier * 2` (Minecraft's food-item formula), capped at the new
// foodLevel so the saturation-never-exceeds-foodLevel invariant always holds.
export const eatFood = (h: PlayerHunger, food: number, saturationModifier: number): PlayerHunger => {
  if (food <= 0) return h
  const foodLevel = Math.min(MAX_FOOD_LEVEL, Math.floor(h.foodLevel + food))
  const saturation = Math.min(foodLevel, h.saturation + food * saturationModifier * 2)
  return new PlayerHunger({ foodLevel, saturation, exhaustion: h.exhaustion })
}

// Advances the food timer by one game tick. Until the interval elapses this is a
// pure counter bump; on the boundary it resets the timer and decides the tick
// effect — regen when well-fed (charging EXHAUSTION_PER_REGEN), starve when empty.
export const advanceFoodTimer = (state: HungerState): readonly [HungerTickEffect, HungerState] => {
  const timer = state.tickTimer + 1
  if (timer < FOOD_TICK_INTERVAL) {
    return ['none', { ...state, tickTimer: timer }] as const
  }
  const h = state.hunger
  if (h.foodLevel >= REGEN_FOOD_THRESHOLD) {
    return ['regen', { hunger: addExhaustionToHunger(h, EXHAUSTION_PER_REGEN), tickTimer: 0 }] as const
  }
  if (h.foodLevel <= 0) {
    return ['starve', { hunger: h, tickTimer: 0 }] as const
  }
  return ['none', { hunger: h, tickTimer: 0 }] as const
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class HungerService extends Effect.Service<HungerService>()(
  '@minecraft/application/HungerService',
  {
    // Single Ref for all hunger state — reset() is atomic, and tick() reads the
    // timer and produces its effect in one Ref.modify (no read-then-write TOCTOU).
    effect: Ref.make<HungerState>(INITIAL_STATE).pipe(Effect.map((stateRef) => ({
      getHunger: (): Effect.Effect<PlayerHunger, never> =>
        Ref.get(stateRef).pipe(Effect.map((s) => s.hunger)),

      // Accumulate exhaustion from an action (sprinting, jumping, attacking, …).
      addExhaustion: (amount: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({ ...s, hunger: addExhaustionToHunger(s.hunger, amount) })),

      // Consume a food item: `food` drumsticks restored, `saturationModifier`
      // is the item's vanilla saturation modifier (e.g. 0.6 for bread).
      eat: (food: number, saturationModifier: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({ ...s, hunger: eatFood(s.hunger, food, saturationModifier) })),

      // Advance one game tick; returns the regen/starve signal for the caller to
      // apply to HealthService. Atomic: timer advance and effect decision are one write.
      tick: (): Effect.Effect<HungerTickEffect, never> =>
        Ref.modify(stateRef, advanceFoodTimer),

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
    })))
  }
) {}
export const HungerServiceLive = HungerService.Default
