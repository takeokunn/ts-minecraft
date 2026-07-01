import { HashMap, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { resetBreedingParentState } from '@ts-minecraft/entity/application/mob/entity-manager-breeding'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { BABY_GROW_TICKS, BREED_COOLDOWN_TICKS } from '@ts-minecraft/entity/domain/mob/breeding'
import { identity, zero } from '@ts-minecraft/core'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeEntity = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
  entityId: EntityId.make('cow-1'),
  type: EntityType.Cow,
  position: { x: 0, y: 64, z: 0 },
  velocity: zero,
  rotation: identity,
  health: 10,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 1.5,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  drops: [],
  aiState: AIState.Wander,
  wanderDirection: zero,
  attackCooldownRemaining: 0,
  isProvoked: false,
  isGrounded: true,
  knockbackSecsRemaining: 0,
  fireSecsRemaining: 0,
  fireDamageAccumulatorSecs: 0,
  stuckTicks: 0,
  fuseSecs: 0,
  loveTicksRemaining: 100,
  breedCooldownRemaining: 0,
  ageTicks: BABY_GROW_TICKS,
  woolRegrowthTicks: 0,
  dragonPhase: null,
  dragonDeathProgress: null,
  ...overrides,
})

// ─── resetBreedingParentState ─────────────────────────────────────────────────

describe('resetBreedingParentState — entity not in map', () => {
  it('returns the same map when entity id does not exist', () => {
    const unknownId = EntityId.make('ghost-99')
    const entity = makeEntity()
    const map = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity)
    const result = resetBreedingParentState(map, unknownId)
    expect(HashMap.size(result)).toBe(1)
    expect(Option.isSome(HashMap.get(result, entity.entityId))).toBe(true)
  })
})

describe('resetBreedingParentState — entity in map', () => {
  const cowId = EntityId.make('cow-1')
  const entity = makeEntity({ entityId: cowId, loveTicksRemaining: 500 })
  const map = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), cowId, entity)
  const result = resetBreedingParentState(map, cowId)

  it('preserves the entity in the map', () => {
    expect(Option.isSome(HashMap.get(result, cowId))).toBe(true)
  })

  it('clears loveTicksRemaining to 0', () => {
    const updated = Option.getOrThrow(HashMap.get(result, cowId))
    expect(updated.loveTicksRemaining).toBe(0)
  })

  it('sets breedCooldownRemaining to BREED_COOLDOWN_TICKS', () => {
    const updated = Option.getOrThrow(HashMap.get(result, cowId))
    expect(updated.breedCooldownRemaining).toBe(BREED_COOLDOWN_TICKS)
  })

  it('does not change other entity fields', () => {
    const updated = Option.getOrThrow(HashMap.get(result, cowId))
    expect(updated.type).toBe(EntityType.Cow)
    expect(updated.health).toBe(entity.health)
  })
})
