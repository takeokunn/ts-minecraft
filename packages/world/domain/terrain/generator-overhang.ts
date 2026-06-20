import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { OVERHANG_BAND_HEIGHT, OVERHANG_NOISE_SCALE, OVERHANG_THRESHOLD } from './constants'
import { chunkBlockIndexUnchecked } from './math'
import type { ColumnState, OverhangTarget } from './generator-types'
import {
  columnStateIndex,
  readColumnState,
  readNumber,
  readOverhangTarget,
} from './generator-pipeline-model'

const isOverhangEligible = (columnState: ColumnState): boolean =>
  columnState.biome === 'MOUNTAINS' || columnState.ruggedness >= 0.58

const resolveNeighborMaxSurface = (
  columnStates: ReadonlyArray<ColumnState>,
  lx: number,
  lz: number,
  surfaceY: number,
): number => {
  let neighborMaxSurface = surfaceY
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue
      const nx = lx + dx
      const nz = lz + dz
      if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue
      const neighborState = readColumnState(columnStates, columnStateIndex(nx, nz))
      neighborMaxSurface = Math.max(neighborMaxSurface, neighborState.surfaceY)
    }
  }
  return neighborMaxSurface
}

const isSolidAt = (
  blocks: Uint8Array,
  airBlockIndex: number,
  sx: number,
  sy: number,
  sz: number,
): boolean => {
  if (sx < 0 || sx >= CHUNK_SIZE || sz < 0 || sz >= CHUNK_SIZE || sy < 0 || sy >= CHUNK_HEIGHT) return true
  return blocks[chunkBlockIndexUnchecked(sx, sy, sz)] !== airBlockIndex
}

const isSupportedOverhangVoxel = (
  blocks: Uint8Array,
  airBlockIndex: number,
  lx: number,
  y: number,
  lz: number,
): boolean =>
  isSolidAt(blocks, airBlockIndex, lx, y - 1, lz)
  || isSolidAt(blocks, airBlockIndex, lx - 1, y, lz)
  || isSolidAt(blocks, airBlockIndex, lx + 1, y, lz)
  || isSolidAt(blocks, airBlockIndex, lx, y, lz - 1)
  || isSolidAt(blocks, airBlockIndex, lx, y, lz + 1)

export const collectOverhangTargets = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  columnStates: ReadonlyArray<ColumnState>,
  airBlockIndex: number,
): {
  readonly overhangXs: ReadonlyArray<number>
  readonly overhangYs: ReadonlyArray<number>
  readonly overhangZs: ReadonlyArray<number>
  readonly overhangTargets: ReadonlyArray<OverhangTarget>
} => {
  const overhangXs: number[] = []
  const overhangYs: number[] = []
  const overhangZs: number[] = []
  const overhangTargets: OverhangTarget[] = []

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const columnState = readColumnState(columnStates, columnStateIndex(lx, lz))
      if (!isOverhangEligible(columnState)) continue

      const neighborMaxSurface = resolveNeighborMaxSurface(columnStates, lx, lz, columnState.surfaceY)
      const supportCeiling = columnState.biome === 'MOUNTAINS'
        ? Math.max(neighborMaxSurface + 2, columnState.surfaceY + 6)
        : neighborMaxSurface + 2
      /* c8 ignore next */
      if (supportCeiling <= columnState.surfaceY + 1) continue

      const bandTop = Math.min(CHUNK_HEIGHT - 2, columnState.surfaceY + OVERHANG_BAND_HEIGHT)
      for (let y = columnState.surfaceY + 2; y <= bandTop; y++) {
        if (y > supportCeiling) continue
        const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[blockIndex] !== airBlockIndex) continue
        overhangTargets.push({ lx, lz, y })
        overhangXs.push((baseWorldX + lx) * OVERHANG_NOISE_SCALE)
        overhangYs.push(y * OVERHANG_NOISE_SCALE)
        overhangZs.push((baseWorldZ + lz) * OVERHANG_NOISE_SCALE)
      }
    }
  }

  return { overhangXs, overhangYs, overhangZs, overhangTargets }
}

export const applyOverhangNoise = (
  blocks: Uint8Array,
  overhangTargets: ReadonlyArray<OverhangTarget>,
  overhangNoiseVals: ReadonlyArray<number>,
  columnStates: ReadonlyArray<ColumnState>,
  stoneBlockIndex: number,
  airBlockIndex: number,
): void => {
  for (let index = 0; index < overhangTargets.length; index++) {
    const { lx, lz, y } = readOverhangTarget(overhangTargets, index)
    const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
    /* c8 ignore next */
    if (blocks[blockIndex] !== airBlockIndex) continue

    const { biome, surfaceY } = readColumnState(columnStates, columnStateIndex(lx, lz))
    const heightFactor = 1 - (y - surfaceY) / OVERHANG_BAND_HEIGHT
    const baseThreshold = biome === 'MOUNTAINS' ? OVERHANG_THRESHOLD - 0.08 : OVERHANG_THRESHOLD
    const threshold = baseThreshold - heightFactor * 0.14
    if (readNumber(overhangNoiseVals, index) <= threshold) continue

    if (isSupportedOverhangVoxel(blocks, airBlockIndex, lx, y, lz)) {
      blocks[blockIndex] = stoneBlockIndex
    }
  }
}
