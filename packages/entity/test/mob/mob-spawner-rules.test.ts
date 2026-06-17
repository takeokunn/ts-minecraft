import { describe, expect, it } from 'vitest'
import { canSpawnAtPosition } from '../../application/mob/mob-spawner-rules'
import { MAX_SPAWN_DISTANCE, MIN_SPAWN_DISTANCE, DESPAWN_DISTANCE } from '@ts-minecraft/entity'

describe('mob-spawner-rules', () => {
  const playerPosition = { x: 0, y: 64, z: 0 }

  it('accepts positions on the spawn ring within the despawn radius', () => {
    expect(canSpawnAtPosition(playerPosition, { x: MIN_SPAWN_DISTANCE, y: 64, z: 0 })).toBe(true)
    expect(canSpawnAtPosition(playerPosition, { x: MAX_SPAWN_DISTANCE, y: 64, z: 0 })).toBe(true)
  })

  it('rejects positions inside or outside the spawn ring', () => {
    expect(canSpawnAtPosition(playerPosition, { x: MIN_SPAWN_DISTANCE - 1, y: 64, z: 0 })).toBe(false)
    expect(canSpawnAtPosition(playerPosition, { x: MAX_SPAWN_DISTANCE + 1, y: 64, z: 0 })).toBe(false)
  })

  it('rejects positions that would immediately despawn in 3D', () => {
    expect(canSpawnAtPosition(playerPosition, { x: MIN_SPAWN_DISTANCE, y: 64 + DESPAWN_DISTANCE, z: 0 })).toBe(false)
  })
})
