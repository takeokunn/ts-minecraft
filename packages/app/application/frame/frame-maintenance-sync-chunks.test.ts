import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { DEFAULT_SETTINGS, arrangeFrameHarness } from '../../test/frame-handler-test-kit'
import { runMaintenanceChunkSceneSync } from './frame-maintenance-sync-chunks'

const makeChunkSyncState = () => ({
  lastLoadedChunksRef: MutableRef.make<Option.Option<ReadonlyArray<unknown>>>(Option.none()),
  lastChunkStreamingRef: MutableRef.make({ cx: NaN, cz: NaN, renderDistance: NaN }),
  chunkSyncPendingRef: MutableRef.make(false),
})

describe('frame-maintenance / chunk scene sync', () => {
  it.effect('skips chunk work when streaming is disabled', () =>
    Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const loadSpy = vi.fn(() => Effect.succeed(true))
      const syncSpy = vi.fn(() => Effect.succeed(true))
      const getChunksSpy = vi.fn(() => Effect.succeed([] as never[]))

      Object.assign(services.chunkManagerService, {
        loadChunksAroundPlayer: loadSpy,
        getLoadedChunks: getChunksSpy,
      })
      Object.assign(services.worldRendererService, { syncChunksToScene: syncSpy })

      const result = yield* runMaintenanceChunkSceneSync(deps, {
        chunkManagerService: services.chunkManagerService,
        worldRendererService: services.worldRendererService,
        fluidService: services.fluidService,
        blockHighlight: services.blockHighlight,
      }, makeChunkSyncState(), {
        chunkStreamingEnabled: false,
        chunkSceneSyncEnabled: true,
        cx: 0,
        cz: 0,
        playerPos: { x: 0, y: 64, z: 0 },
        renderDistance: DEFAULT_SETTINGS.renderDistance,
      })

      expect(result).toBe(false)
      expect(loadSpy).not.toHaveBeenCalled()
      expect(syncSpy).not.toHaveBeenCalled()
      expect(getChunksSpy).not.toHaveBeenCalled()
    }))

  it.effect('loads chunks and syncs the scene when the streaming position changes', () =>
    Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const loadedChunks = [{ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }]
      const loadSpy = vi.fn(() => Effect.succeed(true))
      const getChunksSpy = vi.fn(() => Effect.succeed(loadedChunks))
      const syncSpy = vi.fn(() => Effect.succeed(true))
      const fluidSpy = vi.fn(() => Effect.void)
      const invalidateSpy = vi.fn(() => Effect.void)

      Object.assign(services.chunkManagerService, {
        loadChunksAroundPlayer: loadSpy,
        getLoadedChunks: getChunksSpy,
      })
      Object.assign(services.worldRendererService, { syncChunksToScene: syncSpy })
      Object.assign(services.fluidService, { syncLoadedChunks: fluidSpy })
      Object.assign(services.blockHighlight, { invalidateCache: invalidateSpy })

      const state = makeChunkSyncState()
      const result = yield* runMaintenanceChunkSceneSync(deps, {
        chunkManagerService: services.chunkManagerService,
        worldRendererService: services.worldRendererService,
        fluidService: services.fluidService,
        blockHighlight: services.blockHighlight,
      }, state, {
        chunkStreamingEnabled: true,
        chunkSceneSyncEnabled: true,
        cx: 1,
        cz: 2,
        playerPos: { x: 0, y: 64, z: 0 },
        renderDistance: DEFAULT_SETTINGS.renderDistance,
      })

      expect(result).toBe(true)
      expect(loadSpy).toHaveBeenCalledOnce()
      expect(getChunksSpy).toHaveBeenCalledOnce()
      expect(syncSpy).toHaveBeenCalledOnce()
      expect(fluidSpy).toHaveBeenCalledOnce()
      expect(invalidateSpy).toHaveBeenCalledOnce()
      expect(Option.getOrNull(MutableRef.get(state.lastLoadedChunksRef))).toEqual(loadedChunks)
      expect(MutableRef.get(state.chunkSyncPendingRef)).toBe(false)
      expect(MutableRef.get(state.lastChunkStreamingRef)).toEqual({ cx: 1, cz: 2, renderDistance: DEFAULT_SETTINGS.renderDistance })
    }))

  it.effect('retries a pending scene sync without reloading chunks', () =>
    Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const loadedChunks = [{ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }]
      const loadSpy = vi.fn(() => Effect.succeed(true))
      const getChunksSpy = vi.fn(() => Effect.succeed(loadedChunks))
      const syncSpy = vi.fn(() => Effect.succeed(true))
      const fluidSpy = vi.fn(() => Effect.void)
      const invalidateSpy = vi.fn(() => Effect.void)

      Object.assign(services.chunkManagerService, {
        loadChunksAroundPlayer: loadSpy,
        getLoadedChunks: getChunksSpy,
      })
      Object.assign(services.worldRendererService, { syncChunksToScene: syncSpy })
      Object.assign(services.fluidService, { syncLoadedChunks: fluidSpy })
      Object.assign(services.blockHighlight, { invalidateCache: invalidateSpy })

      const state = makeChunkSyncState()
      MutableRef.set(state.lastLoadedChunksRef, Option.some(loadedChunks))
      MutableRef.set(state.chunkSyncPendingRef, true)
      MutableRef.set(state.lastChunkStreamingRef, { cx: 0, cz: 0, renderDistance: DEFAULT_SETTINGS.renderDistance })

      const result = yield* runMaintenanceChunkSceneSync(deps, {
        chunkManagerService: services.chunkManagerService,
        worldRendererService: services.worldRendererService,
        fluidService: services.fluidService,
        blockHighlight: services.blockHighlight,
      }, state, {
        chunkStreamingEnabled: true,
        chunkSceneSyncEnabled: true,
        cx: 0,
        cz: 0,
        playerPos: { x: 0, y: 64, z: 0 },
        renderDistance: DEFAULT_SETTINGS.renderDistance,
      })

      expect(result).toBe(false)
      expect(loadSpy).not.toHaveBeenCalled()
      expect(getChunksSpy).toHaveBeenCalledOnce()
      expect(syncSpy).toHaveBeenCalledOnce()
      expect(fluidSpy).not.toHaveBeenCalled()
      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(MutableRef.get(state.chunkSyncPendingRef)).toBe(false)
      expect(Option.getOrNull(MutableRef.get(state.lastLoadedChunksRef))).toEqual(loadedChunks)
    }))
})
