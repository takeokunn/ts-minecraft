import { describe, expect, it } from 'vitest'
import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  templeSiteForRegion,
  writeJungleTempleForChunk,
} from '../domain/terrain/jungle-temple'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import { CHUNK_HEIGHT } from '@ts-minecraft/core'

const COBBLE = blockTypeToIndex('COBBLESTONE')
const CHEST = blockTypeToIndex('CHEST')

const findSite = () => {
  for (let rx = 0; rx < 50; rx++) {
    for (let rz = 0; rz < 50; rz++) {
      const site = templeSiteForRegion(rx, rz)
      if (site !== null) return { rx, rz, site }
    }
  }
  throw new Error('no temple site in 50x50 regions — permille broken')
}

const jungleColumns = () =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'JUNGLE', props: {} }) as never)

describe('jungle temple', () => {
  it('sites are deterministic and footprint-contained in one chunk', () => {
    const { rx, rz, site } = findSite()
    expect(templeSiteForRegion(rx, rz)).toEqual(site)
    const lx = ((site.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((site.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    // Anchor local ∈ [6..9] keeps [anchor-5, anchor+6] inside the chunk.
    expect(lx).toBeGreaterThanOrEqual(6)
    expect(lx).toBeLessThanOrEqual(9)
    expect(lz).toBeGreaterThanOrEqual(6)
    expect(lz).toBeLessThanOrEqual(9)
  })

  it('writes a cobblestone temple with a chest on a jungle chunk', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(70)
    const wrote = writeJungleTempleForChunk(blocks, chunkX, chunkZ, surfaceYs, jungleColumns())
    expect(wrote).toBe(true)
    const anchorLx = site.x - chunkX * CHUNK_SIZE
    const anchorLz = site.z - chunkZ * CHUNK_SIZE
    // Platform at the surface, walls above it, chest in the hall center.
    expect(blocks[chunkBlockIndexUnchecked(anchorLx - 5, 70, anchorLz - 5)]).toBe(COBBLE)
    expect(blocks[chunkBlockIndexUnchecked(anchorLx - 5, 72, anchorLz)]).toBe(COBBLE)
    expect(blocks[chunkBlockIndexUnchecked(anchorLx, 71, anchorLz)]).toBe(CHEST)
    // Doorway opening on the -z face.
    expect(blocks[chunkBlockIndexUnchecked(anchorLx, 71, anchorLz - 5)]).toBe(0)
  })

  it('does nothing on non-jungle chunks or non-site chunks', () => {
    const { site } = findSite()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const surfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE).fill(70)
    const plains = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({ biome: 'PLAINS', props: {} }) as never)
    expect(writeJungleTempleForChunk(blocks, chunkX, chunkZ, surfaceYs, plains)).toBe(false)
    expect(writeJungleTempleForChunk(blocks, chunkX + 1, chunkZ, surfaceYs, jungleColumns())).toBe(false)
    expect(blocks.every((b) => b === 0)).toBe(true)
  })
})
