import { Data } from 'effect'
import type { BlockId } from '../../value_object/block_identity'

type RepositoryErrorDefinition = Data.TaggedEnum<{
  AlreadyExists: { readonly id: BlockId }
  NotFound: { readonly id: BlockId }
}>

export const BlockRepositoryError = Data.taggedEnum<RepositoryErrorDefinition>()
export type BlockRepositoryError = RepositoryErrorDefinition
