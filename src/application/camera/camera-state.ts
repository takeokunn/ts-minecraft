// Stateful application service (PlayerCameraState) — not a pure domain model.
// Moved from src/domain/ because it contains Ref.make() state.
import { Effect, Ref, Schema } from 'effect'

// Schema for camera rotation state
export const CameraRotationSchema = Schema.Struct({
  yaw: Schema.Number.pipe(Schema.finite()), // Horizontal rotation (radians)
  pitch: Schema.Number.pipe(Schema.finite(), Schema.between(-Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)), // Vertical rotation (radians), clamped to -89 to 89
})
export type CameraRotation = Schema.Schema.Type<typeof CameraRotationSchema>

export const CameraModeSchema = Schema.Union(Schema.Literal('firstPerson'), Schema.Literal('thirdPerson'))
export type CameraMode = Schema.Schema.Type<typeof CameraModeSchema>

// Constants for pitch clamping
export const PITCH_MIN = -Math.PI / 2 + 0.01 // ~-89, prevents flipping
export const PITCH_MAX = Math.PI / 2 - 0.01 // ~89

export class PlayerCameraStateService extends Effect.Service<PlayerCameraStateService>()(
  '@minecraft/application/PlayerCameraStateService',
  {
    effect: Effect.all([
      Ref.make<CameraRotation>({ yaw: 0, pitch: 0 }),
      Ref.make<CameraMode>('firstPerson'),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([stateRef, modeRef]) => ({
        getRotation: (): Effect.Effect<CameraRotation, never> => Ref.get(stateRef),

        getMode: (): Effect.Effect<CameraMode, never> => Ref.get(modeRef),

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

        setMode: (mode: CameraMode): Effect.Effect<void, never> => Ref.set(modeRef, mode),

        toggleMode: (): Effect.Effect<void, never> =>
          Ref.update(modeRef, (mode) => (mode === 'firstPerson' ? 'thirdPerson' : 'firstPerson')),

        reset: (): Effect.Effect<void, never> =>
          Effect.zipRight(
            Ref.set(stateRef, { yaw: 0, pitch: 0 }),
            Ref.set(modeRef, 'firstPerson'),
          ),
    })))
  }
) {}
export const PlayerCameraStateLive = PlayerCameraStateService.Default
