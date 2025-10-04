import { describe, expect, it } from '@effect/vitest'
import { Schema } from 'effect'
import { ENTITY_TYPES } from '../constants'
import { BrandedTypes } from '../core'
import {
  EntityDomainErrorSchema,
  EntityErrorGuards,
  EntityValidationErrorSchema,
  makeEntityCollisionError,
  makeEntityNotFoundError,
  makeEntitySpawnError,
  makeEntityUpdateError,
  makeEntityValidationError,
} from '../errors'

const entityId = BrandedTypes.createEntityId('entity_error_target')

describe('entities/types/errors', () => {
  it('constructors create schema compliant instances', () => {
    const validation = makeEntityValidationError({
      entityId,
      field: 'test',
      message: 'invalid',
      timestamp: 0,
    })
    expect(EntityValidationErrorSchema.ast).toBeDefined()
    expect(EntityErrorGuards.isValidationError(validation)).toBe(true)

    const update = makeEntityUpdateError({
      entityId,
      attemptedStatus: undefined,
      attemptedType: undefined,
      reason: 'no-op',
      timestamp: 0,
    })
    expect(EntityErrorGuards.isUpdateError(update)).toBe(true)

    const missing = makeEntityNotFoundError({ entityId, context: 'lookup', searchedAt: 0 })
    expect(EntityErrorGuards.isNotFoundError(missing)).toBe(true)

    const spawnError = makeEntitySpawnError({
      entityType: ENTITY_TYPES.PLAYER,
      spawnPosition: BrandedTypes.createVector3D(0, 64, 0),
      reason: 'blocked',
      blockingPlayer: undefined,
      timestamp: 1,
    })
    expect(EntityErrorGuards.isSpawnError(spawnError)).toBe(true)

    const collision = makeEntityCollisionError({
      entityId,
      collisionPoint: BrandedTypes.createVector3D(0, 0, 0),
      collidedWith: undefined,
      collisionNormal: BrandedTypes.createVector3D(0, 1, 0),
      reason: 'solid block',
      timestamp: 2,
    })
    expect(EntityErrorGuards.isCollisionError(collision)).toBe(true)
  })

  it('union schema recognises domain errors', () => {
    const validation = makeEntityValidationError({
      entityId,
      field: 'union',
      message: 'invalid',
      timestamp: 3,
    })
    expect(EntityErrorGuards.isDomainError(validation)).toBe(true)

    const decoded = Schema.decodeUnknownEither(EntityDomainErrorSchema)(validation)
    expect(decoded._tag).toBe('Right')
  })
})
