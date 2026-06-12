import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableHashSet, MutableRef, Ref } from 'effect'
import { KeyMappings, ThirdPersonCameraService } from '@ts-minecraft/entity'
import {
  makeDeps,
  makeCamera,
  makeLights,
  makeCameraState,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'
import { cameraStage } from '@ts-minecraft/app/frame/stages/camera-stage'

// ---------------------------------------------------------------------------
// Step 8: Camera sync
// ---------------------------------------------------------------------------

describe('step 8 — camera sync', () => {
  it.effect('sets camera position to playerPos with EYE_LEVEL_OFFSET applied', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Override getPlayerPosition to return a known position
    Object.assign(services.gameState, { getPlayerPosition: vi.fn(() => Effect.succeed({ x: 5, y: 64, z: 3 })) })

    yield* runFrame(deps, services)

    expect(deps.camera.position.x).toBe(5)
    expect(deps.camera.position.y).toBeCloseTo(64 + 0.72)
    expect(deps.camera.position.z).toBe(3)
  }))

  it.effect('toggles to third person with F5 and moves the camera behind the player', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.make(KeyMappings.CAMERA_TOGGLE)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.gameState, { getPlayerPosition: vi.fn(() => Effect.succeed({ x: 5, y: 64, z: 3 })) })

    yield* runFrame(deps, services)

    expect(services.cameraState.mode).toBe('thirdPerson')
    expect(deps.camera.position.x).toBeCloseTo(5)
    expect(deps.camera.position.y).toBeCloseTo(64 + 0.72 + 1.5)
    expect(deps.camera.position.z).toBeCloseTo(3 - 4)
  }))

  it.effect('updates the shadow target when the player moves > 0.5 blocks but does NOT force a shadow re-render (perf: mod-8 cadence owns that)', () => Effect.gen(function* () {
    const camera = makeCamera()
    const lights = makeLights()
    const { service: cameraStateService } = makeCameraState('firstPerson')
    const inputService = makeInputService()
    const thirdPersonCamera: Parameters<typeof cameraStage>[1]['thirdPersonCamera'] = ThirdPersonCameraService.of({
      _tag: '@minecraft/application/ThirdPersonCameraService' as const,
      update: () => Effect.void,
    })

    const lastShadowTargetRef = MutableRef.make({ x: 4.4, z: 3.0 })
    // Hold render distance constant so the rd-change branch can't trigger the dirty flag —
    // isolating the per-move behaviour.
    const lastRenderDistanceRef = yield* Ref.make(8)

    const shadowDirtyCalledRef = MutableRef.make(false)
    yield* cameraStage(
      { camera, lights },
      { inputService, playerCameraState: cameraStateService, thirdPersonCamera },
      { lastShadowTargetRef, lastRenderDistanceRef },
      { playerPos: { x: 5, y: 64, z: 3 }, renderDistance: 8, markShadowMapDirty: () => { MutableRef.set(shadowDirtyCalledRef, true) } },
    )

    // Target follows the player (so the next mod-8 shadow render covers the new area)...
    expect(MutableRef.get(lastShadowTargetRef)).toEqual({ x: 5, z: 3 })
    // ...but movement alone no longer forces an extra full shadow-map pass.
    expect(MutableRef.get(shadowDirtyCalledRef)).toBe(false)
  }))

  it.effect('marks shadow map dirty when render distance changes (shadow frustum must re-render)', () => Effect.gen(function* () {
    const camera = makeCamera()
    const lights = makeLights()
    const { service: cameraStateService } = makeCameraState('firstPerson')
    const inputService = makeInputService()
    const thirdPersonCamera: Parameters<typeof cameraStage>[1]['thirdPersonCamera'] = ThirdPersonCameraService.of({
      _tag: '@minecraft/application/ThirdPersonCameraService' as const,
      update: () => Effect.void,
    })

    const lastShadowTargetRef = MutableRef.make({ x: 5, z: 3 })
    const lastRenderDistanceRef = yield* Ref.make(0) // differs from input rd → frustum changes

    const shadowDirtyCalledRef = MutableRef.make(false)
    yield* cameraStage(
      { camera, lights },
      { inputService, playerCameraState: cameraStateService, thirdPersonCamera },
      { lastShadowTargetRef, lastRenderDistanceRef },
      { playerPos: { x: 5, y: 64, z: 3 }, renderDistance: 8, markShadowMapDirty: () => { MutableRef.set(shadowDirtyCalledRef, true) } },
    )

    expect(MutableRef.get(shadowDirtyCalledRef)).toBe(true)
  }))

  it.effect('widens FOV while sprinting (Ctrl + forward) and holds base FOV when idle (R5)', () => Effect.gen(function* () {
    const lights = makeLights()
    const { service: cameraStateService } = makeCameraState('firstPerson')
    const thirdPersonCamera: Parameters<typeof cameraStage>[1]['thirdPersonCamera'] = ThirdPersonCameraService.of({
      _tag: '@minecraft/application/ThirdPersonCameraService' as const,
      update: () => Effect.void,
    })
    const lastShadowTargetRef = MutableRef.make({ x: 5, z: 3 })
    const lastRenderDistanceRef = yield* Ref.make(8)
    const runOnce = (camera: ReturnType<typeof makeCamera>, inputService: ReturnType<typeof makeInputService>) =>
      cameraStage(
        { camera, lights },
        { inputService, playerCameraState: cameraStateService, thirdPersonCamera },
        { lastShadowTargetRef, lastRenderDistanceRef },
        { playerPos: { x: 5, y: 64, z: 3 }, renderDistance: 8, markShadowMapDirty: () => {} },
      )

    // Sprinting: Ctrl + W held (not sneaking) → FOV eases above the 75 base.
    // (The test-kit's isKeyPressed is hardcoded false, so drive it directly.)
    const sprintInput = makeInputService()
    Object.assign(sprintInput, {
      isKeyPressed: (key: string) => Effect.succeed(key === 'ControlLeft' || key === KeyMappings.MOVE_FORWARD),
    })
    const sprintCam = makeCamera()
    sprintCam.fov = 75
    yield* runOnce(sprintCam, sprintInput)
    expect(sprintCam.fov).toBeGreaterThan(75)

    // Idle: no movement keys → FOV stays at the base.
    const idleCam = makeCamera()
    idleCam.fov = 75
    yield* runOnce(idleCam, makeInputService())
    expect(idleCam.fov).toBeCloseTo(75)
  }))
})
