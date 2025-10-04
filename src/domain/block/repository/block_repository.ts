import { Context, Effect, Layer } from 'effect'
import type { BlockId, BlockTag } from '../value_object/block_identity'
import type { BlockDefinition } from '../types/block_definition'
import { BlockRepositoryError } from './types/repository_error'

export { BlockRepositoryError } from './types/repository_error'

export interface BlockRepository {
  readonly insert: (
    definition: BlockDefinition
  ) => Effect.Effect<BlockDefinition, BlockRepositoryError>

  readonly upsert: (
    definition: BlockDefinition
  ) => Effect.Effect<BlockDefinition>

  readonly get: (
    id: BlockId
  ) => Effect.Effect<BlockDefinition, BlockRepositoryError>

  readonly list: Effect.Effect<ReadonlyArray<BlockDefinition>>

  readonly filterByTag: (
    tag: BlockTag
  ) => Effect.Effect<ReadonlyArray<BlockDefinition>>

  readonly remove: (
    id: BlockId
  ) => Effect.Effect<boolean>
}

export const BlockRepository = Context.GenericTag<BlockRepository>('BlockRepository')

export const makeInMemory = Effect.sync(() => {
  const storage = new Map<BlockId, BlockDefinition>()

  const insert: BlockRepository['insert'] = (definition) =>
    storage.has(definition.identity.id)
      ? Effect.fail(BlockRepositoryError.AlreadyExists({ id: definition.identity.id }))
      : Effect.sync(() => {
          storage.set(definition.identity.id, definition)
          return definition
        })

  const upsert: BlockRepository['upsert'] = (definition) =>
    Effect.sync(() => {
      storage.set(definition.identity.id, definition)
      return definition
    })

  const get: BlockRepository['get'] = (id) =>
    storage.has(id)
      ? Effect.sync(() => storage.get(id)!)
      : Effect.fail(BlockRepositoryError.NotFound({ id }))

  const list: BlockRepository['list'] = Effect.sync(() => Array.from(storage.values()))

  const filterByTag: BlockRepository['filterByTag'] = (tag) =>
    Effect.sync(() => Array.from(storage.values()).filter((definition) => definition.identity.tags.includes(tag)))

  const remove: BlockRepository['remove'] = (id) =>
    Effect.sync(() => storage.delete(id))

  return BlockRepository.of({ insert, upsert, get, list, filterByTag, remove })
})

export const BlockRepositoryLayer = Layer.effect(BlockRepository, makeInMemory)
