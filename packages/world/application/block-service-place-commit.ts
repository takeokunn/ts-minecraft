import { Either, Effect, Metric } from 'effect'
import { toDirtyVoxels } from '../domain/placed-block'
import { BlockServiceError } from './block-service-error'
import type { PlaceBlockDeps } from './block-service-place-helpers'
import type { PlaceBlockPlan, PlaceBlockRequest } from './block-service-place-model'
import {
  notifyPlacedBlocks,
  rollbackPlacedBlocks,
  writePlacedBlocks,
} from './block-service-place-effects'

const seedPlacedFluid = (
  deps: PlaceBlockDeps,
  plan: PlaceBlockPlan,
): Effect.Effect<void, never> => {
  switch (plan.blockType) {
    case 'WATER':
      return deps.fluidService.seedWater(plan.target.position)
    case 'LAVA':
      return deps.fluidService.seedLava(plan.target.position)
    default:
      return Effect.void
  }
}

const removePlacedBlockFromInventory = (
  deps: PlaceBlockDeps,
  request: PlaceBlockRequest,
  plan: PlaceBlockPlan,
): Effect.Effect<void, BlockServiceError> =>
  deps.inventoryService
    .removeBlock(plan.blockType, 1, request.preferredInventorySlot)
    .pipe(
      Effect.either,
      Effect.flatMap((removeResult) =>
        Either.isRight(removeResult)
          ? Effect.void
          : rollbackPlacedBlocks(
              plan.target.chunk,
              plan.placedBlocks,
              request.operation,
            ).pipe(
              Effect.flatMap(() =>
                Effect.fail(
                  new BlockServiceError({
                    operation: request.operation,
                    reason: `No ${plan.blockType} available in inventory`,
                  }),
                ),
              ),
            ),
      ),
    )

export const commitPlacedBlocks = (
  deps: PlaceBlockDeps,
  request: PlaceBlockRequest,
  plan: PlaceBlockPlan,
): Effect.Effect<void, BlockServiceError> =>
  Effect.gen(function* () {
    yield* writePlacedBlocks(
      plan.target.chunk,
      plan.placedBlocks,
      plan.blockType,
      request.operation,
    )
    yield* removePlacedBlockFromInventory(deps, request, plan)

    const dirtyVoxels = toDirtyVoxels(plan.placedBlocks)
    yield* deps.chunkManagerService.markChunkDirty(plan.target.chunkCoord, dirtyVoxels)
    yield* notifyPlacedBlocks(deps.fluidService, plan.placedBlocks)
    yield* seedPlacedFluid(deps, plan)
    yield* Metric.increment(Metric.counter('blocks_placed'))
  })
