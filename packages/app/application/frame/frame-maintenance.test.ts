import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Duration, Effect, MutableRef, Option, TestClock } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import { DESPAWN_DISTANCE } from '@ts-minecraft/entity'
import { LIGHT_BYTE_LENGTH, setLightAt } from '@ts-minecraft/block'
import { CHUNK_HEIGHT, CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// frame-maintenance — session-pause gate
// FR-1.4: ALL maintenance work is gated behind sessionPausedRef.
// Auto-save (forkDaemon in main.ts) is intentionally not in this handler.
// ---------------------------------------------------------------------------

describe('frame-maintenance / session-pause gate', () => {
  it.effect('returns false and skips ALL maintenance work when sessionPausedRef is true', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)

    // Set sessionPausedRef to true — simulates the tab being backgrounded / session paused.
    MutableRef.set(deps.sessionPausedRef, true)

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const loadSpy = vi.fn(() => Effect.succeed(true as boolean))
    const syncSpy = vi.fn(() => Effect.succeed(true as boolean))
    const getChunksSpy = vi.fn(() => Effect.succeed([] as never[]))
    const furnaceTickSpy = vi.fn((_dt: DeltaTimeSecs) => Effect.void)
    const mobSpawnSpy = vi.fn(() => Effect.succeed(undefined))

    Object.assign(services.chunkManagerService, {
      loadChunksAroundPlayer: loadSpy,
      getLoadedChunks: getChunksSpy,
    })
    Object.assign(services.worldRendererService, { syncChunksToScene: syncSpy })
    Object.assign(services.furnaceService, { tick: furnaceTickSpy })
    Object.assign(services.mobSpawner, { trySpawn: mobSpawnSpy })

    const { maintenanceHandler } = yield* createFrameHandlers(deps, services)

    const result = yield* maintenanceHandler()

    // Must return false (no work done) and must not have invoked any service.
    expect(result).toBe(false)
    expect(loadSpy).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()
    expect(getChunksSpy).not.toHaveBeenCalled()
    expect(furnaceTickSpy).not.toHaveBeenCalled()
    expect(mobSpawnSpy).not.toHaveBeenCalled()
  }))

  it.effect('returns a truthy result and calls loadChunksAroundPlayer when sessionPausedRef is false', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    // sessionPausedRef defaults to false in makeDeps — maintenance should proceed.

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const loadSpy = vi.fn(() => Effect.succeed(true as boolean))
    Object.assign(services.chunkManagerService, { loadChunksAroundPlayer: loadSpy })

    const { maintenanceHandler } = yield* createFrameHandlers(deps, services)

    yield* maintenanceHandler()

    // Maintenance work must have run.
    expect(loadSpy).toHaveBeenCalledOnce()
  }))

  it.effect('passes a terrain-aware spawn resolver and runs entity cleanup before spawning', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceY = 10
    const localX = 1
    const localZ = 2
    const surfaceIndex = surfaceY + localZ * CHUNK_HEIGHT + localX * CHUNK_HEIGHT * CHUNK_SIZE
    blocks[surfaceIndex] = 1

    const getChunkSpy = vi.fn(() => Effect.succeed({
      coord: { x: 0, z: 0 },
      blocks,
      dirty: false,
    }))
    const despawnSpy = vi.fn((_playerPosition: Position, _maxDistance: number) => Effect.succeed(0))
    const mobSpawnSpy = vi.fn((_playerPosition: Position, resolveSpawn: (candidatePosition: Position) => Effect.Effect<Option.Option<Position>, never>) =>
      Effect.gen(function* () {
        const resolvedPosition = yield* resolveSpawn({ x: 1.5, y: 64, z: 2.5 })
        expect(Option.isSome(resolvedPosition)).toBe(true)
        const position = Option.getOrThrow(resolvedPosition)
        expect(position.x).toBe(1.5)
        expect(position.z).toBe(2.5)
        expect(position.y).toBeCloseTo(11.9)
        return Option.none()
      }),
    )

    Object.assign(services.chunkManagerService, { getChunk: getChunkSpy })
    Object.assign(services.entityManager, { despawnFarEntities: despawnSpy })
    Object.assign(services.mobSpawner, { trySpawn: mobSpawnSpy })

    const { maintenanceHandler } = yield* createFrameHandlers(deps, services)

    yield* maintenanceHandler()

    expect(despawnSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, DESPAWN_DISTANCE)
    expect(mobSpawnSpy).toHaveBeenCalledOnce()
    expect(getChunkSpy).toHaveBeenCalledWith({ x: 0, z: 0 })
  }))
})

describe('frame-maintenance / resolveTerrainSpawnPosition edge cases', () => {
  // Helper: creates a maintenance-capable service set with custom chunk data and spawn spy
  const makeMaintenanceServices = (blocks: Uint8Array, spawnCallback: (resolver: (p: Position) => Effect.Effect<Option.Option<Position>, never>) => Effect.Effect<Option.Option<Position>, never>) => {
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.chunkManagerService, { getChunk: vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks })) })
    Object.assign(services.entityManager, { despawnFarEntities: vi.fn((_p: Position, _d: number) => Effect.succeed(0)) })
    Object.assign(services.mobSpawner, {
      trySpawn: vi.fn((_pos: Position, resolver: (p: Position) => Effect.Effect<Option.Option<Position>, never>) =>
        spawnCallback(resolver),
      ),
    })
    return services
  }

  it.effect('rejects a candidate where headBlockY would exceed CHUNK_HEIGHT (top-of-chunk guard)', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      // Solid at y = CHUNK_HEIGHT - 2 → bodyBlockY = CHUNK_HEIGHT - 1, headBlockY = CHUNK_HEIGHT ≥ limit
      // blockIndex = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      blocks[(CHUNK_HEIGHT - 2) + 2 * CHUNK_HEIGHT + 1 * CHUNK_HEIGHT * CHUNK_SIZE] = 1

      const results: Option.Option<Position>[] = []
      const services = makeMaintenanceServices(blocks, (resolver) =>
        Effect.gen(function* () {
          const r = yield* resolver({ x: 1.5, y: 64, z: 2.5 })
          results.push(r)
          return Option.none<Position>()
        })
      )

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(Option.isNone(results[0]!)).toBe(true)
    })
  )

  it.effect('rejects a candidate in an all-air column (no surface found)', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) // all zeros = all AIR

      const results: Option.Option<Position>[] = []
      const services = makeMaintenanceServices(blocks, (resolver) =>
        Effect.gen(function* () {
          const r = yield* resolver({ x: 1.5, y: 64, z: 2.5 })
          results.push(r)
          return Option.none<Position>()
        })
      )

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(Option.isNone(results[0]!)).toBe(true)
    })
  )

  // R25: light-level hostile spawning. At night (hostile spawn), a torch-lit
  // surface must reject the spawn; a dark surface must allow it.
  it.effect('rejects a night/hostile spawn on a torch-lit surface (blockLight > threshold)', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      // Solid surface at y=64 (lx=1, lz=2) → bodyBlockY=65, headBlockY=66 (air).
      blocks[64 + 2 * CHUNK_HEIGHT + 1 * CHUNK_HEIGHT * CHUNK_SIZE] = 1
      const blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)
      setLightAt(blockLight, 1, 65, 2, 14) // bright (>7) at the feet voxel

      const results: Option.Option<Position>[] = []
      const services = makeMaintenanceServices(blocks, (resolver) =>
        Effect.gen(function* () {
          const r = yield* resolver({ x: 1.5, y: 64, z: 2.5 })
          results.push(r)
          return Option.none<Position>()
        })
      )
      Object.assign(services.chunkManagerService, { getChunk: vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks, blockLight })) })
      Object.assign(services.timeService, { getTimeOfDay: vi.fn(() => Effect.succeed(0)) }) // midnight → hostile

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(Option.isNone(results[0]!)).toBe(true)
    })
  )

  it.effect('allows a night/hostile spawn on a dark surface (blockLight ≤ threshold)', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      blocks[64 + 2 * CHUNK_HEIGHT + 1 * CHUNK_HEIGHT * CHUNK_SIZE] = 1
      const blockLight = new Uint8Array(LIGHT_BYTE_LENGTH) // all-dark

      const results: Option.Option<Position>[] = []
      const services = makeMaintenanceServices(blocks, (resolver) =>
        Effect.gen(function* () {
          const r = yield* resolver({ x: 1.5, y: 64, z: 2.5 })
          results.push(r)
          return Option.none<Position>()
        })
      )
      Object.assign(services.chunkManagerService, { getChunk: vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks, blockLight })) })
      Object.assign(services.timeService, { getTimeOfDay: vi.fn(() => Effect.succeed(0)) }) // midnight → hostile

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(Option.isSome(results[0]!)).toBe(true)
    })
  )
})

describe('frame-maintenance / dirty chunk queue processing', () => {
  it.effect('queues render-dirty entries when drainRenderDirtyChunkEntries returns non-empty list', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const fakeChunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
      const fakeEntry = { chunk: fakeChunk, dirtyAABB: Option.none() }

      // Return 1 dirty entry → enters the if (renderDirtyEntries.length > 0) block
      Object.assign(services.chunkManagerService, {
        drainRenderDirtyChunkEntries: vi.fn(() => Effect.succeed([fakeEntry])),
      })
      const updateSpy = vi.fn(() => Effect.void)
      Object.assign(services.worldRendererService, { updateChunkInScene: updateSpy })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      // The dirty entry was queued and then flushed via updateChunkInScene
      expect(updateSpy).toHaveBeenCalled()
    })
  )

  it.effect('unions AABB when the same chunk appears twice in dirty entries (onSome merge path)', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const fakeChunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
      const entry1 = { chunk: fakeChunk, dirtyAABB: Option.some({ minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 5 }) }
      const entry2 = { chunk: fakeChunk, dirtyAABB: Option.some({ minX: 3, maxX: 10, minY: 3, maxY: 10, minZ: 3, maxZ: 10 }) }

      // Two entries for the SAME chunk → first is onNone, second is onSome (AABB union)
      Object.assign(services.chunkManagerService, {
        drainRenderDirtyChunkEntries: vi.fn(() => Effect.succeed([entry1, entry2])),
      })
      const updateSpy = vi.fn(() => Effect.void)
      Object.assign(services.worldRendererService, { updateChunkInScene: updateSpy })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(updateSpy).toHaveBeenCalled()
    })
  )
})

describe('frame-maintenance / mobs disabled path', () => {
  it.effect('calls despawnAllEntities instead of despawnFarEntities when mobs.enabled is false', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      yield* services.debugFeatureFlags.setEnabled('mobs.enabled', false)
      const despawnAllSpy = vi.fn(() => Effect.succeed(2))
      const despawnFarSpy = vi.fn((_p: Position, _d: number) => Effect.succeed(0))
      Object.assign(services.entityManager, { despawnAllEntities: despawnAllSpy, despawnFarEntities: despawnFarSpy })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      expect(despawnAllSpy).toHaveBeenCalledOnce()
      expect(despawnFarSpy).not.toHaveBeenCalled()
    })
  )
})

describe('frame-maintenance / dirty chunk flush disabled', () => {
  it.effect('skips dirty chunk flush when world.dirtyChunkFlush is disabled', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      yield* services.debugFeatureFlags.setEnabled('world.dirtyChunkFlush', false)
      const drainSpy = vi.fn(() => Effect.succeed([]))
      Object.assign(services.chunkManagerService, { drainRenderDirtyChunkEntries: drainSpy })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()

      // dirtyChunkFlushEnabled = false → drainRenderDirtyChunkEntries not called
      expect(drainSpy).not.toHaveBeenCalled()
    })
  )
})

// ---------------------------------------------------------------------------
// frame-maintenance — real-time delta (frame-rate / load independent)
// The maintenance loop sleeps 16ms (busy) or 48ms (idle) + its own execution
// time, so the cadence is variable. Furnace / crop / village simulation must
// advance by the REAL elapsed time, not a hardcoded 0.05 — otherwise they run
// up to ~3x too fast under load.
// ---------------------------------------------------------------------------
describe('frame-maintenance / real-time delta', () => {
  it.effect('feeds furnace tick the real elapsed seconds, not a fixed 0.05', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      const furnaceDeltas: number[] = []
      Object.assign(services.furnaceService, {
        tick: vi.fn((dt: DeltaTimeSecs) => {
          furnaceDeltas.push(Number(dt))
          return Effect.void
        }),
      })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)

      // First iteration: no prior timestamp → falls back to the idle cadence (~0.05).
      yield* maintenanceHandler()
      // 120ms of real wall-clock elapses before the next maintenance iteration.
      yield* TestClock.adjust(Duration.millis(120))
      yield* maintenanceHandler()

      expect(furnaceDeltas).toHaveLength(2)
      expect(furnaceDeltas[0]).toBeCloseTo(0.05, 5) // first-call fallback
      expect(furnaceDeltas[1]).toBeCloseTo(0.12, 5) // 120ms real → 0.12s, NOT the old constant
    })
  )

  it.effect('clamps an extreme gap (background-tab resume) to 0.25s', () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      const furnaceDeltas: number[] = []
      Object.assign(services.furnaceService, {
        tick: vi.fn((dt: DeltaTimeSecs) => {
          furnaceDeltas.push(Number(dt))
          return Effect.void
        }),
      })

      const { maintenanceHandler } = yield* createFrameHandlers(deps, services)
      yield* maintenanceHandler()
      // 30 real seconds (a long background-tab pause) must not dump 30s into the furnace.
      yield* TestClock.adjust(Duration.seconds(30))
      yield* maintenanceHandler()

      expect(furnaceDeltas[1]).toBeCloseTo(0.25, 5)
    })
  )
})
