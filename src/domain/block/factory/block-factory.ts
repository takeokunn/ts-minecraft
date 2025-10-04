import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { BlockDefinition } from '../types/block-definition'
import {
  BlockDefinitionError,
  makeBlockDefinition,
  makeInteractiveBlock,
  makeLiquidBlock,
  makeStandardBlock,
} from '../types/block-definition'

export interface BlockFactory {
  readonly standard: typeof makeStandardBlock
  readonly liquid: typeof makeLiquidBlock
  readonly interactive: typeof makeInteractiveBlock
  readonly fromKind: (
    input:
      | ({ readonly kind: 'standard' } & Parameters<typeof makeStandardBlock>[0])
      | ({ readonly kind: 'liquid' } & Parameters<typeof makeLiquidBlock>[0])
      | ({ readonly kind: 'interactive' } & Parameters<typeof makeInteractiveBlock>[0])
  ) => Effect.Effect<BlockDefinition, BlockDefinitionError>
}

export const BlockFactory = Context.GenericTag<BlockFactory>('BlockFactory')

export const BlockFactoryLive = Layer.succeed(BlockFactory, {
  standard: makeStandardBlock,
  liquid: makeLiquidBlock,
  interactive: makeInteractiveBlock,
  fromKind: makeBlockDefinition,
})
