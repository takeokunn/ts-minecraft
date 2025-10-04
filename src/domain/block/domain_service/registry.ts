import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import { pipe } from 'effect/Function'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { BlockDefinition } from '../types/block_definition'
import { BlockFactory, BlockFactoryLive } from '../factory/block_factory'
import type { BlockId, BlockTag } from '../value_object/block_identity'
import {
  BlockRepository,
  BlockRepositoryLayer,
} from '../repository/block_repository'
import type { BlockRepositoryError } from '../repository/types/repository_error'
import type { BlockDefinitionError } from '../types/block_definition'
import {
  makeInteractiveBlock,
  makeLiquidBlock,
  makeStandardBlock,
} from '../types/block_definition'

export type BlockRegistryError = Data.TaggedEnum<{
  DefinitionError: { readonly cause: BlockDefinitionError }
  RepositoryError: { readonly cause: BlockRepositoryError }
}>

export const BlockRegistryError = Data.taggedEnum<BlockRegistryError>()

type StandardConfig = Parameters<typeof makeStandardBlock>[0]

type LiquidConfig = Parameters<typeof makeLiquidBlock>[0]

type InteractiveConfig = Parameters<typeof makeInteractiveBlock>[0]

type AnyConfig =
  | ({ readonly kind: 'standard' } & StandardConfig)
  | ({ readonly kind: 'liquid' } & LiquidConfig)
  | ({ readonly kind: 'interactive' } & InteractiveConfig)

export interface BlockRegistryService {
  readonly registerStandard: (
    config: StandardConfig
  ) => Effect.Effect<BlockDefinition, BlockRegistryError>
  readonly registerLiquid: (
    config: LiquidConfig
  ) => Effect.Effect<BlockDefinition, BlockRegistryError>
  readonly registerInteractive: (
    config: InteractiveConfig
  ) => Effect.Effect<BlockDefinition, BlockRegistryError>
  readonly register: (
    config: AnyConfig
  ) => Effect.Effect<BlockDefinition, BlockRegistryError>
  readonly get: (
    id: BlockId
  ) => Effect.Effect<BlockDefinition, BlockRegistryError>
  readonly list: Effect.Effect<ReadonlyArray<BlockDefinition>>
  readonly filterByTag: (
    tag: BlockTag
  ) => Effect.Effect<ReadonlyArray<BlockDefinition>>
  readonly remove: (
    id: BlockId
  ) => Effect.Effect<boolean>
}

export const BlockRegistryService = Context.GenericTag<BlockRegistryService>('BlockRegistryService')

const wrapDefinitionError = (cause: BlockDefinitionError) =>
  BlockRegistryError.DefinitionError({ cause })

const wrapRepositoryError = (cause: BlockRepositoryError) =>
  BlockRegistryError.RepositoryError({ cause })

const makeService = Effect.gen(function* () {
  const factory = yield* BlockFactory
  const repository = yield* BlockRepository

  const registerStandard: BlockRegistryService['registerStandard'] = (config) =>
    Effect.gen(function* () {
      const definition = yield* pipe(
        factory.standard(config),
        Effect.mapError(wrapDefinitionError)
      )
      return yield* pipe(
        repository.insert(definition),
        Effect.mapError(wrapRepositoryError)
      )
    })

  const registerLiquid: BlockRegistryService['registerLiquid'] = (config) =>
    Effect.gen(function* () {
      const definition = yield* pipe(
        factory.liquid(config),
        Effect.mapError(wrapDefinitionError)
      )
      return yield* pipe(
        repository.insert(definition),
        Effect.mapError(wrapRepositoryError)
      )
    })

  const registerInteractive: BlockRegistryService['registerInteractive'] = (config) =>
    Effect.gen(function* () {
      const definition = yield* pipe(
        factory.interactive(config),
        Effect.mapError(wrapDefinitionError)
      )
      return yield* pipe(
        repository.insert(definition),
        Effect.mapError(wrapRepositoryError)
      )
    })

  const register: BlockRegistryService['register'] = (config) =>
    Effect.gen(function* () {
      const definition = yield* pipe(
        factory.fromKind(config),
        Effect.mapError(wrapDefinitionError)
      )
      return yield* pipe(
        repository.insert(definition),
        Effect.mapError(wrapRepositoryError)
      )
    })

  const get: BlockRegistryService['get'] = (id) =>
    pipe(repository.get(id), Effect.mapError(wrapRepositoryError))

  const list: BlockRegistryService['list'] = repository.list

  const filterByTag: BlockRegistryService['filterByTag'] = (tag) => repository.filterByTag(tag)

  const remove: BlockRegistryService['remove'] = (id) => repository.remove(id)

  return BlockRegistryService.of({
    registerStandard,
    registerLiquid,
    registerInteractive,
    register,
    get,
    list,
    filterByTag,
    remove,
  })
})

const BlockRegistryCore = Layer.effect(BlockRegistryService, makeService)

export const BlockRegistryLayer = BlockRegistryCore.pipe(
  Layer.provide(BlockFactoryLive),
  Layer.provide(BlockRepositoryLayer)
)
