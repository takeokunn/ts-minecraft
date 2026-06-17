import { describe, it, expect } from 'vitest'
import { HashMap, Option } from 'effect'
import type * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/core'
import {
  collectChunkRemovalBatch,
  collectLoadedChunkSyncWork,
  collectWaterMeshes,
  hasPotentialStaleChunkMeshes,
  lodWithHysteresis,
  makeLoadedChunkKeySet,
  shouldContinueBudgetedChunkSync,
} from '@ts-minecraft/rendering/infrastructure/renderer/world-renderer-chunk-sync'
import { LOD1_DISTANCE_CHUNKS, LOD2_DISTANCE_CHUNKS } from '@ts-minecraft/rendering/infrastructure/meshing/lod-simplification'
import type { ChunkMeshes } from '@ts-minecraft/rendering/infrastructure/renderer/world-renderer-types'
import { makeChunk, makeMockMesh } from './world-renderer-test-utils'

const makeChunkMeshes = (
  x: number,
  z: number,
  lod: 0 | 1 | 2,
  water: Option.Option<THREE.Mesh> = Option.none(),
): ChunkMeshes => ({
  opaque: makeMockMesh({ x, z }) as ChunkMeshes['opaque'],
  water,
  transparentSolid: Option.none(),
  lod,
})

const makeMeshMap = (
  entries: ReadonlyArray<readonly [number, number, 0 | 1 | 2]>,
): HashMap.HashMap<ChunkCacheKey, ChunkMeshes> => {
  let meshes = HashMap.empty<ChunkCacheKey, ChunkMeshes>()
  for (const [x, z, lod] of entries) {
    meshes = HashMap.set(meshes, ChunkCacheKey.make({ x, z }), makeChunkMeshes(x, z, lod))
  }
  return meshes
}

// Boundaries: lod0|lod1 at LOD1_DISTANCE_CHUNKS (4), lod1|lod2 at LOD2_DISTANCE_CHUNKS (8).
// Hysteresis margin is 1 chunk, so a chunk keeps its current lod until its distance moves a
// full chunk PAST the relevant boundary — absorbing the ≤1-chunk centroid jitter that would
// otherwise flip-flop boundary chunks' LOD (and re-mesh them) every frame the player moves.
describe('lodWithHysteresis', () => {
  it('keeps lod0 across the lod0→1 boundary until distance moves a full margin past it', () => {
    // natural lod at distance 4 is 1, but a chunk currently at lod0 holds until distance ≥ 5.
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS, 0)).toBe(0) // d=4, still 0
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS + 0.9, 0)).toBe(0) // d=4.9, still 0
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS + 1, 0)).toBe(1) // d=5, switches
  })

  it('keeps lod1 inside its widened band on both sides', () => {
    // A chunk at lod1 holds even where the natural lod is 0 (d=3) or 2 (d=8).
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS - 1, 1)).toBe(1) // d=3 (natural 0), holds
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS, 1)).toBe(1) // d=8 (natural 2), holds
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS - 1.1, 1)).toBe(0) // d=2.9, drops to 0
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS + 1, 1)).toBe(2) // d=9, rises to 2
  })

  it('keeps lod2 until distance moves a full margin inside the lod1 band', () => {
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS - 1, 2)).toBe(2) // d=7 (natural 1), holds
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS - 1.1, 2)).toBe(1) // d=6.9, drops to 1
  })

  it('is idempotent: feeding back the natural lod at a settled distance returns the same lod', () => {
    for (const d of [0, 2, 4, 6, 8, 12]) {
      const settled = lodWithHysteresis(d, lodWithHysteresis(d, 0))
      // applying twice from a clean state must converge (no oscillation)
      expect(lodWithHysteresis(d, settled)).toBe(settled)
    }
  })
})

describe('chunk sync work collection', () => {
  it('classifies new chunks and LOD changes in one loaded-chunk pass', () => {
    const meshes = makeMeshMap([
      [0, 0, 0],
      [8, 0, 0],
    ])
    const work = collectLoadedChunkSyncWork(
      [makeChunk(0, 0), makeChunk(1, 0), makeChunk(8, 0)],
      meshes,
      0,
      0,
    )

    expect(work.newChunks.map((chunk) => chunk.coord)).toEqual([{ x: 1, z: 0 }])
    expect(work.lodChangedChunks.map((chunk) => chunk.coord)).toEqual([{ x: 8, z: 0 }])
  })

  it('builds the loaded-key set without an intermediate key array', () => {
    const loadedKeySet = makeLoadedChunkKeySet([makeChunk(0, 0), makeChunk(1, 0)])

    expect(loadedKeySet.has(ChunkCacheKey.make({ x: 0, z: 0 }))).toBe(true)
    expect(loadedKeySet.has(ChunkCacheKey.make({ x: 2, z: 0 }))).toBe(false)
  })

  it('detects stale meshes from counts without allocating a loaded-key set', () => {
    expect(hasPotentialStaleChunkMeshes(4, 2, 2)).toBe(false)
    expect(hasPotentialStaleChunkMeshes(4, 3, 2)).toBe(true)
    expect(hasPotentialStaleChunkMeshes(4, 4, 0)).toBe(false)
  })

  it('collects only the budgeted stale removals while reporting leftover stale meshes', () => {
    const meshes = makeMeshMap([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ])
    const loadedKeySet = new Set([ChunkCacheKey.make({ x: 0, z: 0 })])
    const batch = collectChunkRemovalBatch(meshes, loadedKeySet, 2)

    expect(batch.removalsToProcess).toHaveLength(2)
    expect(batch.allStaleRemoved).toBe(false)
  })

  it('collects water meshes without materializing every chunk mesh first', () => {
    const waterA = makeMockMesh({ x: 0, z: 0 })
    const waterB = makeMockMesh({ x: 2, z: 0 })
    let meshes = HashMap.empty<ChunkCacheKey, ChunkMeshes>()
    meshes = HashMap.set(meshes, ChunkCacheKey.make({ x: 0, z: 0 }), makeChunkMeshes(0, 0, 0, Option.some(waterA)))
    meshes = HashMap.set(meshes, ChunkCacheKey.make({ x: 1, z: 0 }), makeChunkMeshes(1, 0, 0))
    meshes = HashMap.set(meshes, ChunkCacheKey.make({ x: 2, z: 0 }), makeChunkMeshes(2, 0, 0, Option.some(waterB)))

    expect(collectWaterMeshes(meshes)).toEqual([waterA, waterB])
  })
})

describe('budgeted chunk sync loop guard', () => {
  it('always allows the first chunk sync unit even when the frame budget is already spent', () => {
    expect(shouldContinueBudgetedChunkSync(0, 4, 10, 1)).toBe(true)
  })

  it('stops after progress once the frame budget is spent', () => {
    expect(shouldContinueBudgetedChunkSync(1, 4, 10, 1)).toBe(false)
  })

  it('stops at the hard cap even when time remains', () => {
    expect(shouldContinueBudgetedChunkSync(4, 4, 0, 1)).toBe(false)
  })
})
