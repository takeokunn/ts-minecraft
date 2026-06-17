import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { runMaintenanceDirtyChunkFlush } from './frame-maintenance-sync-dirty'
import type { DirtyChunkEntry } from './frame-maintenance-dirty'
import { arrangeFrameHarness } from '../../test/frame-handler-test-kit'
import type { Chunk } from '@ts-minecraft/world'

const makeMaintenanceDirtyFlushState = () => ({
  dirtyChunksRef: MutableRef.make(HashMap.empty<string, DirtyChunkEntry>()),
})

describe('frame-maintenance / dirty chunk flush helper', () => {
  it.effect('drains render-dirty entries and flushes them into the scene', () =>
    Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const blocks = new Uint8Array(16 * 16 * 256)
      const chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() } as Chunk
      const entry: DirtyChunkEntry = { chunk, dirtyAABB: Option.none() }

      Object.assign(services.chunkManagerService, {
        drainRenderDirtyChunkEntries: vi.fn(() => Effect.succeed([entry])),
      })
      const updateSpy = vi.fn(() => Effect.void)
      Object.assign(services.worldRendererService, { updateChunkInScene: updateSpy })
      const invalidateSpy = vi.fn(() => Effect.void)
      Object.assign(services.blockHighlight, { invalidateCache: invalidateSpy })

      const flushed = yield* runMaintenanceDirtyChunkFlush(
        deps,
        { chunkManagerService: services.chunkManagerService, worldRendererService: services.worldRendererService, blockHighlight: services.blockHighlight },
        makeMaintenanceDirtyFlushState(),
        true,
      )

      expect(flushed).toBe(1)
      expect(updateSpy).toHaveBeenCalledOnce()
      expect(invalidateSpy).toHaveBeenCalledOnce()
    }),
  )

  it.effect('skips drain and flush when dirtyChunkFlushEnabled is false', () =>
    Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const drainSpy = vi.fn(() => Effect.succeed([] as ReadonlyArray<DirtyChunkEntry>))
      Object.assign(services.chunkManagerService, { drainRenderDirtyChunkEntries: drainSpy })

      const flushed = yield* runMaintenanceDirtyChunkFlush(
        deps,
        { chunkManagerService: services.chunkManagerService, worldRendererService: services.worldRendererService, blockHighlight: services.blockHighlight },
        makeMaintenanceDirtyFlushState(),
        false,
      )

      expect(flushed).toBe(0)
      expect(drainSpy).not.toHaveBeenCalled()
    }),
  )
})
