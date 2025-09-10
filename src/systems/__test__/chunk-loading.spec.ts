import { describe, it, assert } from '@effect/vitest'
import { calculateChunkUpdates } from '../chunk-loading'
import * as HashMap from 'effect/HashMap'

describe('chunk-loading', () => {
  it('calculateChunkUpdates should handle empty inputs', () => {
    const currentChunk = { x: 0, z: 0 }
    const loadedChunks = HashMap.empty()
    const renderDistance = 1
    
    const updates = calculateChunkUpdates(currentChunk, loadedChunks, renderDistance)
    
    assert.isArray(updates.toLoad)
    assert.isArray(updates.toUnload)
  })
})