import { Schema } from '@effect/schema'
import { Either, HashMap, Match, Option, pipe } from 'effect'
import { materialByBlockId } from './catalog'
import {
  BlockId,
  FortuneLevel,
  HarvestLevel,
  ItemId,
  Material,
  MaterialError,
  ToolMaterial,
  parseHarvestLevel,
} from './types'

const decodeFortuneLevel = Schema.decodeUnknownEither(FortuneLevel)

export const getToolHarvestLevel = (toolMaterial: ToolMaterial): HarvestLevel =>
  pipe(
    Match.value(toolMaterial),
    Match.when('wood', () => 0),
    Match.when('gold', () => 0),
    Match.when('stone', () => 1),
    Match.when('iron', () => 2),
    Match.when('diamond', () => 3),
    Match.when('netherite', () => 4),
    Match.orElse(() => 0),
    parseHarvestLevel
  )

export const ensureMaterial = (blockId: BlockId): Either.Either<MaterialError, Material> =>
  pipe(
    HashMap.get(materialByBlockId, blockId),
    Option.match({
      onNone: () => Either.left(MaterialError.MaterialNotFound({ blockId })),
      onSome: (material) => Either.right(material),
    })
  )

export const blockIdToItemId = (blockId: BlockId): Either.Either<MaterialError, ItemId> =>
  pipe(
    ensureMaterial(blockId),
    Either.map((material) => material.defaultItemId)
  )

export const ensureFortuneLevel = (level: number): Either.Either<MaterialError, FortuneLevel> =>
  pipe(
    decodeFortuneLevel(level),
    Either.mapLeft(() => MaterialError.InvalidFortuneLevel({ level }))
  )
