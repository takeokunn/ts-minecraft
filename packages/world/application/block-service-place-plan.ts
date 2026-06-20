import { Effect } from 'effect'
import { getLightAt } from '@ts-minecraft/block/domain/light'
import { CHUNK_HEIGHT, type BlockType, type Position } from '@ts-minecraft/core'
import {
  hasClearCactusHorizontalSides,
  hasRequiredSugarCaneAdjacentWater,
  isMushroomPlacementLightAllowed,
  localHorizontalNeighbors,
  MAX_MUSHROOM_PLACEMENT_LIGHT,
} from '../domain/block-placement-rules'
import { canBlockStaySupported, isSupportSensitiveBlock } from '../domain/block-support'
import type { Chunk } from '../domain/chunk'
import { toPlacedBlock, type PlacedBlock } from '../domain/placed-block'
import { BlockServiceError } from './block-service-error'
import { type ChunkServiceForPlace, type PlacementContext } from './block-service-place-helpers'

type PlacementRule = (
  context: PlacementContext,
  placedBlocks: Array<PlacedBlock>,
) => Effect.Effect<Array<PlacedBlock>, BlockServiceError>

const readPlacementBlock = (
  context: PlacementContext,
  lx: number,
  y: number,
  lz: number,
  label: string,
): Effect.Effect<BlockType, BlockServiceError> =>
  context.chunkService.getBlock(context.chunk, lx, y, lz).pipe(
    Effect.mapError(
      (e) =>
        new BlockServiceError({
          operation: context.operation,
          reason: `Failed to read ${label} block at local (${lx}, ${y}, ${lz}): ${e.message}`,
          cause: e,
        }),
    ),
  )

const buildDoorPlacedBlocks = (
  context: PlacementContext,
  baseBlock: PlacedBlock,
): Effect.Effect<Array<PlacedBlock>, BlockServiceError> =>
  Effect.gen(function* () {
    const { chunkService, chunk, position, lx, y, lz, operation } = context

    if (y + 1 >= CHUNK_HEIGHT) {
      return yield* Effect.fail(
        new BlockServiceError({
          operation,
          reason: 'Door requires an empty block above the placement position',
        }),
      )
    }

    const upperExisting = yield* chunkService.getBlock(chunk, lx, y + 1, lz).pipe(
      Effect.mapError(
        (e) =>
          new BlockServiceError({
            operation,
            reason: `Failed to read upper door block at local (${lx}, ${y + 1}, ${lz}): ${e.message}`,
            cause: e,
          }),
      ),
    )
    if (upperExisting !== 'AIR') {
      return yield* Effect.fail(
        new BlockServiceError({
          operation,
          reason: 'Door requires an empty block above the placement position',
        }),
      )
    }

    return [baseBlock, toPlacedBlock(lx, y + 1, lz, { ...position, y: y + 1 })]
  })

const ensureSupportBelow = (
  context: PlacementContext,
): Effect.Effect<void, BlockServiceError> => {
  const { chunkService, chunk, lx, y, lz, blockType, operation } = context

  if (y <= 0) {
    return Effect.fail(
      new BlockServiceError({
        operation,
        reason: `${blockType} requires a supporting block below`,
      }),
    )
  }

  return chunkService.getBlock(chunk, lx, y - 1, lz).pipe(
    Effect.mapError(
      (e) =>
        new BlockServiceError({
          operation,
          reason: `Failed to read support block at local (${lx}, ${y - 1}, ${lz}): ${e.message}`,
          cause: e,
        }),
    ),
    Effect.flatMap((belowType) =>
      canBlockStaySupported(blockType, belowType)
        ? Effect.void
        : Effect.fail(
            new BlockServiceError({
              operation,
              reason: `${blockType} requires a supporting block below`,
            }),
          ),
    ),
  )
}

const applySupportPlacementRule: PlacementRule = (context, placedBlocks) => {
  if (!isSupportSensitiveBlock(context.blockType)) return Effect.succeed(placedBlocks)
  return ensureSupportBelow(context).pipe(Effect.as(placedBlocks))
}

const placementLightLevel = (context: PlacementContext): number => {
  const skyLight = context.chunk.skyLight
    ? getLightAt(context.chunk.skyLight, context.lx, context.y, context.lz)
    : 15
  const blockLight = context.chunk.blockLight
    ? getLightAt(context.chunk.blockLight, context.lx, context.y, context.lz)
    : 0
  return Math.max(skyLight, blockLight)
}

const ensureMushroomLightLevel = (
  context: PlacementContext,
): Effect.Effect<void, BlockServiceError> => {
  if (isMushroomPlacementLightAllowed(context.blockType, placementLightLevel(context))) return Effect.void

  return Effect.fail(
    new BlockServiceError({
      operation: context.operation,
      reason: `${context.blockType} requires light level ${MAX_MUSHROOM_PLACEMENT_LIGHT} or lower`,
    }),
  )
}

const ensureSugarCaneAdjacentWater = (
  context: PlacementContext,
): Effect.Effect<void, BlockServiceError> => {
  if (context.blockType !== 'SUGAR_CANE') return Effect.void
  if (context.y <= 0) return Effect.void

  return readPlacementBlock(context, context.lx, context.y - 1, context.lz, 'sugar cane support').pipe(
    Effect.flatMap((belowType) => {
      return Effect.forEach(
        localHorizontalNeighbors(context.lx, context.lz),
        (neighbor) =>
          readPlacementBlock(context, neighbor.lx, context.y - 1, neighbor.lz, 'sugar cane adjacent support-level'),
      ).pipe(
        Effect.flatMap((neighborTypes) =>
          hasRequiredSugarCaneAdjacentWater(belowType, neighborTypes)
            ? Effect.void
            : Effect.fail(
                new BlockServiceError({
                  operation: context.operation,
                  reason: 'SUGAR_CANE requires adjacent water beside its support block',
                }),
              ),
        ),
      )
    }),
  )
}

const ensureCactusHorizontalSidesAreAir = (
  context: PlacementContext,
): Effect.Effect<void, BlockServiceError> => {
  if (context.blockType !== 'CACTUS') return Effect.void

  return Effect.forEach(
    localHorizontalNeighbors(context.lx, context.lz),
    (neighbor) => readPlacementBlock(context, neighbor.lx, context.y, neighbor.lz, 'cactus side'),
  ).pipe(
    Effect.flatMap((neighborTypes) =>
      hasClearCactusHorizontalSides(neighborTypes)
        ? Effect.void
        : Effect.fail(
            new BlockServiceError({
              operation: context.operation,
              reason: 'CACTUS requires empty horizontal sides',
            }),
          ),
    ),
  )
}

const applySugarCanePlacementRule: PlacementRule = (context, placedBlocks) =>
  ensureSugarCaneAdjacentWater(context).pipe(Effect.as(placedBlocks))

const applyMushroomLightPlacementRule: PlacementRule = (context, placedBlocks) =>
  ensureMushroomLightLevel(context).pipe(Effect.as(placedBlocks))

const applyCactusPlacementRule: PlacementRule = (context, placedBlocks) =>
  ensureCactusHorizontalSidesAreAir(context).pipe(Effect.as(placedBlocks))

const applyDoorPlacementRule: PlacementRule = (context, placedBlocks) => {
  if (context.blockType !== 'DOOR') return Effect.succeed(placedBlocks)
  return buildDoorPlacedBlocks(context, placedBlocks[0]!)
}

const PLACEMENT_RULES: ReadonlyArray<PlacementRule> = [
  applySupportPlacementRule,
  applyMushroomLightPlacementRule,
  applySugarCanePlacementRule,
  applyCactusPlacementRule,
  applyDoorPlacementRule,
]

export const buildPlacedBlocks = (
  chunkService: ChunkServiceForPlace,
  chunk: Chunk,
  blockType: BlockType,
  position: Position,
  lx: number,
  y: number,
  lz: number,
  operation: string,
): Effect.Effect<Array<PlacedBlock>, BlockServiceError> =>
  Effect.gen(function* () {
    const baseBlock = toPlacedBlock(lx, y, lz, position)
    const context: PlacementContext = {
      chunkService,
      chunk,
      position,
      lx,
      y,
      lz,
      blockType,
      operation,
    }

    let placedBlocks: Array<PlacedBlock> = [baseBlock]
    for (const applyPlacementRule of PLACEMENT_RULES) {
      placedBlocks = yield* applyPlacementRule(context, placedBlocks)
    }

    return placedBlocks
  })
