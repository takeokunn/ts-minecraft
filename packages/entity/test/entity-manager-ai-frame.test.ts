import { describe, expect, it } from 'vitest'
import { prepareEntityAIFrame } from '@ts-minecraft/entity/application/mob/entity-manager-ai-frame'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { BABY_GROW_TICKS } from '@ts-minecraft/entity/domain/mob/breeding'
import { DeltaTimeSecs, identity, zero } from '@ts-minecraft/core'
import type { EntityFrameContext } from '@ts-minecraft/entity/application/mob/entity-manager-ai-frame'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeZombie = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
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
  ageTicks: BABY_GROW_TICKS,
  woolRegrowthTicks: 0,
  dragonPhase: null,
  dragonDeathProgress: null,
  ...overrides,
})

const makeCow = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
  ...makeZombie(),
  entityId: EntityId.make('cow-1'),
  type: EntityType.Cow,
  behavior: 'passive',
  attackDamage: 0,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  ...overrides,
})

const makeFarCtx = (overrides: Partial<EntityFrameContext> = {}): EntityFrameContext => ({
  tick: 0,
  deltaTime: DeltaTimeSecs.make(0.05),
  playerPosition: { x: 1000, y: 64, z: 1000 }, // far away → out of detection range
  playerLookOrigin: { x: 1000, y: 64, z: 1000 },
  playerLookDirection: undefined,
  playerLookBlocked: undefined,
  daytimeBurningActive: false,
  ...overrides,
})

// Within detectionRange=16 but outside attackRange=2 → Chase state
const makeNearCtx = (overrides: Partial<EntityFrameContext> = {}): EntityFrameContext =>
  makeFarCtx({ playerPosition: { x: 5, y: 64, z: 0 }, ...overrides })

// ─── prepareEntityAIFrame — health ────────────────────────────────────────────

describe('prepareEntityAIFrame — no damage when not burning and not on fire', () => {
  it('nextHealth equals current health', () => {
    const entity = makeZombie({ health: 20 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx())
    expect(result.nextHealth).toBe(20)
  })
})

describe('prepareEntityAIFrame — daytime burning', () => {
  it('burning=true when daytimeBurningActive and entity is hostile', () => {
    const entity = makeZombie()
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ daytimeBurningActive: true }))
    expect(result.burning).toBe(true)
  })

  it('burning=false for passive entities even when daytimeBurningActive', () => {
    const cow = makeCow()
    const result = prepareEntityAIFrame(cow, cow.entityId, makeFarCtx({ daytimeBurningActive: true }))
    expect(result.burning).toBe(false)
  })

  it('reduces health by 1 per frame when burning', () => {
    const entity = makeZombie({ health: 20 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ daytimeBurningActive: true }))
    expect(result.nextHealth).toBe(19)
  })
})

// ─── prepareEntityAIFrame — fire tick ─────────────────────────────────────────

describe('prepareEntityAIFrame — fire tick propagated', () => {
  it('fireTick.damage=0 when entity is not on fire', () => {
    const entity = makeZombie({ fireSecsRemaining: 0 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx())
    expect(result.fireTick.damage).toBe(0)
  })

  it('fireTick has the remaining fire seconds reduced', () => {
    const entity = makeZombie({ fireSecsRemaining: 2, fireDamageAccumulatorSecs: 0 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ deltaTime: DeltaTimeSecs.make(0.5) }))
    expect(result.fireTick.fireSecsRemaining).toBeCloseTo(1.5)
  })
})

// ─── prepareEntityAIFrame — attack cooldown ───────────────────────────────────

describe('prepareEntityAIFrame — attack cooldown', () => {
  it('ticks down attackCooldownRemaining by deltaTime', () => {
    const entity = makeZombie({ attackCooldownRemaining: 1.0 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ deltaTime: DeltaTimeSecs.make(0.5) }))
    expect(result.nextAttackCooldown).toBeCloseTo(0.5)
  })

  it('clamps attackCooldownRemaining to 0', () => {
    const entity = makeZombie({ attackCooldownRemaining: 0.1 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ deltaTime: DeltaTimeSecs.make(0.5) }))
    expect(result.nextAttackCooldown).toBe(0)
  })
})

// ─── prepareEntityAIFrame — AI state ─────────────────────────────────────────

describe('prepareEntityAIFrame — AI state with player nearby', () => {
  it('hostile entity transitions to Chase when player enters detection range', () => {
    const entity = makeZombie({ aiState: AIState.Wander })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeNearCtx())
    expect(result.nextState).toBe(AIState.Chase)
  })
})

describe('prepareEntityAIFrame — AI state with player far', () => {
  it('hostile entity stays in Wander when player is out of range', () => {
    const entity = makeZombie({ aiState: AIState.Wander })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx())
    // Wander or Idle depending on random roll; both are valid non-chase states
    expect(result.nextState).not.toBe(AIState.Chase)
    expect(result.nextState).not.toBe(AIState.Attack)
  })
})

// ─── prepareEntityAIFrame — breeding timers ───────────────────────────────────

describe('prepareEntityAIFrame — breeding timers', () => {
  it('breedingChanged=true when loveTicksRemaining ticks down', () => {
    const entity = makeCow({ loveTicksRemaining: 100, ageTicks: BABY_GROW_TICKS })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ deltaTime: DeltaTimeSecs.make(0.05) }))
    expect(result.breedingChanged).toBe(true)
  })

  it('breedingChanged=false when no breeding timers active', () => {
    const entity = makeCow({ loveTicksRemaining: 0, breedCooldownRemaining: 0 })
    const result = prepareEntityAIFrame(entity, entity.entityId, makeFarCtx({ deltaTime: DeltaTimeSecs.make(0.05) }))
    expect(result.breedingChanged).toBe(false)
  })
})
