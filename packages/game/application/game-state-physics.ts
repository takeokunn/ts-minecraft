import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain'

// Hoisted to module scope: array allocated once, not per frame.
export const OFFSETS_3x3 = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1], [ 0, 0], [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
] as const

export const isBlockSolid = (
  wx: number, wy: number, wz: number,
  chunkCache: Array<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => {
  const ly = Math.floor(wy)
  if (ly < 0) return true  // bedrock floor
  if (ly >= CHUNK_HEIGHT) return false
  const bx = Math.floor(wx)
  const bz = Math.floor(wz)
  const cx = Math.floor(bx / CHUNK_SIZE)
  const cz = Math.floor(bz / CHUNK_SIZE)
  const dx = cx - playerCx
  const dz = cz - playerCz
  if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return false
  const chunk = chunkCache[(dx + 1) * 3 + (dz + 1)]
  if (chunk == null) return false
  const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return chunk.blocks[chunkBlockIndexUnchecked(lx, ly, lz)] !== 0
}
