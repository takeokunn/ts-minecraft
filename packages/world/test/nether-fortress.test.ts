import { describe, expect, it } from 'vitest'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world/domain/terrain/math'
import {
  FORTRESS_FLOOR_Y,
  FORTRESS_REGION_SIZE,
  fortressSiteForRegion,
  writeFortressBlocksForChunk,
} from '@ts-minecraft/world/domain/terrain/nether-fortress'

const NETHER_BRICK = blockTypeToIndex('NETHER_BRICK')

const findSiteRegion = (): { regionX: number; regionZ: number; site: { x: number; z: number } } => {
  for (let regionX = 0; regionX < 50; regionX++) {
    for (let regionZ = 0; regionZ < 50; regionZ++) {
      const site = fortressSiteForRegion(regionX, regionZ)
      if (site !== null) return { regionX, regionZ, site }
    }
  }
  throw new Error('no fortress site found in scan range')
}

const emptyChunkBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 256)

describe('nether fortress generation', () => {
  it('site selection is deterministic and stays inside the region', () => {
    const { regionX, regionZ, site } = findSiteRegion()
    const again = fortressSiteForRegion(regionX, regionZ)
    expect(again).toEqual(site)
    expect(site.x).toBeGreaterThanOrEqual(regionX * FORTRESS_REGION_SIZE)
    expect(site.x).toBeLessThan((regionX + 1) * FORTRESS_REGION_SIZE)
    expect(site.z).toBeGreaterThanOrEqual(regionZ * FORTRESS_REGION_SIZE)
    expect(site.z).toBeLessThan((regionZ + 1) * FORTRESS_REGION_SIZE)
  })

  it('writes a nether-brick floor at the fortress center', () => {
    const { site } = findSiteRegion()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = emptyChunkBlocks()
    writeFortressBlocksForChunk(blocks, chunkX, chunkZ)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx, FORTRESS_FLOOR_Y, lz)]).toBe(NETHER_BRICK)
    // Corridor interior above the floor is walkable (air).
    expect(blocks[chunkBlockIndexUnchecked(lx, FORTRESS_FLOOR_Y + 1, lz)]).toBe(0)
    // Roof slab above the walls.
    expect(blocks[chunkBlockIndexUnchecked(lx, FORTRESS_FLOOR_Y + 4, lz)]).toBe(0 + NETHER_BRICK)
  })

  it('carves the corridor interior through solid terrain', () => {
    const { site } = findSiteRegion()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = emptyChunkBlocks()
    blocks.fill(blockTypeToIndex('NETHERRACK'))
    writeFortressBlocksForChunk(blocks, chunkX, chunkZ)
    const lx = site.x - chunkX * CHUNK_SIZE
    const lz = site.z - chunkZ * CHUNK_SIZE
    expect(blocks[chunkBlockIndexUnchecked(lx, FORTRESS_FLOOR_Y + 1, lz)]).toBe(0)
    expect(blocks[chunkBlockIndexUnchecked(lx, FORTRESS_FLOOR_Y + 2, lz)]).toBe(0)
  })

  it('leaves chunks far from any site untouched', () => {
    // Find a region WITHOUT a site and probe its center chunk.
    for (let regionX = 0; regionX < 50; regionX++) {
      for (let regionZ = 0; regionZ < 50; regionZ++) {
        if (fortressSiteForRegion(regionX, regionZ) !== null) continue
        // ensure neighbors don't reach into the middle of this region either
        const centerX = regionX * FORTRESS_REGION_SIZE + FORTRESS_REGION_SIZE / 2
        const centerZ = regionZ * FORTRESS_REGION_SIZE + FORTRESS_REGION_SIZE / 2
        const blocks = emptyChunkBlocks()
        writeFortressBlocksForChunk(blocks, Math.floor(centerX / CHUNK_SIZE), Math.floor(centerZ / CHUNK_SIZE))
        expect(blocks.every((b) => b === 0)).toBe(true)
        return
      }
    }
    throw new Error('no empty region found')
  })
})
