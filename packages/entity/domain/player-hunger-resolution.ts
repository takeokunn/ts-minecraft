import { PlayerHunger, type HungerState, type HungerTickEffect } from './player-hunger'

// ─── Vanilla Minecraft defaults ────────────────────────────────────────────────
const MAX_EXHAUSTION_DEFAULT = 4
const MAX_FOOD_LEVEL_DEFAULT = 20

// ─── Pure hunger transformers ─────────────────────────────────────────────────
// Domain logic: stateless computations on PlayerHunger values.

const cascadeRaw = (
  foodLevel: number,
  saturation: number,
  exhaustion: number,
  maxExhaustion = MAX_EXHAUSTION_DEFAULT,
): PlayerHunger => {
  if (exhaustion < maxExhaustion) {
    return new PlayerHunger({ foodLevel, saturation, exhaustion })
  }
  const remaining = exhaustion - maxExhaustion
  return saturation > 0
    ? cascadeRaw(foodLevel, Math.max(0, saturation - 1), remaining, maxExhaustion)
    : cascadeRaw(Math.max(0, foodLevel - 1), 0, remaining, maxExhaustion)
}

export const applyExhaustionCascade = (
  h: PlayerHunger,
  maxExhaustion = MAX_EXHAUSTION_DEFAULT,
): PlayerHunger =>
  cascadeRaw(h.foodLevel, h.saturation, h.exhaustion, maxExhaustion)

export const addExhaustionToHunger = (
  h: PlayerHunger,
  amount: number,
  maxExhaustion = MAX_EXHAUSTION_DEFAULT,
): PlayerHunger =>
  // Ignore non-positive AND non-finite amounts: a non-finite exhaustion (e.g. an
  // Infinity position-delta from a physics blow-up) would make cascadeRaw recurse
  // forever (Infinity - 4 === Infinity). Degrade to a no-op, mirroring the
  // Number.isFinite guard in processFallDamage.
  amount > 0 && Number.isFinite(amount)
    ? cascadeRaw(h.foodLevel, h.saturation, h.exhaustion + amount, maxExhaustion)
    : h

export const eatFood = (
  h: PlayerHunger,
  food: number,
  saturationModifier: number,
  maxFoodLevel = MAX_FOOD_LEVEL_DEFAULT,
): PlayerHunger => {
  if (food <= 0) return h
  const foodLevel = Math.min(maxFoodLevel, Math.floor(h.foodLevel + food))
  const saturation = Math.min(foodLevel, h.saturation + food * saturationModifier * 2)
  return new PlayerHunger({ foodLevel, saturation, exhaustion: h.exhaustion })
}

export const advanceFoodTimer = (
  state: HungerState,
  foodTickInterval = 80,
  regenFoodThreshold = 18,
  exhaustionPerRegen = 6,
  maxExhaustion = MAX_EXHAUSTION_DEFAULT,
  canRegen = true,
): readonly [HungerTickEffect, HungerState] => {
  const timer = state.tickTimer + 1
  if (timer < foodTickInterval) {
    return ['none', { ...state, tickTimer: timer }] as const
  }
  const h = state.hunger
  // Vanilla: natural regen (and the exhaustion it costs) only fires while the player
  // is below max health. Without the `canRegen` gate, an idle full-health player's food
  // drains for nothing — the heal is a clamped no-op, but the exhaustion was still charged.
  if (canRegen && h.foodLevel >= regenFoodThreshold) {
    return [
      'regen',
      { hunger: addExhaustionToHunger(h, exhaustionPerRegen, maxExhaustion), tickTimer: 0 },
    ] as const
  }
  if (h.foodLevel <= 0) {
    return ['starve', { hunger: h, tickTimer: 0 }] as const
  }
  return ['none', { hunger: h, tickTimer: 0 }] as const
}
