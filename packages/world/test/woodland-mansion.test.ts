import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  mansionSiteForRegion,
  writeWoodlandMansionForChunk,
} from '../domain/terrain/woodland-mansion'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

const PLANKS = blockTypeToIndex('PLANKS')
const WOOD = blockTypeToIndex('WOOD')
const GLASS = blockTypeToIndex('GLASS')
const CHEST = blockTypeToIndex('CHEST')

const findSite = () => {
  for (let rx = 0; rx < 50; rx++) {
    for (let rz = 0; rz < 50; rz++) {
      const site = mansionSiteForRegion(rx, rz)
      if (site !== null) return { site }
    }
  }
  throw new Error('no mansion site in 50x50 regions')
}

const forestColumns = () =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'FOREST', props: {} }) as never)

describe('woodland mansion', () => {
  it('writes a three-storey plank manor with log corners, windows, and a top-floor chest', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(72)
    expect(writeWoodlandMansionForChunk(blocks, chunkX, chunkZ, surfaceYs, forestColumns())).toBe(true)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx - 5, 74, lz)]).toBe(PLANKS)         // wall
    expect(blocks[chunkBlockIndexUnchecked(lx - 5, 74, lz - 5)]).toBe(WOOD)       // corner pillar
    expect(blocks[chunkBlockIndexUnchecked(lx - 2, 74, lz - 5)]).toBe(GLASS)     // ground-storey window band (non-door column)
    expect(blocks[chunkBlockIndexUnchecked(lx, 73, lz - 5)]).toBe(0)              // doorway
    expect(blocks[chunkBlockIndexUnchecked(lx, 81, lz)]).toBe(CHEST)              // top-floor treasure
    expect(blocks[chunkBlockIndexUnchecked(lx, 85, lz)]).toBe(PLANKS)             // roof cap
  })

  it('refuses non-forest biomes', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(72)
    const desert = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'DESERT', props: {} }) as never)
    expect(writeWoodlandMansionForChunk(blocks, chunkX, chunkZ, surfaceYs, desert)).toBe(false)
  })
})
