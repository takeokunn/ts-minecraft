export type AttackSwingState = {
  triggerTime: number
  isActive: boolean
}

export type AttackSwingOffset = {
  readonly x: number
  readonly y: number
}

export const ATTACK_SWING_DURATION_MS = 300

const DOWNSWING_RATIO = 0.45
const ZERO_OFFSET: AttackSwingOffset = { x: 0, y: 0 }

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const easeOutCubic = (t: number): number => {
  const p = clamp01(t)
  return 1 - (1 - p) ** 3
}

export const easeInCubic = (t: number): number => {
  const p = clamp01(t)
  return p ** 3
}

export const swingProgress = (t: number): number => {
  const p = clamp01(t)
  if (p <= DOWNSWING_RATIO) return easeOutCubic(p / DOWNSWING_RATIO)
  return 1 - easeInCubic((p - DOWNSWING_RATIO) / (1 - DOWNSWING_RATIO))
}

export const createAttackSwingState = (): AttackSwingState => ({
  triggerTime: 0,
  isActive: false,
})

export const triggerAttackSwing = (state: AttackSwingState, nowMs: number): AttackSwingState => {
  state.triggerTime = nowMs
  state.isActive = true
  return state
}

export const getAttackSwingOffset = (state: AttackSwingState, nowMs: number): AttackSwingOffset => {
  if (!state.isActive) return ZERO_OFFSET
  const elapsed = nowMs - state.triggerTime
  if (elapsed < 0 || elapsed >= ATTACK_SWING_DURATION_MS) return ZERO_OFFSET

  const amount = swingProgress(elapsed / ATTACK_SWING_DURATION_MS)
  if (amount === 0) return ZERO_OFFSET
  return { x: amount, y: -amount }
}
