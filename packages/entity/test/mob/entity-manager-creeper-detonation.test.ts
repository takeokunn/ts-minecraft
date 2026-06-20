import { expect, it } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { CREEPER_EXPLOSION_POWER } from '../../domain/explosion'
import { computeExplosionDamageAt } from '../../domain/explosion-resolution'
import { CREEPER_FUSE_SECONDS } from '../../domain/mob/creeper-fuse'
import { resolveCreeperContactDamage } from '../../application/mob/entity-manager-creeper-detonation'
import { makeTestManagedEntity } from './test-utils'

it('resolves fused creeper detonation as explosion damage and event data', () => {
  const creeper = makeTestManagedEntity({
    entityId: EntityId.make('entity-creeper-detonation'),
    type: EntityType.Creeper,
    fuseSecs: CREEPER_FUSE_SECONDS,
  })

  const result = resolveCreeperContactDamage(creeper, { x: 0, y: 64, z: 0 })

  expect(result).toEqual({
    damage: computeExplosionDamageAt(creeper.position, CREEPER_EXPLOSION_POWER, { x: 0, y: 64, z: 0 }),
    explosionEvent: {
      source: 'creeper',
      position: creeper.position,
      power: CREEPER_EXPLOSION_POWER,
    },
  })
})

it('rejects non-detonating entities', () => {
  const zombie = makeTestManagedEntity({
    entityId: EntityId.make('entity-zombie-detonation'),
    type: EntityType.Zombie,
  })

  const unfusedCreeper = makeTestManagedEntity({
    entityId: EntityId.make('entity-creeper-unfused-detonation'),
    type: EntityType.Creeper,
    fuseSecs: CREEPER_FUSE_SECONDS - 0.01,
  })

  expect(resolveCreeperContactDamage(zombie, { x: 0, y: 64, z: 0 })).toBeNull()
  expect(resolveCreeperContactDamage(unfusedCreeper, { x: 0, y: 64, z: 0 })).toBeNull()
})
