import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { AIState, computeStateVelocity, distanceToPlayer, resolveAIState } from '@ts-minecraft/entities'
import type { AITransitionContext } from '@ts-minecraft/entities'

describe('ai/stateMachine', () => {
  describe('resolveAIState', () => {
    const baseHostile: AITransitionContext = {
      behavior: 'hostile',
      attackRange: 1.6,
      detectionRange: 16,
      fleeHealthThreshold: 0.1,
      randomWanderRoll: 0.9,
      healthRatio: 1.0,
      distanceToPlayer: 8,
      canSeePlayer: false,
    }

    const basePassive: AITransitionContext = {
      behavior: 'passive',
      attackRange: 0.5,
      detectionRange: 12,
      fleeHealthThreshold: 0.6,
      randomWanderRoll: 0.9,
      healthRatio: 1.0,
      distanceToPlayer: 6,
      canSeePlayer: false,
    }

    type ResolveCase = [AIState, AITransitionContext, AIState, string]

    const cases: ResolveCase[] = [
      [
        AIState.Chase,
        { ...baseHostile, canSeePlayer: true, distanceToPlayer: 1.2 },
        AIState.Attack,
        'hostile + canSee + in attackRange → Attack',
      ],
      [
        AIState.Idle,
        { ...baseHostile, canSeePlayer: true, distanceToPlayer: 8, healthRatio: 1.0 },
        AIState.Chase,
        'hostile + canSee + in detectionRange + healthy → Chase',
      ],
      [
        AIState.Idle,
        { ...baseHostile, canSeePlayer: true, distanceToPlayer: 8, healthRatio: 0.05 },
        AIState.Flee,
        'hostile + canSee + in detectionRange + low health → Flee',
      ],
      [
        AIState.Idle,
        { ...basePassive, canSeePlayer: true, distanceToPlayer: 6 },
        AIState.Flee,
        'passive + canSee + in detectionRange → Flee',
      ],
      [
        AIState.Idle,
        { ...basePassive, canSeePlayer: false, distanceToPlayer: 30, randomWanderRoll: 0.01 },
        AIState.Wander,
        'no player seen + low roll (< 0.08) from Idle → Wander',
      ],
      [
        AIState.Wander,
        { ...basePassive, canSeePlayer: false, distanceToPlayer: 30, randomWanderRoll: 0.3 },
        AIState.Wander,
        'Wander state + mid roll (0.3 < 0.5) → stays Wander',
      ],
      [
        AIState.Idle,
        { ...basePassive, canSeePlayer: false, distanceToPlayer: 30, randomWanderRoll: 0.9 },
        AIState.Idle,
        'no player + high roll + Idle → Idle',
      ],
    ]

    Arr.forEach(cases, ([currentState, context, expected, label]) => {
      it(label, () => {
        expect(resolveAIState(currentState, context)).toBe(expected)
      })
    })
  })

  describe('distanceToPlayer', () => {
    it('returns 0 for same position', () => {
      const pos = { x: 5, y: 64, z: 3 }
      expect(distanceToPlayer(pos, pos)).toBeCloseTo(0, 10)
    })

    it('returns 5 for a 3-4-5 triangle (player at (3,0,4) from origin)', () => {
      expect(distanceToPlayer({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })).toBeCloseTo(5, 10)
    })

    it('is symmetric: dist(A,B) === dist(B,A)', () => {
      const a = { x: 1, y: 2, z: 3 }
      const b = { x: 7, y: 5, z: -1 }
      expect(distanceToPlayer(a, b)).toBeCloseTo(distanceToPlayer(b, a), 10)
    })
  })

  describe('computeStateVelocity', () => {
    const entityPosition = { x: 0, y: 64, z: 0 }
    const playerPosition = { x: 10, y: 64, z: 0 }

    it('returns velocity towards player while chasing', () => {
      const velocity = computeStateVelocity({
        state: AIState.Chase,
        entityPosition,
        playerPosition,
        speed: 2,
        wanderDirection: { x: 1, y: 0, z: 0 },
      })
      expect(velocity.x).toBeCloseTo(2, 5)
      expect(velocity.z).toBeCloseTo(0, 5)
    })

    it('returns velocity away from player while fleeing', () => {
      const velocity = computeStateVelocity({
        state: AIState.Flee,
        entityPosition,
        playerPosition,
        speed: 2,
        wanderDirection: { x: 1, y: 0, z: 0 },
      })
      expect(velocity.x).toBeCloseTo(-2, 5)
      expect(velocity.z).toBeCloseTo(0, 5)
    })

    it('returns zero velocity in Idle state', () => {
      const velocity = computeStateVelocity({
        state: AIState.Idle,
        entityPosition,
        playerPosition,
        speed: 2,
        wanderDirection: { x: 1, y: 0, z: 0 },
      })
      expect(velocity).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('returns zero velocity in Attack state', () => {
      const velocity = computeStateVelocity({
        state: AIState.Attack,
        entityPosition,
        playerPosition,
        speed: 2,
        wanderDirection: { x: 1, y: 0, z: 0 },
      })
      expect(velocity).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('returns scaled wander direction in Wander state', () => {
      const velocity = computeStateVelocity({
        state: AIState.Wander,
        entityPosition,
        playerPosition,
        speed: 3,
        wanderDirection: { x: 0, y: 0, z: 1 },
      })
      expect(velocity.x).toBeCloseTo(0, 5)
      expect(velocity.y).toBeCloseTo(0, 5)
      expect(velocity.z).toBeCloseTo(3, 5)
    })
  })
})
