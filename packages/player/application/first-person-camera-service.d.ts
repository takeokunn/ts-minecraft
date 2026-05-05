import { Effect } from 'effect';
import type { CameraRotationPort } from '@ts-minecraft/kernel';
import { PlayerInputService } from './player-input-service';
import { PlayerCameraStateService } from './camera-state';
export declare const BASE_MOUSE_SENSITIVITY = 0.004;
declare const FirstPersonCameraService_base: Effect.Service.Class<FirstPersonCameraService, "@minecraft/application/FirstPersonCameraService", {
    readonly effect: Effect.Effect<{
        update: (camera: CameraRotationPort, sensitivity?: number) => Effect.Effect<void, never>;
        attachToPlayer: (camera: CameraRotationPort) => Effect.Effect<void, never>;
    }, never, PlayerCameraStateService | PlayerInputService>;
}>;
export declare class FirstPersonCameraService extends FirstPersonCameraService_base {
}
export declare const FirstPersonCameraServiceLive: import("effect/Layer").Layer<FirstPersonCameraService, never, PlayerCameraStateService | PlayerInputService>;
export {};
//# sourceMappingURL=first-person-camera-service.d.ts.map