import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world/domain/terrain/math'
import {
  STRONGHOLD_FLOOR_Y,
  STRONGHOLD_REGION_SIZE,
  endPortalFramePositionsForSite,
  endPortalInteriorForSite,
  nearestStrongholdSite,
  strongholdSiteForRegion,
  writeStrongholdBlocksForChunk,
} from '@ts-minecraft/world/domain/terrain/stronghold'
import { detectCompletedEndPortal } from '@ts-minecraft/world/domain/end/end-portal-frame'

const COBBLESTONE = blockTypeToIndex('COBBLESTONE')
const END_PORTAL_FRAME = blockTypeToIndex('END_PORTAL_FRAME')

const findSiteRegion = (): { regionX: number; regionZ: number; site: { x: number; z: number } } => {
  for (let regionX = 0; regionX < 50; regionX++) {
    for (let regionZ = 0; regionZ < 50; regionZ++) {
      const site = strongholdSiteForRegion(regionX, regionZ)
      if (site !== null) return { regionX, regionZ, site }
    }
  }
  throw new Error('no stronghold site found in scan range')
}

const emptyChunkBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 256)

describe('stronghold generation', () => {
  it('site selection is deterministic and stays inside the region', () => {
    const { regionX, regionZ, site } = findSiteRegion()
    expect(strongholdSiteForRegion(regionX, regionZ)).toEqual(site)
    expect(site.x).toBeGreaterThanOrEqual(regionX * STRONGHOLD_REGION_SIZE)
    expect(site.x).toBeLessThan((regionX + 1) * STRONGHOLD_REGION_SIZE)
    expect(site.z).toBeGreaterThanOrEqual(regionZ * STRONGHOLD_REGION_SIZE)
    expect(site.z).toBeLessThan((regionZ + 1) * STRONGHOLD_REGION_SIZE)
  })

  it('exposes the classic 12-frame ring and 3x3 interior for a site', () => {
    const { site } = findSiteRegion()
    const frames = endPortalFramePositionsForSite(site)
    const interior = endPortalInteriorForSite(site)
    expect(frames).toHaveLength(12)
    expect(interior).toHaveLength(9)
    // Frames and interior never overlap.
    const interiorKeys = new Set(interior.map((p) => `${p.x},${p.z}`))
    for (const frame of frames) {
      expect(interiorKeys.has(`${frame.x},${frame.z}`)).toBe(false)
    }
  })

  it('writes the room slice: cobblestone floor, frame ring, empty interior', () => {
    const { site } = findSiteRegion()
    const chunkX = Math.floor(site.x / CHUNK_SIZE)
    const chunkZ = Math.floor(site.z / CHUNK_SIZE)
    const blocks = emptyChunkBlocks()
    // Pre-fill with stone so we can observe the carve.
    blocks.fill(blockTypeToIndex('STONE'))
    writeStrongholdBlocksForChunk(blocks, chunkX, chunkZ)

    const localIndex = (wx: number, y: number, wz: number): number | null => {
      const lx = wx - chunkX * CHUNK_SIZE
      const lz = wz - chunkZ * CHUNK_SIZE
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return null
      return chunkBlockIndexUnchecked(lx, y, lz)
    }

    // Floor + empty interior at the centre column (always inside this chunk).
    const floorIdx = localIndex(site.x, STRONGHOLD_FLOOR_Y, site.z)
    const airIdx = localIndex(site.x, STRONGHOLD_FLOOR_Y + 1, site.z)
    expect(floorIdx).not.toBeNull()
    expect(blocks[floorIdx!]).toBe(COBBLESTONE)
    expect(blocks[airIdx!]).toBe(0)

    // Every frame position inside this chunk is an END_PORTAL_FRAME.
    let framesInChunk = 0
    for (const frame of endPortalFramePositionsForSite(site)) {
      const idx = localIndex(frame.x, frame.y, frame.z)
      if (idx === null) continue
      framesInChunk++
      expect(blocks[idx]).toBe(END_PORTAL_FRAME)
    }
    expect(framesInChunk).toBeGreaterThan(0)
  })

  it('nearestStrongholdSite finds a site for any query position', () => {
    const { site } = findSiteRegion()
    const found = Option.getOrThrow(nearestStrongholdSite(site.x + 10, site.z - 10))
    expect(found).toEqual(site)
  })
})

describe('detectCompletedEndPortal', () => {
  const makeWorld = (filled: ReadonlyArray<{ x: number; z: number }>, y: number) => {
    const set = new Set(filled.map((p) => `${p.x},${p.z}`))
    return (x: number, by: number, z: number): BlockType =>
      by === y && set.has(`${x},${z}`) ? 'END_PORTAL_FRAME_FILLED' : 'AIR'
  }

  const ringAround = (cx: number, cz: number): Array<{ x: number; z: number }> => {
    const ring: Array<{ x: number; z: number }> = []
    for (let offset = -1; offset <= 1; offset++) {
      ring.push({ x: cx + offset, z: cz - 2 })
      ring.push({ x: cx + offset, z: cz + 2 })
      ring.push({ x: cx - 2, z: cz + offset })
      ring.push({ x: cx + 2, z: cz + offset })
    }
    return ring
  }

  it('detects a completed ring from every frame slot', () => {
    const ring = ringAround(100, 200)
    const blockAt = makeWorld(ring, 29)
    for (const frame of ring) {
      const result = detectCompletedEndPortal(blockAt, { x: frame.x, y: 29, z: frame.z })
      const completed = Option.getOrThrow(result)
      expect(completed.interior).toHaveLength(9)
      expect(completed.interior).toContainEqual({ x: 100, y: 29, z: 200 })
    }
  })

  it('returns none while any frame is missing', () => {
    const ring = ringAround(100, 200)
    const blockAt = makeWorld(ring.slice(0, 11), 29)
    expect(Option.isNone(detectCompletedEndPortal(blockAt, { x: ring[0]!.x, y: 29, z: ring[0]!.z }))).toBe(true)
  })

  it('generated stronghold ring completes once every frame is filled', () => {
    const { site } = findSiteRegion()
    const frames = endPortalFramePositionsForSite(site)
    const blockAt = makeWorld(frames.map((p) => ({ x: p.x, z: p.z })), STRONGHOLD_FLOOR_Y + 1)
    const first = frames[0]!
    const completed = Option.getOrThrow(detectCompletedEndPortal(blockAt, first))
    const interiorKeys = new Set(completed.interior.map((p) => `${p.x},${p.z}`))
    for (const pos of endPortalInteriorForSite(site)) {
      expect(interiorKeys.has(`${pos.x},${pos.z}`)).toBe(true)
    }
  })
})
