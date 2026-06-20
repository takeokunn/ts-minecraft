import { describe, expect, it, vi } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { createSpawnedManagedEntity } from '../../application/mob/entity-manager-spawn'
import { resolveDamagedManagedEntityState } from '../../application/mob/entity-manager-damage-enderman'

vi.mock('../../application/mob/entity-manager-teleport', () => ({
  makeTeleportAttempts: () => [0.1, 0.2] as const,
}))

vi.mock('../../domain/mob/enderman-teleport', () => ({
  computeEndermanTeleportTarget: () => ({ x: 31, y: 70, z: -4 }),
  shouldEndermanTeleport: () => true,
}))

describe('entity-manager-damage-enderman', () => {
  it('keeps non-endermen in place and preserves provocation state', () => {
    const entity = createSpawnedManagedEntity(EntityId.make('entity-zombie-damage-state'), EntityType.Zombie, {
      x: 12,
      y: 64,
      z: -8,
    })

    expect(resolveDamagedManagedEntityState(entity, 7)).toEqual({
      position: entity.position,
      isProvoked: entity.isProvoked,
    })
  })

  it('teleports endermen and marks them provoked after damage', () => {
    const entity = createSpawnedManagedEntity(EntityId.make('entity-enderman-damage-state'), EntityType.Enderman, {
      x: 12,
      y: 64,
      z: -8,
    })

    expect(resolveDamagedManagedEntityState(entity, 7)).toEqual({
      position: { x: 31, y: 70, z: -4 },
      isProvoked: true,
    })
  })
})
