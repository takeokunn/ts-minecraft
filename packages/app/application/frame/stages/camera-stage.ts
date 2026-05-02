import { Effect, MutableRef, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { KeyMappings } from '@ts-minecraft/input-handler'
import { EYE_LEVEL_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { MAX_SHADOW_HALF_EXTENT } from '@ts-minecraft/kernel'
import type { Position } from '@ts-minecraft/kernel'

export const cameraStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'inputService' | 'playerCameraState' | 'thirdPersonCamera'>,
  refs: Pick<FrameStageRefs, 'lastShadowTargetRef' | 'lastRenderDistanceRef'>,
  inputs: {
    readonly playerPos: Position
    readonly renderDistance: number
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Handle view toggle: F5 switches first/third person before raycasting
    yield* logErrors(
      services.inputService.consumeKeyPress(KeyMappings.CAMERA_TOGGLE).pipe(
        Effect.flatMap((pressed) => (pressed ? services.playerCameraState.toggleMode() : Effect.void)),
      ),
      'Camera toggle error',
    )

    // Camera perspective + position sync (use current mode before raycasting)
    yield* Effect.all(
      [services.playerCameraState.getRotation(), services.playerCameraState.getMode()],
      { concurrency: 'unbounded' },
    ).pipe(
      Effect.flatMap(([rotation, cameraMode]) =>
        cameraMode === 'firstPerson'
          ? Effect.sync(() => {
              const eyeY = inputs.playerPos.y + EYE_LEVEL_OFFSET
              deps.camera.position.set(inputs.playerPos.x, eyeY, inputs.playerPos.z)
              deps.camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
            })
          : services.thirdPersonCamera.update(deps.camera, inputs.playerPos, EYE_LEVEL_OFFSET),
      ),
      // Shadow frustum follows player so terrain around them is always shadow-covered
      // FR-009: Only update when player has moved more than 0.5 blocks (avoids per-frame updateMatrixWorld)
      Effect.andThen(
        Effect.sync(() => {
          const lastTarget = MutableRef.get(refs.lastShadowTargetRef)
          const dx = inputs.playerPos.x - lastTarget.x
          const dz = inputs.playerPos.z - lastTarget.z
          if (dx * dx + dz * dz > 0.25) {
            MutableRef.set(refs.lastShadowTargetRef, { x: inputs.playerPos.x, z: inputs.playerPos.z })
            deps.lights.light.target.position.set(inputs.playerPos.x, 0, inputs.playerPos.z)
            deps.lights.light.target.updateMatrixWorld()
            inputs.markShadowMapDirty()
          }
        }),
      ),
      // Dynamic shadow frustum: tighten bounds to renderDistance for higher texel density.
      // Only update when renderDistance changes (avoids per-frame updateProjectionMatrix).
      Effect.andThen(
        Ref.modify(refs.lastRenderDistanceRef, (lastRd): [boolean, number] =>
          lastRd === inputs.renderDistance ? [false, lastRd] : [true, inputs.renderDistance],
        ),
      ),
      Effect.flatMap((changed) =>
        changed
          ? Effect.sync(() => {
              // Dynamic camera far plane: keep Z-buffer precision tight to visible range
              deps.camera.far = Math.max(inputs.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              deps.camera.updateProjectionMatrix()
              // Shadow frustum: tighten bounds to renderDistance for higher texel density
              const halfExtent = Math.min(
                Math.ceil(inputs.renderDistance * CHUNK_SIZE * 0.5),
                MAX_SHADOW_HALF_EXTENT,
              )
              const cam = deps.lights.light.shadow.camera
              cam.far = Math.max(inputs.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              cam.left = -halfExtent
              cam.right = halfExtent
              cam.top = halfExtent
              cam.bottom = -halfExtent
              cam.updateProjectionMatrix()
              inputs.markShadowMapDirty()
            })
          : Effect.void,
      ),
    )
  })
