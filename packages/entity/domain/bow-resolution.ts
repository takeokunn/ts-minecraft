import { BOW_FULL_CHARGE_SECS, BOW_MAX_DAMAGE, BOW_MIN_CHARGE_SECS, BOW_MIN_DAMAGE } from './bow.config'

// Bow combat model. Pure functions — no Effect, no randomness.
// Charge-based hitscan bow: hold right-click to charge, release to fire.

// Charge ratio in [0, 1] from seconds held.
export const computeBowCharge = (secsHeld: number): number =>
  Math.min(secsHeld / BOW_FULL_CHARGE_SECS, 1.0)

// Vanilla damage scaling: BOW_MIN_DAMAGE + charge^2 * (BOW_MAX_DAMAGE - BOW_MIN_DAMAGE).
// charge=0 → 1 dmg; charge=1 → 9 dmg. Quadratic makes partial charges weak.
export const computeBowDamage = (charge: number): number => {
  const c = Math.max(0, Math.min(1, charge))
  return Math.round(BOW_MIN_DAMAGE + c * c * (BOW_MAX_DAMAGE - BOW_MIN_DAMAGE))
}

// Returns true if the bow has been held long enough to fire a meaningful shot.
export const canFireBow = (secsHeld: number): boolean =>
  secsHeld >= BOW_MIN_CHARGE_SECS
