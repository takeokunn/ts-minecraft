import { match } from 'ts-pattern'

const PI_HALF = Math.PI / 2

/**
 * Clamps a pitch angle (in radians) to the vertical range [-PI/2, PI/2]
 * to prevent the camera from flipping over.
 * Handles NaN by returning 0.
 * @param pitch The pitch angle to clamp.
 * @returns The clamped pitch angle.
 */
export const clampPitch = (pitch: number): number => {
  return match(pitch)
    .when(Number.isNaN, () => 0)
    .when(
      (p) => p > PI_HALF,
      () => PI_HALF,
    )
    .when(
      (p) => p < -PI_HALF,
      () => -PI_HALF,
    )
    .otherwise((p) => p)
}