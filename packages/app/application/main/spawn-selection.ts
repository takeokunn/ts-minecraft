import { Option } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'
import {
  candidateAt,
  clampAboveWater,
  findFallbackSurfaceY,
  scoreSpawnCandidate,
  keyOf,
} from './spawn-selection-search'
export { SpawnSelectionChunkError } from './spawn-selection-search'
import type { SpawnCandidate } from './spawn-selection-search'

export type SpawnSelection = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly yaw: number
}

export const selectSurfaceSpawn = (
  chunks: ReadonlyArray<Chunk>,
  baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number },
): SpawnSelection => {
  const chunkMap = new Map<string, Chunk>()
  for (const chunk of chunks) {
    chunkMap.set(keyOf(chunk.coord.x, chunk.coord.z), chunk)
  }

  let best: SpawnCandidate | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const chunk of chunks) {
    const baseWorldX = chunk.coord.x * CHUNK_SIZE
    const baseWorldZ = chunk.coord.z * CHUNK_SIZE
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWorldX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const candidate = Option.getOrNull(candidateAt(chunkMap, baseSpawnPosition, wx, baseWorldZ + lz))
        if (candidate === null) continue
        // Prefer open-surface spawns: weight openness heavily so distance only
        // breaks ties. A wide-open plains column 30 blocks away is better than
        // a cave-adjacent surface right next to the origin.
        const candidateScore = scoreSpawnCandidate(candidate)
        if (candidateScore > bestScore) {
          best = candidate
          bestScore = candidateScore
        }
      }
    }
  }

  if (best !== null) {
    return clampAboveWater({ position: best.position, yaw: best.yaw })
  }

  // No valid surface candidate found — scan loaded chunks for any
  // solid ground as a last-resort fallback before using the fixed height.
  const fallbackY = 67.9
  const safetyY = findFallbackSurfaceY(chunkMap, baseSpawnPosition)
  return clampAboveWater({ position: { ...baseSpawnPosition, y: safetyY ?? fallbackY }, yaw: 0 })
}
