import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { AIState, computeStateVelocity, computeStateVelocityInto, distanceToPlayer, resolveAIState } from '@ts-minecraft/entity'
import type { AITransitionContext } from '@ts-minecraft/entity'

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
        'no player seen + low roll (< 0.25) from Idle → Wander',
      ],
      [
        AIState.Idle,
        { ...basePassive, canSeePlayer: false, distanceToPlayer: 30, randomWanderRoll: 0.2 },
        AIState.Wander,
        'no player seen + active roll (0.2 < 0.25) from Idle → Wander',
      ],
      [
        AIState.Wander,
        { ...basePassive, canSeePlayer: false, distanceToPlayer: 30, randomWanderRoll: 0.3 },
        AIState.Wander,
        'Wander state + mid roll (0.3 < 0.85) → stays Wander',
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

  describe('computeStateVelocityInto', () => {
    // The -Into variant must match computeStateVelocity exactly under horizontal targeting
    // (toHorizontalTarget sets the target y to the entity's y, so chase/flee direction.y = 0).
    const cases: ReadonlyArray<{
      readonly state: AIState
      readonly entity: { x: number; y: number; z: number }
      readonly player: { x: number; y: number; z: number }
      readonly speed: number
      readonly wander: { x: number; y: number; z: number }
    }> = [
      { state: AIState.Chase, entity: { x: 0, y: 64, z: 0 }, player: { x: 10, y: 70, z: 0 }, speed: 2, wander: { x: 1, y: 0, z: 0 } },
      { state: AIState.Flee, entity: { x: 3, y: 64, z: -5 }, player: { x: 10, y: 12, z: 7 }, speed: 1.5, wander: { x: 1, y: 0, z: 0 } },
      { state: AIState.Wander, entity: { x: 0, y: 64, z: 0 }, player: { x: 10, y: 64, z: 0 }, speed: 3, wander: { x: 0.2, y: 0.4, z: 1 } },
      { state: AIState.Idle, entity: { x: 0, y: 64, z: 0 }, player: { x: 10, y: 64, z: 0 }, speed: 2, wander: { x: 1, y: 0, z: 0 } },
      { state: AIState.Attack, entity: { x: 0, y: 64, z: 0 }, player: { x: 10, y: 64, z: 0 }, speed: 2, wander: { x: 1, y: 0, z: 0 } },
      // zero-length chase direction (entity at player x/z) → zero vector, matching normalize()
      { state: AIState.Chase, entity: { x: 5, y: 64, z: 5 }, player: { x: 5, y: 99, z: 5 }, speed: 4, wander: { x: 1, y: 0, z: 0 } },
    ]

    it('writes the same x/z as computeStateVelocity for every state (horizontal targeting)', () => {
      for (const c of cases) {
        const expected = computeStateVelocity({
          state: c.state,
          entityPosition: c.entity,
          // toHorizontalTarget: player x/z, entity y
          playerPosition: { x: c.player.x, y: c.entity.y, z: c.player.z },
          speed: c.speed,
          wanderDirection: c.wander,
        })
        const out = { x: NaN, y: NaN, z: NaN }
        computeStateVelocityInto(
          out,
          c.state,
          c.entity.x, c.entity.z,
          c.player.x, c.player.z,
          c.speed,
          c.wander.x, c.wander.y, c.wander.z,
        )
        expect(out.x).toBeCloseTo(expected.x, 10)
        expect(out.z).toBeCloseTo(expected.z, 10)
      }
    })
  })
})
