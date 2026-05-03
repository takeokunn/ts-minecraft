import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef } from 'effect'
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
    const entitiesStub: ReadonlyArray<unknown> = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }]
    Object.assign(services.entityManager, { getEntities: vi.fn(() => Effect.succeed(entitiesStub)) })
    const syncSpy = vi.fn(() => Effect.void)
    Object.assign(services.entityRenderer, { syncEntities: syncSpy })

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
    const entitiesStub: ReadonlyArray<unknown> = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }]
    Object.assign(services.entityManager, {
      getEntities: vi.fn(() => Effect.succeed(entitiesStub)),
      getStructureVersion: vi.fn(() => Effect.succeed(7)),
    })
    const syncSpy = vi.fn(() => Effect.void)
    Object.assign(services.entityRenderer, { syncEntities: syncSpy })

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
    Object.assign(services.entityRenderer, { updateEntityTransforms: updateSpy })

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
    Object.assign(services.entityRenderer, { updateEntityTransforms: updateSpy })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    const total1 = updateSpy.mock.calls[0]?.[1] as number
    const total2 = updateSpy.mock.calls[1]?.[1] as number
    expect(total2).toBeGreaterThan(total1)
  }))

  it.effect('redstone and fluid tick are called multiple times when deltaTime covers multiple intervals', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // REDSTONE_TICK_INTERVAL_SECS = FLUID_TICK_INTERVAL_SECS = 0.05
    // deltaTime = 0.12 → Math.floor(0.12 / 0.05) = 2 → ticksToRun > 1 branch
    // Effect.repeatN repeats the Effect value, so use Effect.sync to count executions
    const redstoneCountRef = MutableRef.make(0)
    const fluidCountRef = MutableRef.make(0)
    Object.assign(services.redstoneService, {
      tick: () => Effect.sync(() => { MutableRef.update(redstoneCountRef, n => n + 1); return { tick: 0, poweredPositions: [] } }),
    })
    Object.assign(services.fluidService, {
      tick: () => Effect.sync(() => { MutableRef.update(fluidCountRef, n => n + 1) }),
    })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.12 as DeltaTimeSecs)

    expect(MutableRef.get(redstoneCountRef)).toBeGreaterThan(1)
    expect(MutableRef.get(fluidCountRef)).toBeGreaterThan(1)
  }))
})
