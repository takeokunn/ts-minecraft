import { describe } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity'
import { makeEndermanTeleportRolls, makeTeleportAttempts } from '../../application/mob/entity-manager-teleport'
import { makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerTeleport', () => {
  plainIt('generates deterministic teleport rolls for the same entity and salt', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-enderman-teleport-rolls'),
      type: EntityType.Enderman,
      health: 13,
    })

    const rollsA = makeTeleportAttempts(entity, 42)
    const rollsB = makeTeleportAttempts(entity, 42)
    const rollsC = makeTeleportAttempts(entity, 43)

    expect(rollsA).toHaveLength(32)
    expect(rollsA).toEqual(rollsB)
    expect(rollsA).not.toEqual(rollsC)
    for (const roll of rollsA) {
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1)
    }
  })

  plainIt('generates deterministic Enderman teleport rolls for the same hash and tick', () => {
    const rollsA = makeEndermanTeleportRolls(1234, 56)
    const rollsB = makeEndermanTeleportRolls(1234, 56)
    const rollsC = makeEndermanTeleportRolls(1234, 57)

    expect(rollsA).toHaveLength(32)
    expect(rollsA).toEqual(rollsB)
    expect(rollsA).not.toEqual(rollsC)
    for (const roll of rollsA) {
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1)
    }
  })
})
