// Stateful application service (PlayerCameraState) — not a pure domain model.
// Moved from src/domain/ because it contains Ref.make() state.
import { Effect, Ref, Schema } from 'effect'

// Schema for camera rotation state
export const CameraRotationSchema = Schema.Struct({
  yaw: Schema.Number.pipe(Schema.finite()), // Horizontal rotation (radians)
  pitch: Schema.Number.pipe(Schema.between(-Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)), // Vertical rotation (radians), clamped to -89 to 89
})
export type CameraRotation = Schema.Schema.Type<typeof CameraRotationSchema>

// Constants for pitch clamping
export const PITCH_MIN = -Math.PI / 2 + 0.01 // ~-89, prevents flipping
export const PITCH_MAX = Math.PI / 2 - 0.01 // ~89

export class PlayerCameraStateService extends Effect.Service<PlayerCameraStateService>()(
  '@minecraft/application/PlayerCameraStateService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<CameraRotation>({ yaw: 0, pitch: 0 })

      return {
        getRotation: (): Effect.Effect<CameraRotation, never> => Ref.get(stateRef),

        setYaw: (yaw: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({ ...s, yaw })),

        setPitch: (pitch: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({
            ...s,
            pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch)),
          })),

        addYaw: (delta: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({ ...s, yaw: s.yaw + delta })),

        addPitch: (delta: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({
            ...s,
            pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.pitch + delta)),
          })),

        reset: (): Effect.Effect<void, never> =>
          Ref.set(stateRef, { yaw: 0, pitch: 0 }),
      }
    }),
  }
) {}
export const PlayerCameraStateLive = PlayerCameraStateService.Default
