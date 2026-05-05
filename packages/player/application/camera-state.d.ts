import { Effect } from 'effect';
import type { CameraRotation, CameraMode } from '../domain/camera-state';
declare const PlayerCameraStateService_base: Effect.Service.Class<PlayerCameraStateService, "@minecraft/application/PlayerCameraStateService", {
    readonly effect: Effect.Effect<{
        getRotation: () => Effect.Effect<CameraRotation, never>;
        getMode: () => Effect.Effect<CameraMode, never>;
        setYaw: (yaw: number) => Effect.Effect<void, never>;
        setPitch: (pitch: number) => Effect.Effect<void, never>;
        addYaw: (delta: number) => Effect.Effect<void, never>;
        addPitch: (delta: number) => Effect.Effect<void, never>;
        setMode: (mode: CameraMode) => Effect.Effect<void, never>;
        toggleMode: () => Effect.Effect<void, never>;
        reset: () => Effect.Effect<void, never>;
    }, never, never>;
}>;
export declare class PlayerCameraStateService extends PlayerCameraStateService_base {
}
export declare const PlayerCameraStateLive: import("effect/Layer").Layer<PlayerCameraStateService, never, never>;
export {};
//# sourceMappingURL=camera-state.d.ts.map