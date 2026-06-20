import { Effect } from 'effect'
import { type InventoryItem, type Position, type SlotIndex } from '@ts-minecraft/core'
import { BlockServiceError } from './block-service-error'
import { commitPlacedBlocks } from './block-service-place-commit'
import { type PlaceBlockDeps, validateBlockType } from './block-service-place-helpers'
import { loadPlaceBlockTarget, ensurePlacementTargetIsAir } from './block-service-place-load'
import type { PlaceBlockPlan, PlaceBlockRequest } from './block-service-place-model'
import { buildPlacedBlocks } from './block-service-place-plan'
import { ensurePlacementDoesNotOverlapPlayer } from './block-service-place-player'

export const makePlaceBlock =
  (deps: PlaceBlockDeps) =>
  (
    position: Position,
    itemType: InventoryItem,
    preferredInventorySlot?: SlotIndex,
  ): Effect.Effect<void, BlockServiceError> =>
    Effect.gen(function* () {
      const request: PlaceBlockRequest =
        preferredInventorySlot === undefined
          ? {
              operation: 'placeBlock',
              position,
              itemType,
            }
          : {
              operation: 'placeBlock',
              position,
              itemType,
              preferredInventorySlot,
            }
      const target = yield* loadPlaceBlockTarget(deps, request)
      yield* ensurePlacementTargetIsAir(deps, target)

      const blockType = yield* validateBlockType(itemType, request.operation)
      const placedBlocks = yield* buildPlacedBlocks(
        deps.chunkService,
        target.chunk,
        blockType,
        position,
        target.lx,
        target.y,
        target.lz,
        request.operation,
      )
      const plan: PlaceBlockPlan = { target, blockType, placedBlocks }

      yield* ensurePlacementDoesNotOverlapPlayer(deps.playerService, plan)
      yield* commitPlacedBlocks(deps, request, plan)
    })
