import { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { describe, expect, it as plainIt } from 'vitest'
import { tickEntityFire } from '../../application/mob/entity-manager-fire'
import { makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerFire', () => {
  plainIt('consumes fire time and accumulates whole-second damage', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-fire-tick'),
      type: EntityType.Zombie,
      fireSecsRemaining: 1.5,
      fireDamageAccumulatorSecs: 0.75,
    })

    const tick = tickEntityFire(entity, DeltaTimeSecs.make(1))

    expect(tick).toEqual({
      fireSecsRemaining: 0.5,
      fireDamageAccumulatorSecs: 0.75,
      damage: 1,
      changed: true,
    })
  })

  plainIt('clears extinguished fire state without damage', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-fire-out'),
      type: EntityType.Zombie,
      fireSecsRemaining: 0,
      fireDamageAccumulatorSecs: 0.5,
    })

    const tick = tickEntityFire(entity, DeltaTimeSecs.make(1))

    expect(tick).toEqual({
      fireSecsRemaining: 0,
      fireDamageAccumulatorSecs: 0,
      damage: 0,
      changed: true,
    })
  })
})
