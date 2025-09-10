import * as S from 'effect/Schema'

/**
 * Camera Component
 * Defines camera properties and view parameters
 */

export const CameraComponent = S.Struct({
  pitch: S.Number.pipe(S.finite(), S.clamp(-Math.PI / 2, Math.PI / 2)),
  yaw: S.Number.pipe(S.finite()),
  fov: S.Number.pipe(S.positive(), S.finite()).pipe(S.withDefault(() => 75)),
  near: S.Number.pipe(S.positive(), S.finite()).pipe(S.withDefault(() => 0.1)),
  far: S.Number.pipe(S.positive(), S.finite()).pipe(S.withDefault(() => 1000)),
  isActive: S.Boolean.pipe(S.withDefault(() => false)),
})

export type CameraComponent = S.Schema.Type<typeof CameraComponent>

// Helper functions
export const createCamera = (
  pitch = 0,
  yaw = 0,
  fov = 75
): CameraComponent => ({
  pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)),
  yaw,
  fov,
  near: 0.1,
  far: 1000,
  isActive: false,
})

// Convert camera angles to direction vector
export const getDirectionVector = (camera: CameraComponent) => {
  const cosPitch = Math.cos(camera.pitch)
  return {
    x: Math.sin(camera.yaw) * cosPitch,
    y: Math.sin(camera.pitch),
    z: Math.cos(camera.yaw) * cosPitch,
  }
}