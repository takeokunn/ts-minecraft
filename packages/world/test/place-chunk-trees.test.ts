import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { placeChunkTrees } from '../domain/terrain/generator-tree-context'
import { TREE_CANOPY_MARGIN } from '../domain/terrain/tree-placer'
import type { TreeColumnContext } from '../domain/terrain/generator-types'
import type { BiomeProperties } from '../domain/biome'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

const WOOD = blockTypeToIndex('WOOD')

const MINIMAL_PROPS: BiomeProperties = {
  surfaceBlock: 'GRASS',
  subSurfaceBlock: 'DIRT',
  treeDensity: 1,
  temperature: 0.5,
  humidity: 0.5,
}

const makeContext = (overrides: Partial<TreeColumnContext> = {}): TreeColumnContext => ({
  biome: 'PLAINS',
  props: MINIMAL_PROPS,
  surfaceY: 64,
  hasLakeBasin: false,
  supportsTree: true,
  ...overrides,
})

const makeBlocks = (): Uint8Array<ArrayBufferLike> => makeChunkBlockBuffer()

describe('placeChunkTrees', () => {
  it.effect('places wood trunk blocks when context supports trees and treeDensity=1', () =>
    Effect.gen(function* () {
      const blocks = makeBlocks()
      const ctx = makeContext()
      yield* placeChunkTrees(blocks, 0, 0, () => Effect.succeed(ctx))
      // treeDensity=1 guarantees fract(treeRng) < 1 for all positions → at least some trunks
      expect(blocks.includes(WOOD)).toBe(true)
    })
  )

  it.effect('places no trees when treeDensity=0', () =>
    Effect.gen(function* () {
      const blocks = makeBlocks()
      const ctx = makeContext({ props: { ...MINIMAL_PROPS, treeDensity: 0 } })
      yield* placeChunkTrees(blocks, 0, 0, () => Effect.succeed(ctx))
      expect(blocks.includes(WOOD)).toBe(false)
    })
  )

  it.effect('places no trees when hasLakeBasin=true (water column, even if supportsTree)', () =>
    Effect.gen(function* () {
      const blocks = makeBlocks()
      const ctx = makeContext({ hasLakeBasin: true })
      yield* placeChunkTrees(blocks, 0, 0, () => Effect.succeed(ctx))
      expect(blocks.includes(WOOD)).toBe(false)
    })
  )

  it.effect('places no trees when supportsTree=false (e.g. sand or water surface)', () =>
    Effect.gen(function* () {
      const blocks = makeBlocks()
      const ctx = makeContext({ supportsTree: false })
      yield* placeChunkTrees(blocks, 0, 0, () => Effect.succeed(ctx))
      expect(blocks.includes(WOOD)).toBe(false)
    })
  )

  it.effect('passes world-space coordinates to resolveTreeColumnContext including canopy margin', () =>
    Effect.gen(function* () {
      const visitedWx = new Set<number>()
      const visitedWz = new Set<number>()
      const baseWorldX = 32
      const baseWorldZ = 48

      yield* placeChunkTrees(
        makeBlocks(),
        baseWorldX,
        baseWorldZ,
        (wx, wz) => {
          visitedWx.add(wx)
          visitedWz.add(wz)
          return Effect.succeed(makeContext({ props: { ...MINIMAL_PROPS, treeDensity: 0 } }))
        },
      )

      // Should visit baseWorldX - TREE_CANOPY_MARGIN through baseWorldX + CHUNK_SIZE + TREE_CANOPY_MARGIN - 1
      const expectedMinWx = baseWorldX - TREE_CANOPY_MARGIN
      const expectedMaxWx = baseWorldX + CHUNK_SIZE + TREE_CANOPY_MARGIN - 1
      expect(Math.min(...visitedWx)).toBe(expectedMinWx)
      expect(Math.max(...visitedWx)).toBe(expectedMaxWx)

      const expectedMinWz = baseWorldZ - TREE_CANOPY_MARGIN
      const expectedMaxWz = baseWorldZ + CHUNK_SIZE + TREE_CANOPY_MARGIN - 1
      expect(Math.min(...visitedWz)).toBe(expectedMinWz)
      expect(Math.max(...visitedWz)).toBe(expectedMaxWz)
    })
  )
})
