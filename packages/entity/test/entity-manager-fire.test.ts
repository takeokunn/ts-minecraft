import { describe, expect, it } from 'vitest'
import { tickEntityFire } from '@ts-minecraft/entity/application/mob/entity-manager-fire'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { DeltaTimeSecs, identity, zero } from '@ts-minecraft/core'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeEntity = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
  entityId: EntityId.make('zombie-1'),
  type: EntityType.Zombie,
  position: { x: 0, y: 64, z: 0 },
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

const dt = (secs: number) => DeltaTimeSecs.make(secs)

// ─── tickEntityFire — entity not on fire ─────────────────────────────────────

describe('tickEntityFire — entity not on fire', () => {
  const entity = makeEntity({ fireSecsRemaining: 0, fireDamageAccumulatorSecs: 0 })

  it('returns zero damage', () => {
    const result = tickEntityFire(entity, dt(0.05))
    expect(result.damage).toBe(0)
  })

  it('returns changed=false when already clean (no state to clear)', () => {
    const result = tickEntityFire(entity, dt(0.05))
    expect(result.changed).toBe(false)
  })

  it('zeroes out fireSecsRemaining and accumulator', () => {
    const result = tickEntityFire(entity, dt(0.05))
    expect(result.fireSecsRemaining).toBe(0)
    expect(result.fireDamageAccumulatorSecs).toBe(0)
  })

  it('marks changed=true when clearing a non-zero accumulator (fire just expired)', () => {
    const justExpired = makeEntity({ fireSecsRemaining: 0, fireDamageAccumulatorSecs: 0.5 })
    const result = tickEntityFire(justExpired, dt(0.05))
    expect(result.changed).toBe(true)
    expect(result.fireDamageAccumulatorSecs).toBe(0)
  })
})

// ─── tickEntityFire — entity on fire ─────────────────────────────────────────

describe('tickEntityFire — entity on fire, no damage yet', () => {
  // 2s fire remaining, 0.5s delta → 1.5s remaining; accumulator = 0.5 → damage = floor(0.5) = 0
  const entity = makeEntity({ fireSecsRemaining: 2, fireDamageAccumulatorSecs: 0 })

  it('reduces fireSecsRemaining by deltaTime', () => {
    const result = tickEntityFire(entity, dt(0.5))
    expect(result.fireSecsRemaining).toBeCloseTo(1.5)
  })

  it('deals no damage while accumulator < 1 second', () => {
    const result = tickEntityFire(entity, dt(0.5))
    expect(result.damage).toBe(0)
  })

  it('marks changed=true when fire ticks down', () => {
    const result = tickEntityFire(entity, dt(0.5))
    expect(result.changed).toBe(true)
  })
})

describe('tickEntityFire — full second of burning deals 1 damage', () => {
  // Start with 0.9s accumulator + 0.2s delta → accumulator crosses 1.0 → damage = 1
  const entity = makeEntity({ fireSecsRemaining: 3, fireDamageAccumulatorSecs: 0.9 })

  it('deals 1 damage when accumulator reaches 1 second', () => {
    const result = tickEntityFire(entity, dt(0.2))
    expect(result.damage).toBe(1)
  })

  it('carries forward remaining fractional accumulator', () => {
    const result = tickEntityFire(entity, dt(0.2))
    // accumulator = 0.9 + 0.2 = 1.1 → damage = 1 → remainder = 0.1
    expect(result.fireDamageAccumulatorSecs).toBeCloseTo(0.1)
  })
})

describe('tickEntityFire — fire expires mid-tick', () => {
  // 0.3s remaining, delta=0.5 → fire expires, accumulator carries over 0.3s → damage = 0
  const entity = makeEntity({ fireSecsRemaining: 0.3, fireDamageAccumulatorSecs: 0 })

  it('clamps fireSecsRemaining to 0 when delta exceeds remaining fire', () => {
    const result = tickEntityFire(entity, dt(0.5))
    expect(result.fireSecsRemaining).toBe(0)
  })

  it('zeroes the accumulator when fire is fully consumed', () => {
    const result = tickEntityFire(entity, dt(0.5))
    // fire expired → fireDamageAccumulatorSecs reset to 0
    expect(result.fireDamageAccumulatorSecs).toBe(0)
  })
})
