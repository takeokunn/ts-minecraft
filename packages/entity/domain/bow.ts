// Bow combat model. Pure functions — no Effect, no randomness.
// Charge-based hitscan bow: hold right-click to charge, release to fire.

export const BOW_MAX_DAMAGE = 9   // vanilla: max ~4.5 hearts per shot
export const BOW_MIN_DAMAGE = 1   // vanilla: min 1 damage at minimal charge
export const BOW_MIN_CHARGE_SECS = 0.2  // must hold at least this long to fire
export const BOW_FULL_CHARGE_SECS = 1.0  // full charge at 1 second (vanilla ~1s draw)
export const BOW_MAX_RANGE = 50   // hitscan range in blocks
export const BOW_ATTACK_RADIUS = 0.9  // cylinder radius for crosshair targeting

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
