import { Context, Effect } from 'effect'
import type { BlockDefinition } from '../types'
import type { BlockId, BlockTag } from '../value_object'
import { BlockRepositoryError } from './types'

export { BlockRepositoryError } from './types'

export interface BlockRepository {
  readonly insert: (definition: BlockDefinition) => Effect.Effect<BlockDefinition, BlockRepositoryError>

  readonly upsert: (definition: BlockDefinition) => Effect.Effect<BlockDefinition>

  readonly get: (id: BlockId) => Effect.Effect<BlockDefinition, BlockRepositoryError>

  readonly list: Effect.Effect<ReadonlyArray<BlockDefinition>>

  readonly filterByTag: (tag: BlockTag) => Effect.Effect<ReadonlyArray<BlockDefinition>>

  readonly remove: (id: BlockId) => Effect.Effect<boolean>
}

export const BlockRepository = Context.GenericTag<BlockRepository>('BlockRepository')
