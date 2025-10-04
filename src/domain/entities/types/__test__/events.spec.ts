import { describe, expect, it } from '@effect/vitest'
import { Either, Schema } from 'effect'
import { BrandedTypes } from '../core'
import {
  EntityDespawnedEventSchema,
  EntityEventSchema,
  EntitySpawnedEventSchema,
  EntityUpdatedEventSchema,
  makeEntityDespawnedEvent,
  makeEntitySpawnedEvent,
  makeEntityUpdatedEvent,
} from '../events'
import { ENTITY_TYPES } from '../constants'

describe('entities/types/events', () => {
  const entityId = BrandedTypes.createEntityId('entity_evt')
  const position = BrandedTypes.createVector3D(1, 64, 1)

  it('creates spawn events with schema guarantees', () => {
    const event = makeEntitySpawnedEvent({
      eventId: 'evt_spawn',
      occurredAt: 10,
      source: 'test',
      entityId,
      entityType: ENTITY_TYPES.PLAYER,
      spawnPosition: position,
      spawnedBy: undefined,
    })

    expect(Either.isRight(Schema.decodeUnknownEither(EntitySpawnedEventSchema)(event))).toBe(true)
  })

  it('creates update events tracking movement', () => {
    const event = makeEntityUpdatedEvent({
      eventId: 'evt_update',
      occurredAt: 20,
      source: 'test',
      entityId,
      newStatus: undefined,
      newType: undefined,
      position,
      velocity: BrandedTypes.createVector3D(0, 0, 0),
    })

    expect(Either.isRight(Schema.decodeUnknownEither(EntityUpdatedEventSchema)(event))).toBe(true)
  })

  it('creates despawn events with history', () => {
    const event = makeEntityDespawnedEvent({
      eventId: 'evt_despawn',
      occurredAt: 30,
      source: 'test',
      entityId,
      entityType: ENTITY_TYPES.ITEM,
      lastPosition: position,
      reason: 'cleanup',
    })

    expect(Either.isRight(Schema.decodeUnknownEither(EntityDespawnedEventSchema)(event))).toBe(true)
  })

  it('union schema recognises any entity event', () => {
    const event = makeEntityUpdatedEvent({
      eventId: 'evt_union',
      occurredAt: 15,
      source: 'test',
      entityId,
      newStatus: undefined,
      newType: undefined,
      position,
      velocity: BrandedTypes.createVector3D(1, 0, 0),
    })

    expect(Either.isRight(Schema.decodeUnknownEither(EntityEventSchema)(event))).toBe(true)
  })
})
