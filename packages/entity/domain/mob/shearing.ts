// Pure sheep-shearing domain logic (FR R11). Mirrors breeding.ts: no Effect and no
// entity-manager coupling — the entity-manager supplies `woolRegrowthTicks` and applies
// these decisions. Storage is a single per-tick countdown: 0 = woolly (shearable),
// > 0 = sheared and regrowing.

// Vanilla sheep drop 1-3 wool when sheared; wool regrows after the sheep grazes.
// We model regrowth as a fixed timer (no grass-eating simulation).
export const SHEAR_WOOL_MIN = 1
export const SHEAR_WOOL_MAX = 3
export const WOOL_REGROWTH_TICKS = 6000 // ~5min @ 20 tps before wool regrows

/** A sheep can be sheared only when its wool has fully regrown (timer at 0). */
export const canBeSheared = (woolRegrowthTicks: number): boolean => woolRegrowthTicks <= 0

/**
 * Deterministic wool yield in [SHEAR_WOOL_MIN, SHEAR_WOOL_MAX] derived from the
 * entity's id hash — no RNG, matching this package's determinism policy for entity
 * logic (so saves/replays reproduce identically).
 */
export const shearWoolCount = (hash: number): number =>
  SHEAR_WOOL_MIN + (hash % (SHEAR_WOOL_MAX - SHEAR_WOOL_MIN + 1))

/**
 * One tick of wool-regrowth decay: counts down toward 0, then CLAMPS at 0. The clamp
 * keeps the entity update loop's idle early-return intact — a woolly sheep at rest
 * (regrowth 0) yields an unchanged value, so only freshly-sheared sheep churn.
 */
export const tickWoolRegrowth = (woolRegrowthTicks: number, ticksElapsed: number): number =>
  Math.max(0, woolRegrowthTicks - ticksElapsed)
