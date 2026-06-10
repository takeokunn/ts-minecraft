// Pure mob-breeding domain logic (FR R6). No Effect, no entity-manager coupling —
// the entity-manager (R6c) supplies the state fields and applies these decisions.
// Storage uses simple per-tick countdown counters (love window + breed cooldown);
// R6c decides where the one-tick decay (tickBreedingTimers) hooks the update loop.

// Timing in game ticks (20 tps), mirroring vanilla.
export const LOVE_DURATION_TICKS = 600 // 30s window to find a mate after feeding
export const BREED_COOLDOWN_TICKS = 6000 // 5min before an animal can breed again
export const BABY_GROW_TICKS = 24000 // 20min for a baby to reach adulthood
export const BREED_RANGE = 3 // blocks between two in-love adults to form a pair

const BREED_RANGE_SQ = BREED_RANGE * BREED_RANGE

export type BreedingState = {
  // Counts down each tick; > 0 means "in love mode".
  readonly loveTicksRemaining: number
  // Counts down each tick; must be 0 before the animal can be fed again.
  readonly breedCooldownRemaining: number
  // Counts up each tick from 0 (baby) toward BABY_GROW_TICKS (adult).
  readonly ageTicks: number
}

export const isAdult = (ageTicks: number): boolean => ageTicks >= BABY_GROW_TICKS

export const isInLove = (loveTicksRemaining: number): boolean => loveTicksRemaining > 0

/** Adult, not already in love, and off cooldown → feeding it enters love mode. */
export const canAcceptBreedingFood = (s: BreedingState): boolean =>
  isAdult(s.ageTicks) && s.loveTicksRemaining <= 0 && s.breedCooldownRemaining <= 0

/**
 * Two DISTINCT same-type adults, both in love and within BREED_RANGE → a breeding
 * pair that will spawn a baby this tick. (Caller ensures a≠b by id.)
 */
export const isBreedingPair = (
  aType: string,
  bType: string,
  aPos: { readonly x: number; readonly y: number; readonly z: number },
  bPos: { readonly x: number; readonly y: number; readonly z: number },
  aLove: number,
  bLove: number,
): boolean => {
  if (aType !== bType || aLove <= 0 || bLove <= 0) return false
  const dx = aPos.x - bPos.x
  const dy = aPos.y - bPos.y
  const dz = aPos.z - bPos.z
  return dx * dx + dy * dy + dz * dz <= BREED_RANGE_SQ
}

/**
 * One tick of breeding-timer decay: love & cooldown count down; age counts up
 * but CLAMPS at BABY_GROW_TICKS. The clamp matters for the entity update loop's
 * idle early-return: an adult at rest (love 0, cooldown 0, age = BABY_GROW_TICKS)
 * yields an UNCHANGED state, so the per-tick "return entity unchanged" fast path
 * still fires. Only babies (growing) and in-love/cooldown animals change.
 */
export const tickBreedingTimers = (s: BreedingState): BreedingState => ({
  loveTicksRemaining: s.loveTicksRemaining > 0 ? s.loveTicksRemaining - 1 : 0,
  breedCooldownRemaining: s.breedCooldownRemaining > 0 ? s.breedCooldownRemaining - 1 : 0,
  ageTicks: s.ageTicks < BABY_GROW_TICKS ? s.ageTicks + 1 : s.ageTicks,
})

/** State of a freshly-spawned adult (e.g. world-gen / natural spawn): mature, idle. */
export const ADULT_BREEDING_STATE: BreedingState = {
  loveTicksRemaining: 0,
  breedCooldownRemaining: 0,
  ageTicks: BABY_GROW_TICKS,
}

/** State after two adults breed: a baby plus the parents' post-breed cooldown. */
export const newbornBreedingState = (): BreedingState => ({
  loveTicksRemaining: 0,
  breedCooldownRemaining: 0,
  ageTicks: 0,
})

export const afterBreedingParentState = (): Pick<BreedingState, 'loveTicksRemaining' | 'breedCooldownRemaining'> => ({
  loveTicksRemaining: 0,
  breedCooldownRemaining: BREED_COOLDOWN_TICKS,
})
