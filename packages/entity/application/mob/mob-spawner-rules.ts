import type { Position } from '@ts-minecraft/core'
import { DESPAWN_DISTANCE, MAX_SPAWN_DISTANCE, MIN_SPAWN_DISTANCE } from '../../domain/mob/spawner-config'

export const canSpawnAtPosition = (
  playerPosition: Position,
  spawnPosition: Position,
): boolean => {
  const sdx = spawnPosition.x - playerPosition.x
  const sdz = spawnPosition.z - playerPosition.z
  const spawnDistanceSqXZ = sdx * sdx + sdz * sdz
  const minSpawnDistanceSq = MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE
  const maxSpawnDistanceSq = MAX_SPAWN_DISTANCE * MAX_SPAWN_DISTANCE

  if (spawnDistanceSqXZ < minSpawnDistanceSq || spawnDistanceSqXZ > maxSpawnDistanceSq) {
    return false
  }

  const sdy = spawnPosition.y - playerPosition.y
  return spawnDistanceSqXZ + sdy * sdy < DESPAWN_DISTANCE * DESPAWN_DISTANCE
}
