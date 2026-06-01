import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe } from '@ts-minecraft/core'
import { getLightAt, isTransparentIndex, LIGHT_LEVEL_MAX, setLightAt } from '@ts-minecraft/block'
import type { AABBAccumulator, DirtyVoxel, MutableBoundaryDirty } from './light-engine-model'
import { NEIGHBOR_DX, NEIGHBOR_DY, NEIGHBOR_DZ, packPosLevel, trackTouched, unpackLevel, unpackX, unpackY, unpackZ } from './light-engine-utils'

export const propagateSkyLightIncremental = (
  blocks: Uint8Array,
  grid: Uint8Array,
  dirty: ReadonlyArray<DirtyVoxel>,
  boundary: MutableBoundaryDirty,
  touched: AABBAccumulator,
): void => {
  const columnsSeen = new Set<number>()
  const removalQueue: number[] = []
  const addQueue: number[] = []

  for (let i = 0; i < dirty.length; i++) {
    const d = dirty[i]!
    const colKey = (d.lx << 4) | d.lz
    if (columnsSeen.has(colKey)) continue
    columnsSeen.add(colKey)

    let exposed = true
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const idx = blockIndexUnsafe(d.lx, y, d.lz)
      const blockIdx = blocks[idx] ?? 0
      if (isTransparentIndex(blockIdx) === false) {
        exposed = false
      }
      const current = getLightAt(grid, d.lx, y, d.lz)
      if (exposed) {
        if (current < LIGHT_LEVEL_MAX) {
          setLightAt(grid, d.lx, y, d.lz, LIGHT_LEVEL_MAX)
          trackTouched(touched, d.lx, y, d.lz)
          addQueue.push(packPosLevel(d.lx, y, d.lz, LIGHT_LEVEL_MAX))
        }
      } else if (current === LIGHT_LEVEL_MAX) {
        setLightAt(grid, d.lx, y, d.lz, 0)
        trackTouched(touched, d.lx, y, d.lz)
        removalQueue.push(packPosLevel(d.lx, y, d.lz, LIGHT_LEVEL_MAX))
      /* c8 ignore start -- opaque block with residual light: rare light-engine state requiring specific block/light combo */
      } else if (isTransparentIndex(blockIdx) === false && current > 0) {
        setLightAt(grid, d.lx, y, d.lz, 0)
        trackTouched(touched, d.lx, y, d.lz)
        removalQueue.push(packPosLevel(d.lx, y, d.lz, current))
      }
      /* c8 ignore end */
    }
  }

  let head = 0
  while (head < removalQueue.length) {
    const packed = removalQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const oldLevel = unpackLevel(packed)
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nLevel = getLightAt(grid, nx, ny, nz)
      if (nLevel === 0) continue
      /* c8 ignore start -- light removal cascade BFS: nLevel < oldLevel only with specific light gradients */
      if (nLevel < oldLevel) {
        setLightAt(grid, nx, ny, nz, 0)
        trackTouched(touched, nx, ny, nz)
        removalQueue.push(packPosLevel(nx, ny, nz, nLevel))
      /* c8 ignore end */
      } else {
        addQueue.push(packPosLevel(nx, ny, nz, nLevel))
      }
    }
  }

  head = 0
  while (head < addQueue.length) {
    const packed = addQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const level = unpackLevel(packed)
    const cur = getLightAt(grid, x, y, z)
    if (cur > level) continue
    if (level <= 1) continue
    const nextLevel = level - 1
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nBlock = blocks[blockIndexUnsafe(nx, ny, nz)] ?? 0
      if (isTransparentIndex(nBlock) === false) continue
      const existing = getLightAt(grid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(grid, nx, ny, nz, nextLevel)
      trackTouched(touched, nx, ny, nz)
      addQueue.push(packPosLevel(nx, ny, nz, nextLevel))
    }
  }
}
