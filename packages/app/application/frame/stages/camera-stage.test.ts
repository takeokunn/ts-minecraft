import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet } from 'effect'
import { KeyMappings } from '@ts-minecraft/input-handler'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

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
    ;(services.gameState as unknown as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
      Effect.succeed({ x: 5, y: 64, z: 3 })
    )

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
    ;(services.gameState as unknown as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
      Effect.succeed({ x: 5, y: 64, z: 3 })
    )

    yield* runFrame(deps, services)

    expect(services.cameraState.mode).toBe('thirdPerson')
    expect(deps.camera.position.x).toBeCloseTo(5)
    expect(deps.camera.position.y).toBeCloseTo(64 + 0.72 + 1.5)
    expect(deps.camera.position.z).toBeCloseTo(3 - 4)
  }))
})
