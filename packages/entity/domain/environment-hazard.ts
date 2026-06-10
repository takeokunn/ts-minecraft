// Liquid / environment hazard constants and frame-rate-independent timing.
// Pure: no Effect, no side effects — drives lava burn (T14a) and drowning (T14b).

// Lava deals 4 damage every half-second while the player stands in it (vanilla).
export const LAVA_DAMAGE = 4
export const LAVA_DAMAGE_INTERVAL_SECS = 0.5

// Air supply: ~15s of breath, then 2 damage per second until you surface (vanilla).
export const MAX_AIR_SECS = 15
export const DROWN_DAMAGE = 2
export const DROWN_DAMAGE_INTERVAL_SECS = 1

/**
 * Advances a hazard accumulator by `dt` and reports how many whole damage ticks
 * elapsed. Carrying the sub-interval remainder makes the cadence frame-rate
 * independent (e.g. 0.5s lava ticks fire identically at 30 or 144 fps).
 */
export const accrueHazardTicks = (acc: number, dt: number, intervalSecs: number): { readonly acc: number; readonly ticks: number } => {
  const total = acc + dt
  const ticks = Math.floor(total / intervalSecs)
  return { acc: total - ticks * intervalSecs, ticks }
}

/**
 * Next air-supply value (seconds of breath remaining).
 * - Head submerged: drain by dt, clamped at 0.
 * - Otherwise: instantly refill to maxAirSecs (vanilla refills fast on surfacing).
 * maxAirSecs defaults to MAX_AIR_SECS; pass a larger value for RESPIRATION enchantment.
 */
export const nextAirSecs = (current: number, headSubmerged: boolean, dt: number, maxAirSecs = MAX_AIR_SECS): number => {
  if (!headSubmerged) return maxAirSecs
  const next = current - dt
  return next < 0 ? 0 : next
}
