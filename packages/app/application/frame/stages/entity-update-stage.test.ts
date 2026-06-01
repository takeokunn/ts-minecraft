import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
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

  it.effect('calls entityManager.applyPhysics with a collision resolver backed by the chunk cache', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const getChunkSpy = vi.fn(() => Effect.succeed({
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(16 * 16 * 256),
      dirty: false,
    }))
    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })

    const applyPhysicsSpy = vi.fn((deltaTime: number, resolveCollision: (position: Position, velocity: Vector3) => {
      readonly position: Position
      readonly velocity: Vector3
      readonly isGrounded: boolean
    }) => Effect.sync(() => {
      const resolved = resolveCollision(
        { x: 0, y: -1, z: 0 },
        { x: 0, y: -1, z: 0 },
      )

      expect(deltaTime).toBeCloseTo(0.016)
      expect(resolved.isGrounded).toBe(true)
      expect(resolved.position.y).toBeGreaterThan(0)
    }))
    Object.assign(services.entityManager, { applyPhysics: applyPhysicsSpy })

    yield* runFrame(deps, services)

    expect(applyPhysicsSpy).toHaveBeenCalledOnce()
    expect(getChunkSpy).toHaveBeenCalledTimes(9)
  }))

  it.effect('reuses the entity physics chunk cache while the player remains in the same chunk', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const getChunkSpy = vi.fn(() => Effect.succeed({
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(16 * 16 * 256),
      dirty: false,
    }))
    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })
    Object.assign(services.entityManager, {
      applyPhysics: vi.fn(() => Effect.void),
    })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(getChunkSpy).toHaveBeenCalledTimes(9)
  }))

  it.effect('retries missing entity physics chunks while the player remains in the same chunk', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const chunk = {
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(16 * 16 * 256),
      dirty: false,
    }
    let getChunkCallCount = 0
    const getChunkSpy = vi.fn(() => {
      getChunkCallCount += 1
      return getChunkCallCount <= 9 ? Effect.fail(new Error('chunk unavailable')) : Effect.succeed(chunk)
    })
    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })
    Object.assign(services.entityManager, {
      applyPhysics: vi.fn(() => Effect.void),
    })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(getChunkSpy).toHaveBeenCalledTimes(18)
  }))

  it.effect('refreshes the entity physics chunk cache when the player enters another chunk', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const getChunkSpy = vi.fn(() => Effect.succeed({
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(16 * 16 * 256),
      dirty: false,
    }))
    let positionReadCount = 0
    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })
    Object.assign(services.entityManager, {
      applyPhysics: vi.fn(() => Effect.void),
    })
    Object.assign(services.gameState, {
      getPlayerPosition: vi.fn(() => {
        const frameIndex = Math.floor(positionReadCount / 2)
        positionReadCount += 1
        return Effect.succeed(frameIndex === 0 ? { x: 0, y: 64, z: 0 } : { x: 16, y: 64, z: 0 })
      }),
    })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(getChunkSpy).toHaveBeenCalledTimes(18)
  }))

  it.effect('refreshes the entity physics chunk cache when loaded chunks change', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const firstLoadedChunks: ReadonlyArray<unknown> = []
    const secondLoadedChunks: ReadonlyArray<unknown> = [{ coord: { x: 0, z: 0 } }]
    const getChunkSpy = vi.fn(() => Effect.succeed({
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(16 * 16 * 256),
      dirty: false,
    }))
    let loadedChunksReadCount = 0
    let syncCount = 0
    Object.assign(services.chunkManagerService, {
      getChunk: getChunkSpy,
      getLoadedChunks: vi.fn(() => {
        loadedChunksReadCount += 1
        return Effect.succeed(loadedChunksReadCount === 1 ? firstLoadedChunks : secondLoadedChunks)
      }),
    })
    Object.assign(services.worldRendererService, {
      syncChunksToScene: vi.fn(() => {
        syncCount += 1
        return Effect.succeed(syncCount > 1)
      }),
    })
    Object.assign(services.entityManager, {
      applyPhysics: vi.fn(() => Effect.void),
    })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    expect(getChunkSpy).toHaveBeenCalledTimes(18)
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

  it.effect('skips mob, redstone, fluid, and particle work when debug flags disable them', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    yield* services.debugFeatureFlags.setEnabled('mobs.ai', false)
    yield* services.debugFeatureFlags.setEnabled('mobs.physics', false)
    yield* services.debugFeatureFlags.setEnabled('mobs.render', false)
    yield* services.debugFeatureFlags.setEnabled('simulation.redstone', false)
    yield* services.debugFeatureFlags.setEnabled('simulation.fluid', false)
    yield* services.debugFeatureFlags.setEnabled('particles.update', false)

    const updateSpy = vi.fn(() => Effect.void)
    const applyPhysicsSpy = vi.fn(() => Effect.void)
    const syncSpy = vi.fn(() => Effect.void)
    const transformSpy = vi.fn(() => Effect.void)
    const redstoneSpy = vi.fn(() => Effect.succeed({ tick: 0, poweredPositions: [] }))
    const fluidSpy = vi.fn(() => Effect.void)
    const particleSpy = vi.fn(() => Effect.void)
    Object.assign(services.entityManager, { update: updateSpy, applyPhysics: applyPhysicsSpy })
    Object.assign(services.entityRenderer, { syncEntities: syncSpy, updateEntityTransforms: transformSpy })
    Object.assign(services.redstoneService, { tick: redstoneSpy })
    Object.assign(services.fluidService, { tick: fluidSpy })
    Object.assign(services.particleSystem, { update: particleSpy })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.12 as DeltaTimeSecs)

    expect(updateSpy).not.toHaveBeenCalled()
    expect(applyPhysicsSpy).not.toHaveBeenCalled()
    expect(syncSpy).toHaveBeenCalledOnce()
    expect(syncSpy).toHaveBeenCalledWith([], deps.scene)
    expect(transformSpy).not.toHaveBeenCalled()
    expect(redstoneSpy).not.toHaveBeenCalled()
    expect(fluidSpy).not.toHaveBeenCalled()
    expect(particleSpy).not.toHaveBeenCalled()
  }))
})
