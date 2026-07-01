import { HashMap } from 'effect'
import { describe, expect, it } from 'vitest'
import { collectBreedingCandidates } from '@ts-minecraft/entity/application/mob/entity-manager-breeding-candidates'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { BABY_GROW_TICKS } from '@ts-minecraft/entity/domain/mob/breeding'
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
  loveTicksRemaining: 0,
  breedCooldownRemaining: 0,
  ageTicks: BABY_GROW_TICKS, // adult
  woolRegrowthTicks: 0,
  dragonPhase: null,
  dragonDeathProgress: null,
  ...overrides,
})

const addEntity = (
  map: HashMap.HashMap<EntityId, ManagedEntity>,
  entity: ManagedEntity,
): HashMap.HashMap<EntityId, ManagedEntity> =>
  HashMap.set(map, entity.entityId, entity)

// ─── collectBreedingCandidates ────────────────────────────────────────────────

describe('collectBreedingCandidates — empty map', () => {
  it('returns an empty array for no entities', () => {
    const result = collectBreedingCandidates(HashMap.empty())
    expect(result).toHaveLength(0)
  })
})

describe('collectBreedingCandidates — entity not in love', () => {
  it('excludes entities with loveTicksRemaining=0', () => {
    const entity = makeEntity({ loveTicksRemaining: 0 })
    const map = addEntity(HashMap.empty(), entity)
    const result = collectBreedingCandidates(map)
    expect(result).toHaveLength(0)
  })
})

describe('collectBreedingCandidates — baby entity in love', () => {
  it('excludes baby entities even when in love', () => {
    const baby = makeEntity({ loveTicksRemaining: 100, ageTicks: BABY_GROW_TICKS - 1 })
    const map = addEntity(HashMap.empty(), baby)
    const result = collectBreedingCandidates(map)
    expect(result).toHaveLength(0)
  })
})

describe('collectBreedingCandidates — adult entity in love', () => {
  const adult = makeEntity({
    entityId: EntityId.make('cow-1'),
    loveTicksRemaining: 100,
    ageTicks: BABY_GROW_TICKS,
    position: { x: 10, y: 64, z: 20 },
  })
  const map = addEntity(HashMap.empty(), adult)
  const result = collectBreedingCandidates(map)

  it('includes the adult entity', () => {
    expect(result).toHaveLength(1)
  })

  it('carries the correct entity id', () => {
    expect(String(result[0]!.id)).toBe(String(adult.entityId))
  })

  it('carries the correct entity type', () => {
    expect(result[0]!.type).toBe(EntityType.Cow)
  })

  it('carries the correct position', () => {
    expect(result[0]!.position).toEqual({ x: 10, y: 64, z: 20 })
  })
})

describe('collectBreedingCandidates — mixed population', () => {
  it('returns only love-mode adults from a mixed map', () => {
    const adult1 = makeEntity({
      entityId: EntityId.make('cow-1'),
      loveTicksRemaining: 100,
      ageTicks: BABY_GROW_TICKS,
    })
    const adult2 = makeEntity({
      entityId: EntityId.make('cow-2'),
      loveTicksRemaining: 0, // not in love
      ageTicks: BABY_GROW_TICKS,
    })
    const baby = makeEntity({
      entityId: EntityId.make('calf-1'),
      loveTicksRemaining: 50,
      ageTicks: 0, // baby
    })
    let map = HashMap.empty<EntityId, ManagedEntity>()
    map = addEntity(map, adult1)
    map = addEntity(map, adult2)
    map = addEntity(map, baby)
    const result = collectBreedingCandidates(map)
    expect(result).toHaveLength(1)
    expect(String(result[0]!.id)).toBe(String(adult1.entityId))
  })
})
