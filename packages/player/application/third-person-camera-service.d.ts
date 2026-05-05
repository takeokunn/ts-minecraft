import { Effect } from 'effect';
import type { CameraTransformPort } from '@ts-minecraft/kernel';
import { PlayerCameraStateService } from './camera-state';
import type { Position } from '@ts-minecraft/kernel';
declare const ThirdPersonCameraService_base: Effect.Service.Class<ThirdPersonCameraService, "@minecraft/application/ThirdPersonCameraService", {
    readonly effect: Effect.Effect<{
        update: (camera: CameraTransformPort, playerPos: Position, eyeLevelOffset?: number) => Effect.Effect<void, never>;
    }, never, PlayerCameraStateService>;
}>;
export declare class ThirdPersonCameraService extends ThirdPersonCameraService_base {
}
export declare const ThirdPersonCameraServiceLive: import("effect/Layer").Layer<ThirdPersonCameraService, never, PlayerCameraStateService>;
export {};
//# sourceMappingURL=third-person-camera-service.d.ts.map