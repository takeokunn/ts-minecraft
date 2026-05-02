import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 2.85: Entity renderer wiring
// ---------------------------------------------------------------------------

describe('step 2.85 — entity renderer wiring', () => {
  it.effect('calls entityRenderer.syncEntities on the first frame with the live entity snapshot', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entitiesStub = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }] as unknown as ReadonlyArray<unknown>
    ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed(entitiesStub)
    )
    const syncSpy = vi.fn(() => Effect.void)
    ;(services.entityRenderer as unknown as { syncEntities: unknown }).syncEntities = syncSpy

    yield* runFrame(deps, services)

    expect(syncSpy).toHaveBeenCalledOnce()
    // First arg is the snapshot, second arg is the scene
    expect(syncSpy.mock.calls[0]?.[0]).toBe(entitiesStub)
    expect(syncSpy.mock.calls[0]?.[1]).toBe(deps.scene)
  }))

  it.effect('skips entityRenderer.syncEntities when entity structure version is unchanged', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entitiesStub = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }] as unknown as ReadonlyArray<unknown>
    ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed(entitiesStub)
    )
    ;(services.entityManager as unknown as { getStructureVersion: unknown }).getStructureVersion = vi.fn(() =>
      Effect.succeed(7)
    )
    const syncSpy = vi.fn(() => Effect.void)
    ;(services.entityRenderer as unknown as { syncEntities: unknown }).syncEntities = syncSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    expect(syncSpy).toHaveBeenCalledTimes(1)
  }))

  it.effect('calls entityRenderer.updateEntityTransforms with deltaTime each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.entityRenderer as unknown as { updateEntityTransforms: unknown }).updateEntityTransforms = updateSpy

    yield* runFrame(deps, services)

    expect(updateSpy).toHaveBeenCalledOnce()
    // (entities, totalTimeSecs, deltaTimeSecs)
    const callArgs = updateSpy.mock.calls[0] as readonly [unknown, number, number]
    expect(callArgs[2]).toBeCloseTo(0.016)
  }))

  it.effect('passes monotonically growing totalTimeSecs to updateEntityTransforms', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.entityRenderer as unknown as { updateEntityTransforms: unknown }).updateEntityTransforms = updateSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    const total1 = updateSpy.mock.calls[0]?.[1] as number
    const total2 = updateSpy.mock.calls[1]?.[1] as number
    expect(total2).toBeGreaterThan(total1)
  }))
})
