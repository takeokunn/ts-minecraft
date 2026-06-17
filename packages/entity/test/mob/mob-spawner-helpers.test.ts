import { describe, expect, it } from 'vitest'
import { EntityType } from '@ts-minecraft/entity'
import { getSpawnPosition, selectMobType } from '../../application/mob/mob-spawner-helpers'

describe('entity/mob-spawner-helpers', () => {
  it('keeps the spawn position on the player ring around the cursor angle', () => {
    const playerPosition = { x: 10, y: 64, z: -4 }
    const spawnPosition = getSpawnPosition(playerPosition, 4)

    expect(spawnPosition.y).toBe(playerPosition.y)
    expect(spawnPosition.x).toBeCloseTo(playerPosition.x)
    expect(spawnPosition.z).toBeCloseTo(playerPosition.z + 16)
  })

  it('selects hostile mobs at night using the round-robin rotation', () => {
    expect(selectMobType(true, 0)).toBe(EntityType.Zombie)
    expect(selectMobType(true, 1)).toBe(EntityType.Creeper)
    expect(selectMobType(true, 2)).toBe(EntityType.Skeleton)
    expect(selectMobType(true, 999)).toBe(EntityType.ZombieVillager)
  })

  it('selects passive mobs during the day using the round-robin rotation', () => {
    expect(selectMobType(false, 0)).toBe(EntityType.Cow)
    expect(selectMobType(false, 1)).toBe(EntityType.Pig)
    expect(selectMobType(false, 2)).toBe(EntityType.Sheep)
    expect(selectMobType(false, 999)).toBe(EntityType.Chicken)
  })
})
