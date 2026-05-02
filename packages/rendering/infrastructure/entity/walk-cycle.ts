// Pure walk-cycle math — no THREE.js, no side effects.
// Used by the entity renderer to compute per-limb swing angles each frame.
// Bipeds: arm-L pairs with leg-R (and vice versa); legs L/R are π apart.
// Quadrupeds: front legs use the same phase relationships as biped legs;
// the renderer negates the result for back legs.

export const STRIDE_LENGTH = 1.2
export const LIMB_SWING_AMPLITUDE = Math.PI / 6 // 30°
export const WALK_DAMPING_SECONDS = 0.2

const SPEED_THRESHOLD = 0.05

const phaseOf = (side: 'L' | 'R', limb: 'arm' | 'leg'): number => {
  // Reference phase: leg-L = 0, leg-R = π (legs alternate)
  // arm-L is in phase with leg-R → arm-L = π
  // arm-R is in phase with leg-L → arm-R = 0
  if (limb === 'leg') {
    return side === 'L' ? 0 : Math.PI
  }
  return side === 'L' ? Math.PI : 0
}

export const computeLimbAngle = (
  speed: number,
  t: number,
  side: 'L' | 'R',
  limb: 'arm' | 'leg',
): number => {
  if (speed < SPEED_THRESHOLD) return 0
  const phase = phaseOf(side, limb)
  return Math.sin((2 * Math.PI * speed * t) / STRIDE_LENGTH + phase) * LIMB_SWING_AMPLITUDE
}

export const dampLimbAngle = (current: number, target: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / WALK_DAMPING_SECONDS))
