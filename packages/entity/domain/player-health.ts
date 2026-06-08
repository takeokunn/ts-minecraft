import { Schema } from 'effect'

export class PlayerHealth extends Schema.Class<PlayerHealth>('PlayerHealth')({
  current: Schema.Number.pipe(Schema.finite(), Schema.between(0, 20)),
  max: Schema.Number.pipe(Schema.finite(), Schema.between(1, 20)),
  invincibilityTicks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {}

// Cross-field invariant: current health must not exceed max health.
// Field-level validators above only enforce per-field bounds (e.g., 0–20).
// Use this schema at storage deserialization boundaries.
// HealthService maintains the invariant internally via clamp logic (Math.min/max).
export const PlayerHealthInvariant = PlayerHealth.pipe(
  Schema.filter(
    (h: PlayerHealth) => h.current <= h.max
      ? true
      : `current health (${h.current}) must not exceed max health (${h.max})`,
    { identifier: 'PlayerHealthInvariant' }
  )
)

// ── Pure domain functions ────────────────────────────────────────────────────

/** Minecraft default: invincibility ticks after being hit. */
const INVINCIBILITY_TICKS_ON_HIT = 10
/** Minecraft default: 3 free blocks of fall distance before damage applies. */
const FALL_DAMAGE_FREE_BLOCKS = 3

/**
 * Apply damage to player health. Returns a new PlayerHealth instance.
 * Zero/negative amount is a no-op. During invincibility, no damage is applied.
 */
export const applyDamageToHealth = (health: PlayerHealth, amount: number): PlayerHealth => {
  if (amount <= 0 || health.current <= 0 || health.invincibilityTicks > 0) return health
  const newCurrent = Math.max(0, health.current - amount)
  return new PlayerHealth({ current: newCurrent, max: health.max, invincibilityTicks: INVINCIBILITY_TICKS_ON_HIT })
}

/**
 * Heal player health. Returns a new PlayerHealth instance.
 * Zero/negative amount is a no-op. Clamped to max health.
 */
export const healHealth = (health: PlayerHealth, amount: number): PlayerHealth => {
  if (amount <= 0) return health
  const newCurrent = Math.min(health.max, health.current + amount)
  return new PlayerHealth({ current: newCurrent, max: health.max, invincibilityTicks: health.invincibilityTicks })
}

/**
 * Decrement invincibility ticks. Returns a new PlayerHealth instance.
 * Returns the same instance if ticks are already 0.
 */
export const tickInvincibility = (health: PlayerHealth): PlayerHealth => {
  if (health.invincibilityTicks <= 0) return health
  return new PlayerHealth({ current: health.current, max: health.max, invincibilityTicks: health.invincibilityTicks - 1 })
}

/**
 * Compute fall damage based on Minecraft fall damage formula.
 * @param prevY - previous Y position
 * @param currentY - current Y position
 * @param wasFalling - whether the player was already falling in the previous frame
 * @param isGrounded - whether the player is currently grounded
 * @returns damage amount (0 if no damage applies)
 */
export const computeFallDamage = (
  prevY: number,
  currentY: number,
  wasFalling: boolean,
  isGrounded: boolean,
): number => {
  if (!isGrounded || !wasFalling) return 0
  const fallDistance = prevY - currentY
  // Vanilla rounds UP: damage = ceil(fallDistance - 3) (Mth.ceil in LivingEntity).
  // floor under-damaged fractional falls (a 4.5-block fall dealt 1 instead of 2).
  return Math.max(0, Math.ceil(fallDistance - FALL_DAMAGE_FREE_BLOCKS))
}
