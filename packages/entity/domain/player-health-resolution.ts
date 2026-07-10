import { PlayerHealth } from './player-health'

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
 * Apply damage with an Absorption shield pool in front of regular health
 * (vanilla: absorption hearts soak damage first and never regenerate). A hit
 * fully soaked by absorption still grants invincibility frames. The same
 * no-op guards as applyDamageToHealth apply.
 */
export const applyDamageWithAbsorption = (
  health: PlayerHealth,
  absorption: number,
  amount: number,
): { readonly health: PlayerHealth; readonly absorption: number } => {
  if (amount <= 0 || health.current <= 0 || health.invincibilityTicks > 0) {
    return { health, absorption }
  }
  const absorbed = Math.min(Math.max(0, absorption), amount)
  const remainder = amount - absorbed
  const next = remainder > 0
    ? applyDamageToHealth(health, remainder)
    : new PlayerHealth({ current: health.current, max: health.max, invincibilityTicks: INVINCIBILITY_TICKS_ON_HIT })
  return { health: next, absorption: absorption - absorbed }
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
