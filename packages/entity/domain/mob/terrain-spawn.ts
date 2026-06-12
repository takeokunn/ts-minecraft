import { Option } from 'effect'
import type { Chunk } from '@ts-minecraft/world'
import type { Position } from '@ts-minecraft/core'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { getLightAt } from '@ts-minecraft/block'
import { MOB_HALF_HEIGHT, HOSTILE_SPAWN_MAX_BLOCK_LIGHT } from './spawner-config'

/**
 * Finds a valid 2-tall spawn position in a chunk column by scanning from the
 * top down. Returns the mob's centre Y (bodyBlockY + MOB_HALF_HEIGHT) when a
 * clear surface is found, or None when:
 *   - the column is all air
 *   - the two blocks above the surface (body/head) are occupied
 *   - the body voxel is too close to the top of the chunk (headBlockY >= CHUNK_HEIGHT)
 *   - isHostileSpawn is true and the block light at the body voxel exceeds the
 *     vanilla hostile-spawn threshold (vanilla: light > 7 prevents hostile spawns)
 *
 * An absent blockLight grid reads as 0 (dark) — only lit surfaces suppress spawns.
 */
export const resolveMobSpawnPosition = (
  chunk: Chunk,
  candidatePosition: Position,
  isHostileSpawn: boolean = false,
): Option.Option<Position> => {
  const blockX = Math.floor(candidatePosition.x)
  const blockZ = Math.floor(candidatePosition.z)
  const lx = ((blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
    if ((chunk.blocks[blockIndex] ?? 0) === 0) continue

    const bodyBlockY = y + 1
    const headBlockY = y + 2
    if (headBlockY >= CHUNK_HEIGHT) return Option.none()

    const bodyBlockIndex = chunkBlockIndexUnchecked(lx, bodyBlockY, lz)
    const headBlockIndex = chunkBlockIndexUnchecked(lx, headBlockY, lz)
    /* c8 ignore next 3 — unreachable: top-down scan already cleared y+1/y+2 */
    if ((chunk.blocks[bodyBlockIndex] ?? 0) !== 0 || (chunk.blocks[headBlockIndex] ?? 0) !== 0) {
      return Option.none()
    }

    if (isHostileSpawn) {
      const light = chunk.blockLight !== undefined
        ? getLightAt(chunk.blockLight, lx, bodyBlockY, lz)
        : 0
      if (light > HOSTILE_SPAWN_MAX_BLOCK_LIGHT) return Option.none()
    }

    return Option.some({
      x: candidatePosition.x,
      y: bodyBlockY + MOB_HALF_HEIGHT,
      z: candidatePosition.z,
    })
  }

  return Option.none()
}
