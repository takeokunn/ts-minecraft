import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef, Option } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import { DESPAWN_DISTANCE } from '@ts-minecraft/entities'
import { CHUNK_HEIGHT, CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/kernel'
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
      resolveSpawn({ x: 1.5, y: 64, z: 2.5 }).pipe(
        Effect.map((resolvedPosition) => {
          expect(Option.isSome(resolvedPosition)).toBe(true)
          const position = Option.getOrThrow(resolvedPosition)
          expect(position.x).toBe(1.5)
          expect(position.z).toBe(2.5)
          expect(position.y).toBeCloseTo(11.9)
          return Option.none()
        }),
      ),
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
