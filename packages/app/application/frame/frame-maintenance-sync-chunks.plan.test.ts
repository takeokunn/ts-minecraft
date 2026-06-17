import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import type { Chunk } from '@ts-minecraft/world'
import {
  resolveMaintenanceChunkSceneSyncPlan,
  resolveMaintenanceChunkSyncPlan,
} from './frame-maintenance-sync-chunks.plan'
import { DEFAULT_SETTINGS } from '../../test/frame-handler-test-kit'

const makeChunk = (): Chunk =>
  ({
    coord: { x: 0, z: 0 },
    blocks: new Uint8Array(16 * 16 * 256),
    fluid: Option.none(),
  }) as Chunk

describe('frame-maintenance / chunk sync plan', () => {
  it('requests a refresh when chunk streaming is enabled and the position changes', () => {
    const plan = resolveMaintenanceChunkSyncPlan(
      {
        chunkStreamingEnabled: true,
        chunkSceneSyncEnabled: false,
        cx: 1,
        cz: 2,
        playerPos: { x: 0, y: 64, z: 0 },
        renderDistance: DEFAULT_SETTINGS.renderDistance,
      },
      false,
      { cx: 0, cz: 0, renderDistance: DEFAULT_SETTINGS.renderDistance },
    )

    expect(plan.shouldRefreshChunks).toBe(true)
  })

  it('skips a refresh when streaming is disabled', () => {
    const plan = resolveMaintenanceChunkSyncPlan(
      {
        chunkStreamingEnabled: false,
        chunkSceneSyncEnabled: false,
        cx: 1,
        cz: 2,
        playerPos: { x: 0, y: 64, z: 0 },
        renderDistance: DEFAULT_SETTINGS.renderDistance,
      },
      true,
      { cx: 0, cz: 0, renderDistance: DEFAULT_SETTINGS.renderDistance },
    )

    expect(plan.shouldRefreshChunks).toBe(false)
  })

  it('treats changed loaded-chunk snapshots as a scene-sync trigger', () => {
    const loadedChunks = [makeChunk()]
    const plan = resolveMaintenanceChunkSceneSyncPlan(false, Option.none(), loadedChunks)

    expect(plan).toEqual({
      chunksChanged: true,
      shouldSyncWorld: true,
    })
  })

  it('reuses the current scene sync state when the loaded chunks are unchanged', () => {
    const loadedChunks = [makeChunk()]
    const plan = resolveMaintenanceChunkSceneSyncPlan(false, Option.some(loadedChunks), loadedChunks)

    expect(plan).toEqual({
      chunksChanged: false,
      shouldSyncWorld: false,
    })
  })

  it('forces a scene sync when chunk streaming is pending', () => {
    const loadedChunks = [makeChunk()]
    const plan = resolveMaintenanceChunkSceneSyncPlan(true, Option.some(loadedChunks), loadedChunks)

    expect(plan).toEqual({
      chunksChanged: false,
      shouldSyncWorld: true,
    })
  })
})
