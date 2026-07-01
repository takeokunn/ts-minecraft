import { describe, expect, it } from 'vitest'
import { canHostileContactDamagePlayer } from '@ts-minecraft/entity/application/mob/entity-manager-contact-eligibility'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { identity, zero } from '@ts-minecraft/core'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PLAYER = { x: 0, y: 64, z: 0 }

const makeHostile = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
  entityId: EntityId.make('zombie-1'),
  type: EntityType.Zombie,
  position: { x: 1, y: 64, z: 0 }, // within default attackRange=2
  velocity: zero,
  rotation: identity,
  health: 20,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 2,
  detectionRange: 16,
  attackRange: 2,
  fleeHealthThreshold: 0,
  drops: [],
  aiState: AIState.Attack,
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
  ageTicks: 1000,
  woolRegrowthTicks: 0,
  dragonPhase: null,
  dragonDeathProgress: null,
  ...overrides,
})

// ─── canHostileContactDamagePlayer ───────────────────────────────────────────

describe('canHostileContactDamagePlayer — eligible', () => {
  it('returns true for a hostile zombie within attack range with no cooldown', () => {
    expect(canHostileContactDamagePlayer(makeHostile(), PLAYER)).toBe(true)
  })
})

describe('canHostileContactDamagePlayer — ineligible', () => {
  it('returns false when behavior is not hostile', () => {
    expect(canHostileContactDamagePlayer(makeHostile({ behavior: 'passive' }), PLAYER)).toBe(false)
  })

  it('returns false when attackDamage is 0', () => {
    expect(canHostileContactDamagePlayer(makeHostile({ attackDamage: 0 }), PLAYER)).toBe(false)
  })

  it('returns false for Skeleton type (ranged, not contact)', () => {
    expect(canHostileContactDamagePlayer(makeHostile({ type: EntityType.Skeleton }), PLAYER)).toBe(false)
  })

  it('returns false for unprovoked Enderman', () => {
    const ender = makeHostile({ type: EntityType.Enderman, isProvoked: false })
    expect(canHostileContactDamagePlayer(ender, PLAYER)).toBe(false)
  })

  it('returns true for provoked Enderman within range', () => {
    const ender = makeHostile({ type: EntityType.Enderman, isProvoked: true })
    expect(canHostileContactDamagePlayer(ender, PLAYER)).toBe(true)
  })

  it('returns false when attack cooldown is active', () => {
    expect(canHostileContactDamagePlayer(makeHostile({ attackCooldownRemaining: 0.5 }), PLAYER)).toBe(false)
  })

  it('returns false when entity is out of attack range', () => {
    const farEntity = makeHostile({ position: { x: 50, y: 64, z: 0 } })
    expect(canHostileContactDamagePlayer(farEntity, PLAYER)).toBe(false)
  })
})
