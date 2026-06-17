import { Effect, MutableRef } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { FrameCameraServices } from '@ts-minecraft/app/frame/frame-service-types'
import { KeyMappings } from '@ts-minecraft/entity'
import { EYE_LEVEL_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { MAX_SHADOW_HALF_EXTENT } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'

// Sprint FOV (R5): the camera widens slightly while sprinting for a subtle
// "feel of speed", then eases back. Lerped per-frame; the camera object holds
// the FOV state so no extra ref is needed.
const BASE_FOV = 75
const SPRINT_FOV = 82
const FOV_LERP = 0.18

export const cameraStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'lights'>,
  services: FrameCameraServices,
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
      Effect.gen(function* () {
        const pressed = yield* services.inputService.consumeKeyPress(KeyMappings.CAMERA_TOGGLE)
        if (pressed) yield* services.playerCameraState.toggleMode()
      }),
      'Camera toggle error',
    )

    // Sprint FOV: sprinting = Ctrl held + moving forward + not sneaking (mirrors
    // movement-service's sprint rule). Ease the camera FOV toward the target and
    // only touch the projection matrix when it actually changes.
    const ctrlL = yield* services.inputService.isKeyPressed(KeyMappings.SPRINT)
    const ctrlR = yield* services.inputService.isKeyPressed(KeyMappings.SPRINT_ALT)
    const forward = yield* services.inputService.isKeyPressed(KeyMappings.MOVE_FORWARD)
    const sneak = yield* services.inputService.isKeyPressed(KeyMappings.SNEAK)
    yield* Effect.sync(() => {
      const sprinting = (ctrlL || ctrlR) && forward && !sneak
      const targetFov = sprinting ? SPRINT_FOV : BASE_FOV
      const nextFov = deps.camera.fov + (targetFov - deps.camera.fov) * FOV_LERP
      if (Math.abs(nextFov - deps.camera.fov) > 0.05) {
        deps.camera.fov = nextFov
        deps.camera.updateProjectionMatrix()
      }
    })

    // Camera perspective + position sync
    const rotation = yield* services.playerCameraState.getRotation()
    const cameraMode = yield* services.playerCameraState.getMode()
    if (cameraMode === 'firstPerson') {
      yield* Effect.sync(() => {
        const eyeY = inputs.playerPos.y + EYE_LEVEL_OFFSET
        deps.camera.position.set(inputs.playerPos.x, eyeY, inputs.playerPos.z)
        deps.camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
      })
    } else {
      yield* services.thirdPersonCamera.update(deps.camera, inputs.playerPos, EYE_LEVEL_OFFSET)
    }

    // Shadow frustum follows player so terrain around them is always shadow-covered.
    // The directional light's target is moved to track the player (cheap: one matrix),
    // but we DELIBERATELY do NOT markShadowMapDirty() here. The shadow map only needs to
    // re-render (a full second scene geometry pass into the 2048² depth target — the single
    // largest GPU cost while moving) on the lighting-stage's mod-8 day/night cadence, which
    // re-renders with the current target. Marking dirty on every >0.5-block move forced an
    // extra full shadow pass roughly every 5-7 frames while walking (the dominant gameplay
    // state); relying on the mod-8 trigger alone cuts shadow passes ~8× during movement. The
    // target lagging the player by ≤8 frames is imperceptible for a sun-direction shadow.
    yield* Effect.sync(() => {
      const lastTarget = MutableRef.get(refs.lastShadowTargetRef)
      const dx = inputs.playerPos.x - lastTarget.x
      const dz = inputs.playerPos.z - lastTarget.z
      if (dx * dx + dz * dz > 0.25) {
        MutableRef.set(refs.lastShadowTargetRef, { x: inputs.playerPos.x, z: inputs.playerPos.z })
        deps.lights.light.target.position.set(inputs.playerPos.x, 0, inputs.playerPos.z)
        deps.lights.light.target.updateMatrixWorld()
      }
    })

    // Dynamic shadow frustum: tighten bounds to renderDistance for higher texel density.
    // Only update when renderDistance changes (avoids per-frame updateProjectionMatrix).
    const lastRenderDistance = MutableRef.get(refs.lastRenderDistanceRef)
    const renderDistanceChanged = lastRenderDistance !== inputs.renderDistance
    if (renderDistanceChanged) MutableRef.set(refs.lastRenderDistanceRef, inputs.renderDistance)
    if (!renderDistanceChanged) return
    yield* Effect.sync(() => {
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
  })
