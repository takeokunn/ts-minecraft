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
})
