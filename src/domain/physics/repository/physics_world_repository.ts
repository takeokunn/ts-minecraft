import { Context, Effect, Layer, Option, Ref } from 'effect'
import type { PhysicsWorld, PhysicsWorldId } from '../types/core'
import type { PhysicsError } from '../types/errors'

export interface PhysicsWorldRepository {
  readonly save: (world: PhysicsWorld) => Effect.Effect<void, PhysicsError>
  readonly find: (worldId: PhysicsWorldId) => Effect.Effect<Option.Option<PhysicsWorld>, PhysicsError>
  readonly remove: (worldId: PhysicsWorldId) => Effect.Effect<void, PhysicsError>
}

export const PhysicsWorldRepository = Context.Tag<PhysicsWorldRepository>(
  '@minecraft/physics/PhysicsWorldRepository'
)

export const PhysicsWorldRepositoryLive = Layer.effect(
  PhysicsWorldRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<PhysicsWorldId, PhysicsWorld>())

    const save: PhysicsWorldRepository['save'] = (world) =>
      Ref.update(store, (current) => {
        const updated = new Map(current)
        updated.set(world.id, world)
        return updated
      })

    const find: PhysicsWorldRepository['find'] = (worldId) =>
      Effect.map(Ref.get(store), (current) => Option.fromNullable(current.get(worldId)))

    const remove: PhysicsWorldRepository['remove'] = (worldId) =>
      Ref.update(store, (current) => {
        const updated = new Map(current)
        updated.delete(worldId)
        return updated
      })

    return {
      save,
      find,
      remove,
    }
  })
)
