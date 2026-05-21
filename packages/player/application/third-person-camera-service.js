import { Effect } from 'effect';
import { PlayerCameraStateService } from './camera-state';
export class ThirdPersonCameraService extends Effect.Service()('@minecraft/application/ThirdPersonCameraService', {
    effect: Effect.map(PlayerCameraStateService, (cameraState) => ({
        update: (camera, playerPos, eyeLevelOffset = 0.7) => Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation();
            const distance = 4; // camera distance behind player in blocks
            const shoulderHeight = 1.5; // vertical offset above player eye level
            const yaw = rotation.yaw;
            const pitch = rotation.pitch;
            const offsetX = Math.sin(yaw) * Math.cos(pitch) * distance;
            const offsetZ = Math.cos(yaw) * Math.cos(pitch) * distance;
            const offsetY = Math.sin(pitch) * distance + shoulderHeight;
            yield* Effect.sync(() => {
                const eyeY = playerPos.y + eyeLevelOffset; // eye is ~0.7 blocks above foot position
                camera.position.set(playerPos.x - offsetX, eyeY + offsetY, playerPos.z - offsetZ);
                camera.lookAt(playerPos.x, eyeY, playerPos.z);
            });
        }),
    })),
}) {
}
export const ThirdPersonCameraServiceLive = ThirdPersonCameraService.Default;
//# sourceMappingURL=../../../dist/packages/player/application/third-person-camera-service.js.map