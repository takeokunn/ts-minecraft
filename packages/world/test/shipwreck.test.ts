import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { shipwreckSiteForRegion, writeShipwreckForChunk } from '../domain/terrain/shipwreck'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

const PLANKS = blockTypeToIndex('PLANKS')
const WOOD = blockTypeToIndex('WOOD')
const CHEST = blockTypeToIndex('CHEST')

const findSite = () => {
  for (let rx = 0; rx < 50; rx++) {
    for (let rz = 0; rz < 50; rz++) {
      const site = shipwreckSiteForRegion(rx, rz)
      if (site !== null) return { site }
    }
  }
  throw new Error('no shipwreck site in 50x50 regions')
}

const oceanColumns = () =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'OCEAN', props: {} }) as never)

describe('shipwreck', () => {
  it('writes a breached plank hull with mast stump and chest on the seabed', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(36)
    expect(writeShipwreckForChunk(blocks, chunkX, chunkZ, surfaceYs, oceanColumns())).toBe(true)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx, 37, lz)]).toBe(PLANKS)       // deck
    expect(blocks[chunkBlockIndexUnchecked(lx, 38, lz)]).toBe(WOOD)         // mast stump
    expect(blocks[chunkBlockIndexUnchecked(lx, 38, lz - 2)]).toBe(0)        // hull breach
    expect(blocks[chunkBlockIndexUnchecked(lx + 5, 38, lz)]).toBe(CHEST)    // stern chest
  })

  it('refuses non-ocean biomes', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(36)
    const plains = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'PLAINS', props: {} }) as never)
    expect(writeShipwreckForChunk(blocks, chunkX, chunkZ, surfaceYs, plains)).toBe(false)
  })
})
