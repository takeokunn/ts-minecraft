import { describe, expect, it } from 'vitest'
import { AIState, computeStateVelocity, resolveAIState } from '@/ai/stateMachine'

describe('ai/stateMachine', () => {
  describe('resolveAIState', () => {
    it('transitions to Chase for hostile mobs that can see the player in range', () => {
      const state = resolveAIState(AIState.Idle, {
        behavior: 'hostile',
        distanceToPlayer: 8,
        canSeePlayer: true,
        healthRatio: 1,
        randomWanderRoll: 0.9,
        attackRange: 1.6,
        detectionRange: 16,
        fleeHealthThreshold: 0.1,
      })

      expect(state).toBe(AIState.Chase)
    })

    it('transitions to Flee for passive mobs that detect the player', () => {
      const state = resolveAIState(AIState.Idle, {
        behavior: 'passive',
        distanceToPlayer: 6,
        canSeePlayer: true,
        healthRatio: 1,
        randomWanderRoll: 0.9,
        attackRange: 0,
        detectionRange: 12,
        fleeHealthThreshold: 0.6,
      })

      expect(state).toBe(AIState.Flee)
    })

    it('transitions to Attack for hostile mobs in attack range', () => {
      const state = resolveAIState(AIState.Chase, {
        behavior: 'hostile',
        distanceToPlayer: 1.2,
        canSeePlayer: true,
        healthRatio: 1,
        randomWanderRoll: 0.9,
        attackRange: 1.6,
        detectionRange: 16,
        fleeHealthThreshold: 0.1,
      })

      expect(state).toBe(AIState.Attack)
    })

    it('transitions to Wander from Idle on low random roll when no player is detected', () => {
      const state = resolveAIState(AIState.Idle, {
        behavior: 'passive',
        distanceToPlayer: 30,
        canSeePlayer: false,
        healthRatio: 1,
        randomWanderRoll: 0.01,
        attackRange: 0,
        detectionRange: 12,
        fleeHealthThreshold: 0.6,
      })

      expect(state).toBe(AIState.Wander)
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
  })
})
