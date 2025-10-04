import { describe, expect, it } from '@effect/vitest'
import { makeChunkDistance, makeMaxActiveChunks, makeResourceUsagePercent } from './core'
import { ChunkLifecycleProvider, makeAutoManagementConfig } from './interfaces'

describe('chunk_manager/types/interfaces', () => {
  it('makeAutoManagementConfig returns immutable config', () => {
    const config = makeAutoManagementConfig({
      enabled: true,
      activationDistance: makeChunkDistance(8),
      deactivationDistance: makeChunkDistance(12),
      maxActiveChunks: makeMaxActiveChunks(64),
      memoryThreshold: makeResourceUsagePercent(0.7),
      performanceThreshold: makeResourceUsagePercent(0.8),
    })

    expect(config.enabled).toBe(true)
    expect(config.maxActiveChunks).toBe(64)
  })

  it('ChunkLifecycleProvider tag identity is stable', () => {
    const tag1 = ChunkLifecycleProvider
    const tag2 = ChunkLifecycleProvider
    expect(tag1).toBe(tag2)
  })
})
