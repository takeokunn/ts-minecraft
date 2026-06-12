// Pure walk-cycle math — no THREE.js, no side effects.
// Used by the entity renderer to compute per-limb swing angles each frame.
// Bipeds: arm-L pairs with leg-R (and vice versa); legs L/R are π apart.
// Quadrupeds: front legs use the same phase relationships as biped legs;
// the renderer negates the result for back legs.

export const STRIDE_LENGTH = 1.2
export const LIMB_SWING_AMPLITUDE = Math.PI / 6 // 30°
const REFERENCE_SPEED = 3.0
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
  const amp = LIMB_SWING_AMPLITUDE * Math.min(1, speed / REFERENCE_SPEED)
  return Math.sin((2 * Math.PI * speed * t) / STRIDE_LENGTH + phase) * amp
}

// Batched limb-angle computation: all 4 limbs with a single Math.sin call.
// Math.sin(x + π) = -Math.sin(x), so:
//   legL =  sin(baseAngle) * amp       (phase 0)
//   legR = -sin(baseAngle) * amp       (phase π)
//   armL = -sin(baseAngle) * amp       (phase π, same as legR)
//   armR =  sin(baseAngle) * amp       (phase 0, same as legL)
// This replaces 4 Math.sin calls per entity per frame with 1.
export type LimbAngles = { legL: number; legR: number; armL: number; armR: number }

export const computeLimbAngles = (
  speed: number,
  t: number,
): LimbAngles => {
  if (speed < SPEED_THRESHOLD) return { legL: 0, legR: 0, armL: 0, armR: 0 }
  const amp = LIMB_SWING_AMPLITUDE * Math.min(1, speed / REFERENCE_SPEED)
  const base = Math.sin((2 * Math.PI * speed * t) / STRIDE_LENGTH) * amp
  const neg = -base
  return { legL: base, legR: neg, armL: neg, armR: base }
}
