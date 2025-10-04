import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { ENTITY_TYPES } from '../../types/constants'
import { BrandedTypes } from '../../types/core'
import {
  createEntity,
  integrateTick,
  markDespawned,
  updateEntity,
  type EntityCreateInput,
  type EntityUpdateInput,
} from '../entity'

describe('entities/model/entity', () => {
  const baseInput: EntityCreateInput = {
    id: BrandedTypes.createEntityId('entity_model'),
    type: ENTITY_TYPES.PLAYER,
    position: BrandedTypes.createVector3D(0, 64, 0),
    rotation: BrandedTypes.createRotation(0, 0, 0),
    velocity: BrandedTypes.createVector3D(0, 0, 0),
    tags: ['spawned'],
  }

  it.effect('createEntity builds state with spawn event', () =>
    Effect.gen(function* () {
      const state = yield* createEntity(baseInput)

      expect(state.events.length).toBe(1)
      expect(state.position).toEqual(baseInput.position)
      expect(state.status).toBe('active')
      expect(state.version).toBe(0)
    })
  )

  it.effect('updateEntity applies position patch and records event', () =>
    Effect.gen(function* () {
      const state = yield* createEntity(baseInput)
      const patch: EntityUpdateInput = {
        position: BrandedTypes.createVector3D(10, 70, -10),
      }

      const updated = yield* updateEntity(state, patch)

      expect(updated.position).toEqual(patch.position)
      expect(updated.version).toBe(state.version + 1)
      expect(updated.events.at(-1)?._tag).toBe('EntityUpdatedEvent')
    })
  )

  it.effect('updateEntity rejects empty patch', () =>
    Effect.gen(function* () {
      const state = yield* createEntity(baseInput)
      const result = yield* Effect.either(updateEntity(state, {}))
      expect(result._tag).toBe('Left')
    })
  )

  it.effect('markDespawned transitions status and prevents repeated despawn', () =>
    Effect.gen(function* () {
      const state = yield* createEntity(baseInput)
      const despawned = yield* markDespawned(state, 'cleanup')

      expect(despawned.status).toBe('deleted')
      expect(despawned.events.at(-1)?._tag).toBe('EntityDespawnedEvent')

      const second = yield* Effect.either(markDespawned(despawned, 'duplicate'))
      expect(second._tag).toBe('Left')
    })
  )

  it.effect('integrateTick updates position using displacement', () =>
    Effect.gen(function* () {
      const state = yield* createEntity(baseInput)
      const ticked = yield* integrateTick(state, {
        deltaTime: BrandedTypes.createDeltaTime(50),
        displacement: BrandedTypes.createVector3D(5, -1, 0),
      })

      expect(ticked.position.x).toBeCloseTo(state.position.x + 5)
      expect(ticked.velocity.x).toBeCloseTo(5 / 50)
    })
  )
})
