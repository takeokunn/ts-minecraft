import { describe, expect, it } from 'vitest'
import { HashMap } from 'effect'
import { EntityId } from '@ts-minecraft/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { BREED_COOLDOWN_TICKS } from '../../domain/mob/breeding'
import { resetBreedingParentState } from '../../application/mob/entity-manager-breeding'
import { makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerBreeding', () => {
  it('keeps breeding parent state unchanged when the parent is missing', () => {
    const entities = HashMap.empty<EntityId, ManagedEntity>()
    const next = resetBreedingParentState(entities, EntityId.make('entity-missing-parent'))

    expect(next).toBe(entities)
  })

  it('resets breeding state for an existing parent', () => {
    const parent = makeTestManagedEntity({
      entityId: EntityId.make('entity-parent'),
      loveTicksRemaining: 40,
      breedCooldownRemaining: 12,
    })
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), parent.entityId, parent)

    const next = resetBreedingParentState(entities, parent.entityId)
    const updated = HashMap.get(next, parent.entityId)

    expect(updated._tag).toBe('Some')
    if (updated._tag === 'Some') {
      expect(updated.value.loveTicksRemaining).toBe(0)
      expect(updated.value.breedCooldownRemaining).toBe(BREED_COOLDOWN_TICKS)
    }
  })
})
