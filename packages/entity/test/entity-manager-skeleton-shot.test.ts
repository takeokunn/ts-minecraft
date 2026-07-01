import { describe, expect, it } from 'vitest'
import { canSkeletonShootPlayer } from '@ts-minecraft/entity/application/mob/entity-manager-skeleton-shot'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import { identity, zero } from '@ts-minecraft/core'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PLAYER = { x: 0, y: 64, z: 0 }

const makeSkeleton = (overrides: Partial<ManagedEntity> = {}): ManagedEntity => ({
  entityId: EntityId.make('skeleton-1'),
  type: EntityType.Skeleton,
  position: { x: 5, y: 64, z: 0 }, // within default attackRange=16
  velocity: zero,
  rotation: identity,
  health: 20,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 4,
  speed: 2,
  detectionRange: 24,
  attackRange: 16, // skeleton has longer range
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

// ─── canSkeletonShootPlayer ───────────────────────────────────────────────────

describe('canSkeletonShootPlayer — within range', () => {
  it('returns true when skeleton is in range and path is not blocked', () => {
    expect(canSkeletonShootPlayer(makeSkeleton(), PLAYER, () => false)).toBe(true)
  })

  it('returns true when no blocker is provided (undefined)', () => {
    expect(canSkeletonShootPlayer(makeSkeleton(), PLAYER, undefined)).toBe(true)
  })
})

describe('canSkeletonShootPlayer — out of range', () => {
  it('returns false when player is beyond attackRange', () => {
    const farSkeleton = makeSkeleton({ position: { x: 30, y: 64, z: 0 } }) // > 16
    expect(canSkeletonShootPlayer(farSkeleton, PLAYER, () => false)).toBe(false)
  })
})

describe('canSkeletonShootPlayer — path blocked', () => {
  it('returns false when the shot path is blocked', () => {
    // Blocker that always returns true → path is always blocked
    expect(canSkeletonShootPlayer(makeSkeleton(), PLAYER, () => true)).toBe(false)
  })
})
