import { HashMap, Option } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { describe, expect, it as plainIt } from 'vitest'
import { advanceDaylightBurnCadence, pruneBurnKilledEntities } from '../../application/mob/entity-manager-daylight-burn'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { expectSome, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerDaylightBurn', () => {
  plainIt('fires once per whole second and preserves the fractional remainder', () => {
    expect(advanceDaylightBurnCadence(0.6, DeltaTimeSecs.make(0.4))).toEqual([true, 0])
    expect(advanceDaylightBurnCadence(0.25, DeltaTimeSecs.make(0.5))).toEqual([false, 0.75])
  })

  plainIt('removes only dead entities from the burn cleanup pass', () => {
    const alive = makeTestManagedEntity({
      entityId: EntityId.make('entity-daylight-burn-alive'),
      type: EntityType.Zombie,
      health: 20,
    })
    const dead = makeTestManagedEntity({
      entityId: EntityId.make('entity-daylight-burn-dead'),
      type: EntityType.Zombie,
      health: 0,
    })
    const entities = HashMap.set(
      HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), alive.entityId, alive),
      dead.entityId,
      dead,
    )

    const [changed, updated] = pruneBurnKilledEntities(entities)

    expect(changed).toBe(true)
    expect(HashMap.size(updated)).toBe(1)
    expectSome(HashMap.get(updated, alive.entityId))
    expect(Option.isNone(HashMap.get(updated, dead.entityId))).toBe(true)
  })
})
