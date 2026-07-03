import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  monumentSiteForRegion,
  writeOceanMonumentForChunk,
} from '../domain/terrain/ocean-monument'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

const PRISMARINE = blockTypeToIndex('PRISMARINE')
const GLOWSTONE = blockTypeToIndex('GLOWSTONE')
const WATER = blockTypeToIndex('WATER')

const findSite = () => {
  for (let rx = 0; rx < 50; rx++) {
    for (let rz = 0; rz < 50; rz++) {
      const site = monumentSiteForRegion(rx, rz)
      if (site !== null) return { site }
    }
  }
  throw new Error('no monument site in 50x50 regions')
}

const oceanColumns = () =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'OCEAN', props: {} }) as never)

describe('ocean monument', () => {
  it('writes a prismarine shell with a flooded hall and corner lights on the seabed', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(38) // seabed below sea level
    expect(writeOceanMonumentForChunk(blocks, chunkX, chunkZ, surfaceYs, oceanColumns())).toBe(true)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx - 5, 39, lz)]).toBe(PRISMARINE) // wall
    expect(blocks[chunkBlockIndexUnchecked(lx, 39, lz)]).toBe(WATER) // flooded hall
    expect(blocks[chunkBlockIndexUnchecked(lx - 5, 43, lz - 5)]).toBe(GLOWSTONE) // corner light
  })

  it('refuses non-ocean biomes', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(38)
    const plains = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'PLAINS', props: {} }) as never)
    expect(writeOceanMonumentForChunk(blocks, chunkX, chunkZ, surfaceYs, plains)).toBe(false)
  })
})
