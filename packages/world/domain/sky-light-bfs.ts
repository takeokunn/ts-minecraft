import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe } from '@ts-minecraft/core'
import { getLightAt, isTransparentIndex, LIGHT_LEVEL_MAX, setLightAt } from '@ts-minecraft/block/domain/light'
import type { AABBAccumulator, DirtyVoxel, MutableBoundaryDirty } from './light-engine-model'
import { packPosLevel, trackTouched, unpackLevel, unpackX, unpackY, unpackZ } from './light-engine-utils'

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [dx: number, dy: number, dz: number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number => {
  return blocks[blockIndexUnsafe(lx, y, lz)] as number
}

const isOutsideChunk = (lx: number, y: number, lz: number): boolean =>
  lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE

const markHorizontalBoundary = (boundary: MutableBoundaryDirty, lx: number, lz: number): void => {
  if (lx < 0) boundary.nx = true
  else if (lx >= CHUNK_SIZE) boundary.px = true
  if (lz < 0) boundary.nz = true
  else if (lz >= CHUNK_SIZE) boundary.pz = true
}

const queuedLightAt = (queue: ReadonlyArray<number>, index: number): number => {
  return queue[index] as number
}

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

  for (const dirtyVoxel of dirty) {
    const colKey = (dirtyVoxel.lx << 4) | dirtyVoxel.lz
    if (columnsSeen.has(colKey)) continue
    columnsSeen.add(colKey)

    let exposed = true
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const blockIdx = blockAt(blocks, dirtyVoxel.lx, y, dirtyVoxel.lz)
      const isOpaque = isTransparentIndex(blockIdx) === false
      if (isOpaque) {
        exposed = false
      }
      const current = getLightAt(grid, dirtyVoxel.lx, y, dirtyVoxel.lz)
      if (exposed) {
        if (current < LIGHT_LEVEL_MAX) {
          setLightAt(grid, dirtyVoxel.lx, y, dirtyVoxel.lz, LIGHT_LEVEL_MAX)
          trackTouched(touched, dirtyVoxel.lx, y, dirtyVoxel.lz)
          addQueue.push(packPosLevel(dirtyVoxel.lx, y, dirtyVoxel.lz, LIGHT_LEVEL_MAX))
        }
      } else if (current === LIGHT_LEVEL_MAX) {
        setLightAt(grid, dirtyVoxel.lx, y, dirtyVoxel.lz, 0)
        trackTouched(touched, dirtyVoxel.lx, y, dirtyVoxel.lz)
        removalQueue.push(packPosLevel(dirtyVoxel.lx, y, dirtyVoxel.lz, LIGHT_LEVEL_MAX))
      } else if (isOpaque && current > 0) {
        setLightAt(grid, dirtyVoxel.lx, y, dirtyVoxel.lz, 0)
        trackTouched(touched, dirtyVoxel.lx, y, dirtyVoxel.lz)
        removalQueue.push(packPosLevel(dirtyVoxel.lx, y, dirtyVoxel.lz, current))
      }
    }
  }

  let head = 0
  while (head < removalQueue.length) {
    const packed = queuedLightAt(removalQueue, head)
    head += 1
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const oldLevel = unpackLevel(packed)
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      const nz = z + dz
      if (isOutsideChunk(nx, ny, nz)) {
        markHorizontalBoundary(boundary, nx, nz)
        continue
      }
      const nLevel = getLightAt(grid, nx, ny, nz)
      if (nLevel === 0) continue
      if (nLevel < oldLevel) {
        setLightAt(grid, nx, ny, nz, 0)
        trackTouched(touched, nx, ny, nz)
        removalQueue.push(packPosLevel(nx, ny, nz, nLevel))
      } else {
        addQueue.push(packPosLevel(nx, ny, nz, nLevel))
      }
    }
  }

  head = 0
  while (head < addQueue.length) {
    const packed = queuedLightAt(addQueue, head)
    head += 1
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const level = unpackLevel(packed)
    const cur = getLightAt(grid, x, y, z)
    if (cur > level) continue
    if (level <= 1) continue
    const nextLevel = level - 1
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      const nz = z + dz
      if (isOutsideChunk(nx, ny, nz)) {
        markHorizontalBoundary(boundary, nx, nz)
        continue
      }
      const nBlock = blockAt(blocks, nx, ny, nz)
      if (isTransparentIndex(nBlock) === false) continue
      const existing = getLightAt(grid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(grid, nx, ny, nz, nextLevel)
      trackTouched(touched, nx, ny, nz)
      addQueue.push(packPosLevel(nx, ny, nz, nextLevel))
    }
  }
}
