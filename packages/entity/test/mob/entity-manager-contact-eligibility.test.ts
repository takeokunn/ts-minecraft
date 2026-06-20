import { expect, it } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { canHostileContactDamagePlayer } from '../../application/mob/entity-manager-contact-eligibility'
import { makeTestManagedEntity } from './test-utils'

it('allows hostile melee attackers in range with an available cooldown', () => {
  const entity = makeTestManagedEntity({
    entityId: EntityId.make('entity-zombie-contact-eligible'),
    type: EntityType.Zombie,
    position: { x: 1, y: 64, z: 0 },
  })

  expect(canHostileContactDamagePlayer(entity, { x: 0, y: 64, z: 0 })).toBe(true)
})

it('rejects skeletons and unprovoked endermen', () => {
  const skeleton = makeTestManagedEntity({
    entityId: EntityId.make('entity-skeleton-contact-ineligible'),
    type: EntityType.Skeleton,
    position: { x: 0, y: 64, z: 0 },
  })
  const enderman = makeTestManagedEntity({
    entityId: EntityId.make('entity-enderman-contact-ineligible'),
    type: EntityType.Enderman,
    position: { x: 0, y: 64, z: 0 },
  })

  expect(canHostileContactDamagePlayer(skeleton, { x: 0, y: 64, z: 0 })).toBe(false)
  expect(canHostileContactDamagePlayer(enderman, { x: 0, y: 64, z: 0 })).toBe(false)
})

it('rejects attackers that are out of range or on cooldown', () => {
  const outOfRange = makeTestManagedEntity({
    entityId: EntityId.make('entity-zombie-contact-out-of-range'),
    type: EntityType.Zombie,
    position: { x: 4, y: 64, z: 0 },
  })
  const onCooldown = makeTestManagedEntity({
    entityId: EntityId.make('entity-zombie-contact-cooldown'),
    type: EntityType.Zombie,
    attackCooldownRemaining: 1,
    position: { x: 1, y: 64, z: 0 },
  })

  expect(canHostileContactDamagePlayer(outOfRange, { x: 0, y: 64, z: 0 })).toBe(false)
  expect(canHostileContactDamagePlayer(onCooldown, { x: 0, y: 64, z: 0 })).toBe(false)
})
