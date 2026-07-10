import { describe, expect, it } from 'vitest'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import {
  GEODE_MAX_RADIUS,
  GEODE_MIN_RADIUS,
  GEODE_CENTER_MAX_Y,
  GEODE_CENTER_MIN_Y,
  geodeSiteForRegion,
  writeAmethystGeodeForChunk,
} from '../domain/terrain/amethyst-geode'

const STONE = blockTypeToIndex('STONE')
const AIR = blockTypeToIndex('AIR')
const BASALT = blockTypeToIndex('SMOOTH_BASALT')
const CALCITE = blockTypeToIndex('CALCITE')
const AMETHYST = blockTypeToIndex('AMETHYST_BLOCK')
const CLUSTER = blockTypeToIndex('AMETHYST_CLUSTER')

const makeStoneChunk = (): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks.fill(STONE)
  return blocks
}

// Search nearby regions for one that actually rolls a geode (deterministic).
const findGeodeRegion = (): { regionX: number; regionZ: number } => {
  for (let rx = 0; rx < 20; rx++) {
    for (let rz = 0; rz < 20; rz++) {
      if (geodeSiteForRegion(rx, rz) !== null) return { regionX: rx, regionZ: rz }
    }
  }
  throw new Error('no geode region found in the 20x20 search window')
}

describe('amethyst geodes (cave variety)', () => {
  it('site selection is deterministic and within bounds', () => {
    const { regionX, regionZ } = findGeodeRegion()
    const a = geodeSiteForRegion(regionX, regionZ)!
    const b = geodeSiteForRegion(regionX, regionZ)!
    expect(a).toEqual(b)
    expect(a.radius).toBeGreaterThanOrEqual(GEODE_MIN_RADIUS)
    expect(a.radius).toBeLessThanOrEqual(GEODE_MAX_RADIUS)
    expect(a.y).toBeGreaterThanOrEqual(GEODE_CENTER_MIN_Y)
    expect(a.y).toBeLessThanOrEqual(GEODE_CENTER_MAX_Y)
    // Sphere must fit inside its own chunk (single-chunk structure pattern).
    const lx = ((a.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((a.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    expect(lx).toBeGreaterThanOrEqual(a.radius)
    expect(lx).toBeLessThanOrEqual(CHUNK_SIZE - 1 - a.radius)
    expect(lz).toBeGreaterThanOrEqual(a.radius)
    expect(lz).toBeLessThanOrEqual(CHUNK_SIZE - 1 - a.radius)
  })

  it('writes concentric basalt/calcite/amethyst shells around a hollow crystal core', () => {
    const { regionX, regionZ } = findGeodeRegion()
    const site = geodeSiteForRegion(regionX, regionZ)!
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = makeStoneChunk()
    expect(writeAmethystGeodeForChunk(blocks, chunkX, chunkZ)).toBe(true)

    const centerLx = site.x - chunkX * CHUNK_SIZE
    const centerLz = site.z - chunkZ * CHUNK_SIZE
    const counts = { basalt: 0, calcite: 0, amethyst: 0, cluster: 0, air: 0 }
    for (let dy = -site.radius; dy <= site.radius; dy++) {
      for (let dx = -site.radius; dx <= site.radius; dx++) {
        for (let dz = -site.radius; dz <= site.radius; dz++) {
          if (dx * dx + dy * dy + dz * dz > site.radius * site.radius) continue
          const b = blocks[chunkBlockIndexUnchecked(centerLx + dx, site.y + dy, centerLz + dz)]
          if (b === BASALT) counts.basalt++
          else if (b === CALCITE) counts.calcite++
          else if (b === AMETHYST) counts.amethyst++
          else if (b === CLUSTER) counts.cluster++
          else if (b === AIR) counts.air++
        }
      }
    }
    // Every shell layer materialized, the core is hollow, and crystals grew.
    expect(counts.basalt).toBeGreaterThan(0)
    expect(counts.calcite).toBeGreaterThan(0)
    expect(counts.amethyst).toBeGreaterThan(0)
    expect(counts.cluster).toBeGreaterThan(0)
    expect(counts.air).toBeGreaterThan(0)
    // The exact center is hollow (air), never solid shell.
    const center = blocks[chunkBlockIndexUnchecked(centerLx, site.y, centerLz)]
    expect(center === AIR || center === CLUSTER).toBe(true)
  })

  it('leaves neighbouring chunks untouched (single-chunk footprint)', () => {
    const { regionX, regionZ } = findGeodeRegion()
    const site = geodeSiteForRegion(regionX, regionZ)!
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const neighbour = makeStoneChunk()
    expect(writeAmethystGeodeForChunk(neighbour, chunkX + 1, chunkZ)).toBe(false)
    expect(neighbour.every((b) => b === STONE)).toBe(true)
  })

  it('spawns at a rate that makes geodes rare but findable', () => {
    let sites = 0
    const regions = 400
    for (let rx = 0; rx < 20; rx++) {
      for (let rz = 0; rz < 20; rz++) {
        if (geodeSiteForRegion(rx, rz) !== null) sites++
      }
    }
    // ~35% of 128-block regions host one geode; assert a generous band so the
    // hash distribution can wobble without flaking.
    expect(sites).toBeGreaterThan(regions * 0.2)
    expect(sites).toBeLessThan(regions * 0.5)
  })
})
