import { Option } from 'effect'
import type { Chunk } from '@ts-minecraft/world'
import type { Position } from '@ts-minecraft/core'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { getLightAt } from '@ts-minecraft/block/domain/light'
import { MOB_HALF_HEIGHT, HOSTILE_SPAWN_MAX_BLOCK_LIGHT } from './spawner-config'

const toLocalAxis = (blockCoordinate: number): number =>
  ((blockCoordinate % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

const blockIdAt = (chunk: Chunk, lx: number, y: number, lz: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(lx, y, lz)]!

/**
 * Finds a valid 2-tall spawn position in a chunk column by scanning from the
 * top down. Returns the mob's centre Y (bodyBlockY + MOB_HALF_HEIGHT) when a
 * clear surface is found, or None when:
 *   - the column is all air
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
  const lx = toLocalAxis(blockX)
  const lz = toLocalAxis(blockZ)

  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    if (blockIdAt(chunk, lx, y, lz) === 0) continue

    const bodyBlockY = y + 1
    const headBlockY = y + 2
    if (headBlockY >= CHUNK_HEIGHT) return Option.none()

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

// The nether is roofed (netherrack up to y≈123 plus a bedrock ceiling), so the
// overworld top-down "first solid block" scan always lands on the ceiling and
// fails. Instead, search the column near the candidate's own height for a
// cavern pocket: solid non-lava ground with 2 air blocks above. No light gate —
// vanilla nether hostiles spawn at any light level.
const NETHER_SPAWN_SCAN_UP = 8
const NETHER_SPAWN_MIN_Y = 5

export const resolveNetherSpawnPosition = (
  chunk: Chunk,
  candidatePosition: Position,
): Option.Option<Position> => {
  const lx = toLocalAxis(Math.floor(candidatePosition.x))
  const lz = toLocalAxis(Math.floor(candidatePosition.z))
  const lavaIndex = blockTypeToIndex('LAVA')

  const startY = Math.min(
    Math.floor(candidatePosition.y) + NETHER_SPAWN_SCAN_UP,
    CHUNK_HEIGHT - 3,
  )
  for (let groundY = startY; groundY >= NETHER_SPAWN_MIN_Y; groundY--) {
    const ground = blockIdAt(chunk, lx, groundY, lz)
    if (ground === 0 || ground === lavaIndex) continue
    if (blockIdAt(chunk, lx, groundY + 1, lz) !== 0) continue
    if (blockIdAt(chunk, lx, groundY + 2, lz) !== 0) continue

    return Option.some({
      x: candidatePosition.x,
      y: groundY + 1 + MOB_HALF_HEIGHT,
      z: candidatePosition.z,
    })
  }

  return Option.none()
}
