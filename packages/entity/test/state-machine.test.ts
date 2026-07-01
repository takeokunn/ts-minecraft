import { describe, expect, it } from 'vitest'
import {
  AIState,
  resolveAIState,
  distanceToPlayer,
  distanceToPlayerSq,
  computeStateVelocity,
  type AITransitionContext,
  type AIMotionContext,
} from '@ts-minecraft/entity/domain/mob/state-machine'

// ─── helpers ─────────────────────────────────────────────────────────────────

const baseContext = (): AITransitionContext => ({
  behavior: 'hostile',
  distanceToPlayer: 10,
  canSeePlayer: false,
  healthRatio: 1.0,
  randomWanderRoll: 0.5,
  attackRange: 2,
  detectionRange: 16,
  fleeHealthThreshold: 0.2,
})

const pos = (x: number, y: number, z: number) => ({ x, y, z })

// ─── resolveAIState ───────────────────────────────────────────────────────────
describe('resolveAIState', () => {
  it('returns Attack when hostile, can see player, and within attack range', () => {
    const ctx = { ...baseContext(), canSeePlayer: true, distanceToPlayer: 1 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Attack)
  })

  it('returns Chase when hostile, can see player, in detection range, above flee threshold', () => {
    const ctx = { ...baseContext(), canSeePlayer: true, distanceToPlayer: 10, healthRatio: 0.8 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Chase)
  })

  it('returns Flee when hostile, can see player, in range, below flee health threshold', () => {
    const ctx = { ...baseContext(), canSeePlayer: true, distanceToPlayer: 10, healthRatio: 0.1 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Flee)
  })

  it('passive mobs flee when they see the player in range', () => {
    const ctx = { ...baseContext(), behavior: 'passive' as const, canSeePlayer: true, distanceToPlayer: 10 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Flee)
  })

  it('returns Wander when randomWanderRoll is below threshold (0.25)', () => {
    const ctx = { ...baseContext(), randomWanderRoll: 0.1 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Wander)
  })

  it('continues Wander when currently wandering and roll < 0.85', () => {
    const ctx = { ...baseContext(), randomWanderRoll: 0.5 }
    expect(resolveAIState(AIState.Wander, ctx)).toBe(AIState.Wander)
  })

  it('returns Idle when not wandering and roll is high', () => {
    const ctx = { ...baseContext(), randomWanderRoll: 0.9 }
    expect(resolveAIState(AIState.Idle, ctx)).toBe(AIState.Idle)
  })

  it('returns Idle from Wander when roll exceeds Wander-continue threshold', () => {
    const ctx = { ...baseContext(), randomWanderRoll: 0.9 }
    expect(resolveAIState(AIState.Wander, ctx)).toBe(AIState.Idle)
  })
})

// ─── distanceToPlayer ─────────────────────────────────────────────────────────
describe('distanceToPlayer', () => {
  it('returns 0 when both at the same position', () => {
    expect(distanceToPlayer(pos(0, 0, 0), pos(0, 0, 0))).toBe(0)
  })

  it('computes distance along X', () => {
    expect(distanceToPlayer(pos(0, 0, 0), pos(3, 4, 0))).toBe(5)
  })
})

// ─── distanceToPlayerSq ───────────────────────────────────────────────────────
describe('distanceToPlayerSq', () => {
  it('returns squared distance', () => {
    expect(distanceToPlayerSq(pos(0, 0, 0), pos(3, 4, 0))).toBe(25)
  })
})

// ─── computeStateVelocity ─────────────────────────────────────────────────────
describe('computeStateVelocity', () => {
  const makeCtx = (state: AIState): AIMotionContext => ({
    state,
    entityPosition: pos(0, 0, 0),
    playerPosition: pos(1, 0, 0),
    speed: 2,
    wanderDirection: { x: 0, y: 0, z: 1 },
  })

  it('returns zero velocity for Idle', () => {
    const v = computeStateVelocity(makeCtx(AIState.Idle))
    expect(v.x).toBe(0)
    expect(v.z).toBe(0)
  })

  it('returns zero velocity for Attack', () => {
    const v = computeStateVelocity(makeCtx(AIState.Attack))
    expect(v.x).toBe(0)
    expect(v.z).toBe(0)
  })

  it('returns +speed toward the player for Chase', () => {
    const v = computeStateVelocity(makeCtx(AIState.Chase))
    expect(v.x).toBeCloseTo(2) // player is at x+1, unit dir = (1,0,0) * speed=2
  })

  it('returns -speed away from the player for Flee', () => {
    const v = computeStateVelocity(makeCtx(AIState.Flee))
    expect(v.x).toBeCloseTo(-2)
  })

  it('moves in wanderDirection for Wander', () => {
    const v = computeStateVelocity(makeCtx(AIState.Wander))
    expect(v.x).toBeCloseTo(0)
    expect(v.z).toBeCloseTo(2)
  })
})
