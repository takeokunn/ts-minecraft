import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { placeChunkPlants } from '../domain/terrain/plant-placer'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import { KELP_SURFACE_CLEARANCE } from '../domain/terrain/plant-placement-model'
import type { ColumnState } from '../domain/terrain/generator-types'

const SAND = blockTypeToIndex('SAND')
const WATER = blockTypeToIndex('WATER')
const KELP = blockTypeToIndex('KELP')

const FLOOR_Y = 50
const WATER_TOP_Y = 63

// Ocean chunk: sand floor at FLOOR_Y, water column up to WATER_TOP_Y.
const makeOceanChunk = (): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      blocks[chunkBlockIndexUnchecked(lx, FLOOR_Y, lz)] = SAND
      for (let y = FLOOR_Y + 1; y <= WATER_TOP_Y; y++) {
        blocks[chunkBlockIndexUnchecked(lx, y, lz)] = WATER
      }
    }
  }
  return blocks
}

const makeOceanColumns = (): ColumnState[] =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({
    biome: 'OCEAN' as const,
    props: {} as never,
    surfaceY: FLOOR_Y,
    lakeBasinY: Option.none(),
    ruggedness: 0,
  }))

describe('kelp generation (ocean depth content)', () => {
  it('grows kelp stalks from the ocean floor on a meaningful share of columns', () => {
    const blocks = makeOceanChunk()
    placeChunkPlants(blocks, 0, 0, makeOceanColumns())

    let kelpColumns = 0
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        if (blocks[chunkBlockIndexUnchecked(lx, FLOOR_Y + 1, lz)] === KELP) kelpColumns++
      }
    }
    // Density 0.16 over 256 columns ⇒ ~40 expected; assert a robust band.
    expect(kelpColumns).toBeGreaterThan(10)
    expect(kelpColumns).toBeLessThan(120)
  })

  it('stalks are contiguous from the floor and never breach the surface clearance', () => {
    const blocks = makeOceanChunk()
    placeChunkPlants(blocks, 0, 0, makeOceanColumns())

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        let inStalk = false
        for (let y = FLOOR_Y + 1; y <= WATER_TOP_Y; y++) {
          const b = blocks[chunkBlockIndexUnchecked(lx, y, lz)]
          if (b === KELP) {
            // Kelp only ever sits directly on floor or on kelp (contiguous stalk).
            if (y > FLOOR_Y + 1 && !inStalk) throw new Error(`floating kelp at (${lx},${y},${lz})`)
            inStalk = true
            expect(y).toBeLessThanOrEqual(WATER_TOP_Y - KELP_SURFACE_CLEARANCE)
          } else if (inStalk) {
            inStalk = false
          }
        }
      }
    }
  })

  it('places no kelp on land biomes', () => {
    const blocks = makeOceanChunk()
    const landColumns = makeOceanColumns().map((c) => ({ ...c, biome: 'PLAINS' as const }))
    placeChunkPlants(blocks, 0, 0, landColumns)

    let kelp = 0
    for (const b of blocks) if (b === KELP) kelp++
    expect(kelp).toBe(0)
  })
})
