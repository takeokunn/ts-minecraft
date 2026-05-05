import { Effect, Ref } from 'effect';
import { PITCH_MIN, PITCH_MAX } from '../domain/camera-state';
export class PlayerCameraStateService extends Effect.Service()('@minecraft/application/PlayerCameraStateService', {
    effect: Effect.all([
        Ref.make({ yaw: 0, pitch: 0 }),
        Ref.make('firstPerson'),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([stateRef, modeRef]) => ({
        getRotation: () => Ref.get(stateRef),
        getMode: () => Ref.get(modeRef),
        setYaw: (yaw) => Ref.update(stateRef, (s) => ({ ...s, yaw })),
        setPitch: (pitch) => Ref.update(stateRef, (s) => ({
            ...s,
            pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch)),
        })),
        addYaw: (delta) => Ref.update(stateRef, (s) => ({ ...s, yaw: s.yaw + delta })),
        addPitch: (delta) => Ref.update(stateRef, (s) => ({
            ...s,
            pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.pitch + delta)),
        })),
        setMode: (mode) => Ref.set(modeRef, mode),
        toggleMode: () => Ref.update(modeRef, (mode) => (mode === 'firstPerson' ? 'thirdPerson' : 'firstPerson')),
        reset: () => Effect.all([Ref.set(stateRef, { yaw: 0, pitch: 0 }), Ref.set(modeRef, 'firstPerson')], { concurrency: 'unbounded', discard: true }),
    })))
}) {
}
export const PlayerCameraStateLive = PlayerCameraStateService.Default;
//# sourceMappingURL=camera-state.js.map