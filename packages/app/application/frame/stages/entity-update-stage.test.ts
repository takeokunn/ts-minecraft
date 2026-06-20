import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { BREED_XP_MAX_REWARD, BREED_XP_MIN_REWARD } from '@ts-minecraft/entity/domain/mob/breeding'
import { DROPPED_ITEM_PICKUP_DELAY_TICKS } from '@ts-minecraft/entity/domain/dropped-item'
import { type DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'
import { type DroppedXpOrbEntity } from '@ts-minecraft/entity/domain/dropped-xp-orb'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { isEntityPressingPressurePlate, isPlayerPressingPressurePlate, updatePressurePlateStates } from './entity-update-stage'
import { makeDeps } from '../../../test/frame-handler-test-kit/orchestration/deps'
import { runFrame } from '../../../test/frame-handler-test-kit/orchestration/harness'
import { makeInputService } from '../../../test/frame-handler-test-kit/presentation/input'
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
} from '../../../test/frame-handler-test-kit/presentation/overlay'
import { makeServices } from '../../../test/frame-handler-test-kit/services'

describe('pressure plate redstone player overlap', () => {
  it('treats a player inside the plate column as pressing it', () => {
    expect(isPlayerPressingPressurePlate({ x: 0.5, y: 64, z: 0.5 }, { x: 0, y: 64, z: 0 })).toBe(true)
    expect(isPlayerPressingPressurePlate({ x: 0.99, y: 65.7, z: 0.99 }, { x: 0, y: 64, z: 0 })).toBe(true)
  })

  it('does not press when outside horizontal or vertical bounds', () => {
    const plate = { x: 0, y: 64, z: 0 }

    expect(isPlayerPressingPressurePlate({ x: 1, y: 64, z: 0.5 }, plate)).toBe(false)
    expect(isPlayerPressingPressurePlate({ x: 0.5, y: 63.99, z: 0.5 }, plate)).toBe(false)
    expect(isPlayerPressingPressurePlate({ x: 0.5, y: 66, z: 0.5 }, plate)).toBe(false)
  })

  it('treats a mob AABB overlapping the plate as pressing it', () => {
    const plate = { x: 0, y: 64, z: 0 }

    expect(isEntityPressingPressurePlate({ position: { x: 0.5, y: 64.9, z: 0.5 } }, plate)).toBe(true)
    expect(isEntityPressingPressurePlate({ position: { x: 1.2, y: 64.9, z: 0.5 } }, plate)).toBe(true)
  })

  it('does not press from a mob outside the plate AABB', () => {
    const plate = { x: 0, y: 64, z: 0 }

    expect(isEntityPressingPressurePlate({ position: { x: 1.31, y: 64.9, z: 0.5 } }, plate)).toBe(false)
    expect(isEntityPressingPressurePlate({ position: { x: 0.5, y: 65.1, z: 0.5 } }, plate)).toBe(false)
  })

  it.effect('updates only pressure plate components', () => Effect.gen(function* () {
    const plate: RedstoneComponent = {
      type: RedstoneComponentType.PressurePlate,
      position: { x: 0, y: 64, z: 0 },
      state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const wire: RedstoneComponent = {
      type: RedstoneComponentType.Wire,
      position: { x: 1, y: 64, z: 0 },
      state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const setPressed = vi.fn(() => Effect.succeed(Option.some(plate)))

    yield* updatePressurePlateStates(
      {
        getComponents: () => Effect.succeed([plate, wire]),
        setPressurePlatePressed: setPressed,
      },
      { x: 0.5, y: 64, z: 0.5 },
    )

    expect(setPressed).toHaveBeenCalledOnce()
    expect(setPressed).toHaveBeenCalledWith(plate.position, true)
  }))

  it.effect('presses a plate when a mob is on it even if the player is outside', () => Effect.gen(function* () {
    const plate: RedstoneComponent = {
      type: RedstoneComponentType.PressurePlate,
      position: { x: 0, y: 64, z: 0 },
      state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const setPressed = vi.fn(() => Effect.succeed(Option.some(plate)))

    yield* updatePressurePlateStates(
      {
        getComponents: () => Effect.succeed([plate]),
        setPressurePlatePressed: setPressed,
      },
      { x: 2, y: 64, z: 2 },
      [{ position: { x: 0.5, y: 64.9, z: 0.5 } }],
    )

    expect(setPressed).toHaveBeenCalledOnce()
    expect(setPressed).toHaveBeenCalledWith(plate.position, true)
  }))
})

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

  it.effect('ticks, collects, and renders dropped item entities every frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const collectedItem: DroppedItemEntity = {
      id: 'drop-collected',
      itemType: 'DIRT',
      count: 2,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 3,
      pickupDelayTicks: 0,
    }
    const visibleItem: DroppedItemEntity = {
      id: 'drop-visible',
      itemType: 'STONE',
      count: 1,
      position: { x: 1, y: 64, z: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 0,
      pickupDelayTicks: 4,
    }
    const tickSpy = vi.fn(() => Effect.void)
    const collectSpy = vi.fn(() => Effect.succeed([collectedItem]))
    const getAllSpy = vi.fn(() => Effect.succeed([visibleItem]))
    const addBlockSpy = vi.fn(() => Effect.void)
    const syncItemsSpy = vi.fn(() => Effect.void)
    Object.assign(services.droppedItemService, {
      tick: tickSpy,
      collectWithin: collectSpy,
      getAll: getAllSpy,
    })
    Object.assign(services.inventoryService, { addBlock: addBlockSpy })
    Object.assign(services.droppedItemRenderer, { syncItems: syncItemsSpy })

    yield* runFrame(deps, services)

    expect(tickSpy).toHaveBeenCalledOnce()
    expect(collectSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
    expect(addBlockSpy).toHaveBeenCalledWith(collectedItem.itemType, collectedItem.count)
    expect(syncItemsSpy).toHaveBeenCalledWith([visibleItem], deps.scene, expect.any(Number))
  }))

  it.effect('respawns a collected dropped item when inventory insertion fails', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const collectedItem: DroppedItemEntity = {
      id: 'drop-collected',
      itemType: 'DIRT',
      count: 2,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0.1, y: 0.2, z: 0.3 },
      ageTicks: 3,
      pickupDelayTicks: 0,
    }
    const spawnSpy = vi.fn(() => Effect.succeed({
      ...collectedItem,
      id: 'drop-respawned',
      pickupDelayTicks: DROPPED_ITEM_PICKUP_DELAY_TICKS,
    }))
    Object.assign(services.droppedItemService, {
      collectWithin: vi.fn(() => Effect.succeed([collectedItem])),
      getAll: vi.fn(() => Effect.succeed([])),
      spawn: spawnSpy,
    })
    Object.assign(services.inventoryService, {
      addBlock: vi.fn(() => Effect.fail(new Error('inventory full'))),
    })

    yield* runFrame(deps, services)

    expect(spawnSpy).toHaveBeenCalledWith({
      itemType: collectedItem.itemType,
      count: collectedItem.count,
      position: collectedItem.position,
      velocity: collectedItem.velocity,
      pickupDelayTicks: DROPPED_ITEM_PICKUP_DELAY_TICKS,
    })
  }))

  it.effect('ticks and collects dropped XP orbs through the mending XP path', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const collectedOrb: DroppedXpOrbEntity = {
      id: 'xp-orb-collected',
      amount: 5,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 3,
      pickupDelayTicks: 0,
    }
    const visibleOrb: DroppedXpOrbEntity = {
      id: 'xp-orb-visible',
      amount: 2,
      position: { x: 1, y: 64, z: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 8,
      pickupDelayTicks: 4,
    }
    const tickSpy = vi.fn(() => Effect.void)
    const collectSpy = vi.fn(() => Effect.succeed([collectedOrb]))
    const getAllSpy = vi.fn(() => Effect.succeed([visibleOrb]))
    const inventoryMendingSpy = vi.fn(() => Effect.succeed(3))
    const equipmentMendingSpy = vi.fn(() => Effect.succeed(1))
    const addXPSpy = vi.fn(() => Effect.succeed({ totalXP: 1, level: 0, xpIntoLevel: 1, xpRequiredForNext: 7 }))
    const syncOrbsSpy = vi.fn(() => Effect.void)
    Object.assign(services.droppedXpOrbService, {
      tick: tickSpy,
      collectWithin: collectSpy,
      getAll: getAllSpy,
    })
    Object.assign(services.inventoryService, { repairMendingItemsWithXP: inventoryMendingSpy })
    Object.assign(services.equipmentService, { repairMendingItemsWithXP: equipmentMendingSpy })
    Object.assign(services.xpService, { addXP: addXPSpy })
    Object.assign(services.droppedXpOrbRenderer, { syncOrbs: syncOrbsSpy })

    yield* runFrame(deps, services)

    expect(tickSpy).toHaveBeenCalledWith(1, { x: 0, y: 64, z: 0 })
    expect(collectSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
    expect(inventoryMendingSpy).toHaveBeenCalledWith(5)
    expect(equipmentMendingSpy).toHaveBeenCalledWith(3)
    expect(addXPSpy).toHaveBeenCalledWith(1)
    expect(getAllSpy).toHaveBeenCalledOnce()
    expect(syncOrbsSpy).toHaveBeenCalledWith([visibleOrb], deps.scene, expect.any(Number))
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
    const handler = (deltaTime: DeltaTimeSecs) => Effect.gen(function* () {
      yield* maintenanceHandler()
      yield* frameHandler(deltaTime)
    })
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
    const handler = (deltaTime: DeltaTimeSecs) => Effect.gen(function* () {
      yield* maintenanceHandler()
      yield* frameHandler(deltaTime)
    })
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    const total1 = updateSpy.mock.calls[0]?.[1] as number
    const total2 = updateSpy.mock.calls[1]?.[1] as number
    expect(total2).toBeGreaterThan(total1)
  }))

  it.effect('passes rainy weather as daylight burn protection to entityManager.update', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.weatherService, { getWeather: vi.fn(() => Effect.succeed('rain' as const)) })
    Object.assign(services.entityManager, { update: updateSpy })

    yield* runFrame(deps, services)

    expect(updateSpy).toHaveBeenCalledOnce()
    expect(updateSpy.mock.calls[0]?.[6]).toBe(true)
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
    // 9 chunks for entity physics + 2 for physics-stage portal checks (nether + end)
    // + 5 survival environment reads (feet/eye/ground column + 4 cactus side samples).
    expect(getChunkSpy).toHaveBeenCalledTimes(16)
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

    // frame 1: 9 entity + 2 portals + 5 survival = 16;
    // frame 2: 0 entity (cache hit) + 2 portals + 5 survival = 7 → total 23.
    expect(getChunkSpy).toHaveBeenCalledTimes(23)
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

    // 9 entity ×2 frames + 2 portal checks ×2 + 5 survival environment reads ×2 = 32
    expect(getChunkSpy).toHaveBeenCalledTimes(32)
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

    // 9 entity ×2 frames + 2 portal checks ×2 + 5 survival environment reads ×2 = 32
    expect(getChunkSpy).toHaveBeenCalledTimes(32)
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
      loadChunksAroundPlayer: vi.fn(() => Effect.succeed(false)),
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
    const handler = (deltaTime: DeltaTimeSecs) => Effect.gen(function* () {
      yield* maintenanceHandler()
      yield* frameHandler(deltaTime)
    })
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    // The second frame publishes a new loaded-chunks snapshot, so the physics
    // cache refreshes all 9 neighboring chunks again; survival checks still run each frame.
    expect(getChunkSpy).toHaveBeenCalledTimes(32)
  }))

  it.effect('skips the entity physics chunk cache when physics has no applyPhysics hook', () => Effect.gen(function* () {
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

    yield* services.debugFeatureFlags.setEnabled('mobs.ai', false)
    yield* services.debugFeatureFlags.setEnabled('mobs.damage', false)
    yield* services.debugFeatureFlags.setEnabled('mobs.physics', true)
    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })
    Object.assign(services.entityManager, { applyPhysics: undefined })

    yield* runFrame(deps, services)

    // No 9-chunk entity physics cache refresh; only portal checks and survival environment reads remain.
    expect(getChunkSpy).toHaveBeenCalledTimes(7)
  }))

  it.effect('adds remaining breeding XP after inventory and equipment mending', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const addXPSpy = vi.fn(() => Effect.succeed({ totalXP: 3, level: 0, xpIntoLevel: 3, xpRequiredForNext: 7 }))
    const inventoryMendingSpy = vi.fn(() => Effect.succeed(BREED_XP_MIN_REWARD + 4))
    const equipmentMendingSpy = vi.fn(() => Effect.succeed(3))
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999_999)

    Object.assign(services.entityManager, {
      drainBirths: vi.fn(() => Effect.succeed(2)),
    })
    Object.assign(services.inventoryService, {
      repairMendingItemsWithXP: inventoryMendingSpy,
    })
    Object.assign(services.equipmentService, {
      repairMendingItemsWithXP: equipmentMendingSpy,
    })
    Object.assign(services.xpService, {
      addXP: addXPSpy,
    })

    yield* Effect.acquireUseRelease(
      Effect.succeed(randomSpy),
      () => runFrame(deps, services),
      (spy) => Effect.sync(() => spy.mockRestore()),
    )

    expect(inventoryMendingSpy).toHaveBeenCalledWith(BREED_XP_MIN_REWARD + BREED_XP_MAX_REWARD)
    expect(equipmentMendingSpy).toHaveBeenCalledWith(BREED_XP_MIN_REWARD + 4)
    expect(addXPSpy).toHaveBeenCalledWith(3)
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
    const handler = (deltaTime: DeltaTimeSecs) => Effect.gen(function* () {
      yield* maintenanceHandler()
      yield* frameHandler(deltaTime)
    })
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
