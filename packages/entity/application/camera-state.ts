import { Effect, Ref } from 'effect'
import type { CameraRotation, CameraMode } from '../domain/camera-state'
import { PITCH_MIN, PITCH_MAX } from '../domain/camera-state'

export class PlayerCameraStateService extends Effect.Service<PlayerCameraStateService>()(
  '@minecraft/application/PlayerCameraStateService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<CameraRotation>({ yaw: 0, pitch: 0 })
      const modeRef = yield* Ref.make<CameraMode>('firstPerson')
      return {
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
          Ref.set(stateRef, { yaw: 0, pitch: 0 }).pipe(
            Effect.flatMap(() => Ref.set(modeRef, 'firstPerson')),
          ),
      }
    }),
  }
) {}
export const PlayerCameraStateLive = PlayerCameraStateService.Default
