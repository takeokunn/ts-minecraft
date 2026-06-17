import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { HashMap, Option } from 'effect'
import { queueDirtyChunkEntries, restoreRemainingDirtyChunkEntries } from './frame-maintenance-sync-dirty'
import type { DirtyChunkEntry } from './frame-maintenance-dirty'
import type { Chunk } from '@ts-minecraft/world'

const makeEntry = (x: number): DirtyChunkEntry => {
  const blocks = new Uint8Array(16 * 16 * 256)
  const chunk = { coord: { x, z: 0 }, blocks, fluid: Option.none() } as Chunk
  return { chunk, dirtyAABB: Option.none() }
}

describe('frame-maintenance / dirty chunk flush helpers', () => {
  it('reuses the current queue when there are no drained render-dirty entries', () => {
    const current = HashMap.empty<string, DirtyChunkEntry>()
    const next = queueDirtyChunkEntries(current, [])

    expect(next).toBe(current)
  })

  it('merges drained render-dirty entries into the queued dirty-chunk map', () => {
    const current = HashMap.empty<string, DirtyChunkEntry>()
    const next = queueDirtyChunkEntries(current, [makeEntry(1)])

    expect(HashMap.size(next)).toBe(1)
  })

  it('reuses the current queue when there are no remaining entries to restore', () => {
    const current = HashMap.empty<string, DirtyChunkEntry>()
    const next = restoreRemainingDirtyChunkEntries(current, HashMap.empty<string, DirtyChunkEntry>())

    expect(next).toBe(current)
  })

  it('restores remaining entries back into the dirty queue', () => {
    const current = HashMap.empty<string, DirtyChunkEntry>()
    const remaining = HashMap.set(HashMap.empty<string, DirtyChunkEntry>(), 'chunk-1', makeEntry(1))
    const next = restoreRemainingDirtyChunkEntries(current, remaining)

    expect(HashMap.size(next)).toBe(1)
  })
})
