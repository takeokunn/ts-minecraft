import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BiomeColumn } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Woodland mansions: three-storey plank manors on FOREST terrain — fourth
// application of the single-chunk structure pattern. Like every structure in
// this clone (one-room strongholds, simplified fortress corridors), the
// mansion is scaled to the world's proportions: a 12x12 footprint with log
// corner pillars, glass windows, and a top-floor treasure room.
export const MANSION_REGION_SIZE = 384
export const MANSION_SPAWN_PERMILLE = 250
const HALF_LOW = 5
const HALF_HIGH = 6
const ANCHOR_LOCAL_MIN = 6
const ANCHOR_LOCAL_SPAN = 4
const STOREY_HEIGHT = 4

export type MansionSite = {
  readonly x: number
  readonly z: number
}

export const mansionSiteForRegion = (regionX: number, regionZ: number): MansionSite | null => {
  const roll = hash3(regionX, 4991, regionZ)
  if (roll >= MANSION_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(MANSION_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 4992, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 4993, regionZ) * chunkSpan)
  const lx = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 4994, regionZ) * ANCHOR_LOCAL_SPAN)
  const lz = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 4995, regionZ) * ANCHOR_LOCAL_SPAN)
  return {
    x: (Math.floor((regionX * MANSION_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * MANSION_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
  }
}

export const writeWoodlandMansionForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
  surfaceYs: Int32Array,
  biomeColumns: ReadonlyArray<BiomeColumn>,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / MANSION_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / MANSION_REGION_SIZE)
  const site = mansionSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const anchorLx = site.x - chunkX * CHUNK_SIZE
  const anchorLz = site.z - chunkZ * CHUNK_SIZE
  const anchorColumn = biomeColumns[anchorLx * CHUNK_SIZE + anchorLz]
  if (anchorColumn === undefined || anchorColumn.biome !== 'FOREST') return false

  let baseY = Number.MAX_SAFE_INTEGER
  for (let lx = anchorLx - HALF_LOW; lx <= anchorLx + HALF_HIGH; lx++) {
    for (let lz = anchorLz - HALF_LOW; lz <= anchorLz + HALF_HIGH; lz++) {
      baseY = Math.min(baseY, surfaceYs[lx * CHUNK_SIZE + lz] ?? baseY)
    }
  }
  if (!Number.isFinite(baseY) || baseY < 8 || baseY > 190) return false

  const planks = blockTypeToIndex('PLANKS')
  const log = blockTypeToIndex('WOOD')
  const glass = blockTypeToIndex('GLASS')
  const chest = blockTypeToIndex('CHEST')
  const air = 0

  const fill = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, id: number): void => {
    for (let lx = x0; lx <= x1; lx++) {
      for (let lz = z0; lz <= z1; lz++) {
        for (let y = y0; y <= y1; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = id
        }
      }
    }
  }

  const x0 = anchorLx - HALF_LOW, x1 = anchorLx + HALF_HIGH
  const z0 = anchorLz - HALF_LOW, z1 = anchorLz + HALF_HIGH
  const totalHeight = STOREY_HEIGHT * 3

  // Foundation slab + hollow plank shell across all three storeys.
  fill(x0, x1, baseY, baseY, z0, z1, planks)
  fill(x0, x1, baseY + 1, baseY + totalHeight, z0, z1, planks)
  fill(x0 + 1, x1 - 1, baseY + 1, baseY + totalHeight, z0 + 1, z1 - 1, air)
  // Log corner pillars for the dark-oak manor look.
  for (const [cx, cz] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]] as const) {
    fill(cx, cx, baseY, baseY + totalHeight, cz, cz, log)
  }
  // Storey floors (leave a 2x2 stairwell opening at the +x/+z corner).
  for (let storey = 1; storey <= 2; storey++) {
    const floorY = baseY + storey * STOREY_HEIGHT
    fill(x0 + 1, x1 - 1, floorY, floorY, z0 + 1, z1 - 1, planks)
    fill(x1 - 2, x1 - 1, floorY, floorY, z1 - 2, z1 - 1, air)
  }
  // Roof cap.
  fill(x0, x1, baseY + totalHeight + 1, baseY + totalHeight + 1, z0, z1, planks)
  // Window bands on each storey (glass strips on the ±z walls).
  for (let storey = 0; storey < 3; storey++) {
    const wy = baseY + storey * STOREY_HEIGHT + 2
    fill(x0 + 2, x1 - 2, wy, wy, z0, z0, glass)
    fill(x0 + 2, x1 - 2, wy, wy, z1, z1, glass)
  }
  // Entrance: 2-wide, 2-tall doorway on the -z face (window band above stays).
  fill(anchorLx, anchorLx + 1, baseY + 1, baseY + 2, z0, z0, air)
  // Top-floor treasure.
  blocks[chunkBlockIndexUnchecked(anchorLx, baseY + 2 * STOREY_HEIGHT + 1, anchorLz)] = chest
  return true
}
