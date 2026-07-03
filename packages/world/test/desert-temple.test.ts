import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  desertTempleSiteForRegion,
  writeDesertTempleForChunk,
} from '../domain/terrain/desert-temple'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

const SANDSTONE = blockTypeToIndex('SANDSTONE')
const CHEST = blockTypeToIndex('CHEST')

const findSite = () => {
  for (let rx = 0; rx < 50; rx++) {
    for (let rz = 0; rz < 50; rz++) {
      const site = desertTempleSiteForRegion(rx, rz)
      if (site !== null) return { site }
    }
  }
  throw new Error('no desert temple site in 50x50 regions')
}

const desertColumns = () =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'DESERT', props: {} }) as never)

describe('desert temple', () => {
  it('writes a sandstone pyramid with a hall chest on a desert chunk', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(68)
    expect(writeDesertTempleForChunk(blocks, chunkX, chunkZ, surfaceYs, desertColumns())).toBe(true)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx - 5, 68, lz - 5)]).toBe(SANDSTONE)
    expect(blocks[chunkBlockIndexUnchecked(lx, 75, lz)]).toBe(SANDSTONE) // pyramid crown tier
    expect(blocks[chunkBlockIndexUnchecked(lx, 69, lz)]).toBe(CHEST)
    expect(blocks[chunkBlockIndexUnchecked(lx, 69, lz - 5)]).toBe(0) // doorway
  })

  it('refuses non-desert biomes', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(68)
    const jungle = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'JUNGLE', props: {} }) as never)
    expect(writeDesertTempleForChunk(blocks, chunkX, chunkZ, surfaceYs, jungle)).toBe(false)
    expect(blocks.every((b) => b === 0)).toBe(true)
  })
})
