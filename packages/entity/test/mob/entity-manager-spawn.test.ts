import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import { createSpawnedManagedEntity } from '../../application/mob/entity-manager-spawn'

describe('entity-manager-spawn', () => {
  it('builds a fully initialized adult mob', () => {
    const entityId = EntityId.make('entity-1')
    const entity = createSpawnedManagedEntity(entityId, EntityType.Zombie, { x: 1, y: 64, z: 2 })

    expect(entity.entityId).toBe(entityId)
    expect(entity.type).toBe(EntityType.Zombie)
    expect(entity.health).toBe(entity.maxHealth)
    expect(entity.aiState).toBe(AIState.Idle)
    expect(entity.ageTicks).toBe(BABY_GROW_TICKS)
    expect(entity.attackCooldownRemaining).toBe(0)
    expect(entity.woolRegrowthTicks).toBe(0)
  })

  it('allows newborn mobs for breeding', () => {
    const entityId = EntityId.make('entity-2')
    const entity = createSpawnedManagedEntity(entityId, EntityType.Cow, { x: 10, y: 64, z: 10 }, 0)

    expect(entity.ageTicks).toBe(0)
    expect(entity.loveTicksRemaining).toBe(0)
    expect(entity.breedCooldownRemaining).toBe(0)
  })
})
