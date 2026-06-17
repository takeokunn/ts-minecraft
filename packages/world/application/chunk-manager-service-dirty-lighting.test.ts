import { describe, expect, it } from 'vitest'
import { type Chunk } from '../domain/chunk'
import type { DirtyVoxel } from '../domain/light-engine-model'
import type { ChunkCacheEntry } from './chunk-manager-cache'
import { resolveDirtyLightingPlan } from './chunk-manager-service-dirty-lighting'

const makeChunk = (overrides: Partial<Chunk> = {}): Chunk =>
  ({
    coord: { x: 0, z: 0 },
    blocks: new Uint8Array(16 * 16 * 256),
    maxY: -1,
    ...overrides,
  }) as Chunk

const makeEntry = (chunk: Chunk): ChunkCacheEntry => ({
  chunk,
  lastAccessed: 1,
})

const dirtyVoxels: ReadonlyArray<DirtyVoxel> = [{ lx: 3, y: 42, lz: 7 }]

describe('chunk-manager-service-dirty-lighting', () => {
  it('chooses incremental lighting when the chunk already has light grids and dirty voxels exist', () => {
    const entry = makeEntry(
      makeChunk({
        skyLight: new Uint8Array(16 * 16 * 256 / 2),
        blockLight: new Uint8Array(16 * 16 * 256 / 2),
      }),
    )

    const plan = resolveDirtyLightingPlan(entry, dirtyVoxels)

    expect(plan).toEqual({ _tag: 'incremental', dirtyVoxels })
  })

  it('falls back to a full lighting refresh when no dirty voxels are provided', () => {
    const entry = makeEntry(
      makeChunk({
        skyLight: new Uint8Array(16 * 16 * 256 / 2),
        blockLight: new Uint8Array(16 * 16 * 256 / 2),
      }),
    )

    expect(resolveDirtyLightingPlan(entry)).toEqual({ _tag: 'full' })
    expect(resolveDirtyLightingPlan(entry, [])).toEqual({ _tag: 'full' })
  })

  it('falls back to a full lighting refresh when the chunk is missing light grids', () => {
    const entry = makeEntry(makeChunk())

    expect(resolveDirtyLightingPlan(entry, dirtyVoxels)).toEqual({ _tag: 'full' })
  })
})
