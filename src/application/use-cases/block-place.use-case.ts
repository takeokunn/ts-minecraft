import { Effect, Layer } from "effect"
import { BlockInteractionCommand } from "../commands/block-interaction"
import { WorldService } from "../../domain/services/world.service"
import { EntityService } from "../../domain/services/entity.service"
import { RaycastService } from "../../domain/services/raycast.service"

export interface BlockPlaceUseCase {
  readonly execute: (command: BlockInteractionCommand) => Effect.Effect<void, Error>
}

export const BlockPlaceUseCase = Layer.succeed(
  "BlockPlaceUseCase",
  BlockPlaceUseCase.of({
    execute: (command) =>
      Effect.gen(function* (_) {
        const worldService = yield* _(WorldService)
        const entityService = yield* _(EntityService)
        const raycastService = yield* _(RaycastService)

        // Validate player can place block
        const canPlace = yield* _(
          validateBlockPlacement(command, worldService, entityService)
        )

        if (!canPlace) {
          return yield* _(Effect.fail(new Error("Cannot place block at this location")))
        }

        // Get target position using raycast
        const targetPosition = yield* _(
          raycastService.getTargetPosition(command.entityId, command.direction)
        )

        // Place the block
        yield* _(
          worldService.placeBlock(
            targetPosition,
            command.blockType,
            command.metadata
          )
        )

        // Update player inventory
        yield* _(
          entityService.updateInventory(command.entityId, {
            remove: { blockType: command.blockType, count: 1 }
          })
        )

        // Apply placement effects
        yield* _(applyPlacementEffects(command, targetPosition))

        // Trigger chunk updates if necessary
        yield* _(worldService.markChunkForUpdate(targetPosition))
      })
  })
)

const validateBlockPlacement = (
  command: BlockInteractionCommand,
  worldService: WorldService,
  entityService: EntityService
) =>
  Effect.gen(function* (_) {
    // Check if player has the block in inventory
    const hasBlock = yield* _(
      entityService.hasItemInInventory(command.entityId, command.blockType)
    )

    if (!hasBlock) {
      return false
    }

    // Check if target location is valid
    const isValidLocation = yield* _(
      worldService.isValidPlacementLocation(command.position)
    )

    return isValidLocation
  })

const applyPlacementEffects = (
  command: BlockInteractionCommand,
  position: { x: number; y: number; z: number }
) =>
  Effect.gen(function* (_) {
    // Apply visual and audio effects for block placement
    yield* _(Effect.log(`Block placed at ${position.x}, ${position.y}, ${position.z}`))
  })

export const BlockPlaceUseCaseLive = Layer.provide(
  BlockPlaceUseCase,
  Layer.mergeAll(WorldService, EntityService, RaycastService)
)