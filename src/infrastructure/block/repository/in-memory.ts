import { Effect, Layer } from 'effect'
import { BlockRepository, BlockRepositoryError, type BlockRepository as BlockRepositoryService } from '@domain/block/repository/block_repository'
import type { BlockDefinition } from '@domain/block/types'
import type { BlockId } from '@domain/block/value_object'

const makeInMemory = Effect.sync(() => {
  const storage = new Map<BlockId, BlockDefinition>()

  const insert: BlockRepositoryService['insert'] = (definition) =>
    storage.has(definition.identity.id)
      ? Effect.fail(BlockRepositoryError.AlreadyExists({ id: definition.identity.id }))
      : Effect.sync(() => {
          storage.set(definition.identity.id, definition)
          return definition
        })

  const upsert: BlockRepositoryService['upsert'] = (definition) =>
    Effect.sync(() => {
      storage.set(definition.identity.id, definition)
      return definition
    })

  const get: BlockRepositoryService['get'] = (id) =>
    storage.has(id) ? Effect.sync(() => storage.get(id)!) : Effect.fail(BlockRepositoryError.NotFound({ id }))

  const list: BlockRepositoryService['list'] = Effect.sync(() => Array.from(storage.values()))

  const filterByTag: BlockRepositoryService['filterByTag'] = (tag) =>
    Effect.sync(() => Array.from(storage.values()).filter((definition) => definition.identity.tags.includes(tag)))

  const remove: BlockRepositoryService['remove'] = (id) => Effect.sync(() => storage.delete(id))

  return BlockRepository.of({ insert, upsert, get, list, filterByTag, remove })
})

export const BlockRepositoryInMemoryLayer = Layer.effect(BlockRepository, makeInMemory)
