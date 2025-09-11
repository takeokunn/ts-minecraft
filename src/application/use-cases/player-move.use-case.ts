import { Effect, Layer } from "effect"
import { PlayerMovementCommand } from "../commands/player-movement"
import { PhysicsService } from "../../domain/services/physics.service"
import { WorldService } from "../../domain/services/world.service"
import { EntityService } from "../../domain/services/entity.service"

export interface PlayerMoveUseCase {
  readonly execute: (command: PlayerMovementCommand) => Effect.Effect<void, Error>
}

export const PlayerMoveUseCase = Layer.succeed(
  "PlayerMoveUseCase",
  PlayerMoveUseCase.of({
    execute: (command) =>
      Effect.gen(function* (_) {
        const physicsService = yield* _(PhysicsService)
        const worldService = yield* _(WorldService)
        const entityService = yield* _(EntityService)

        // Validate movement
        const isValidMove = yield* _(
          physicsService.validateMovement(
            command.entityId,
            command.position,
            command.velocity
          )
        )

        if (!isValidMove) {
          return yield* _(Effect.fail(new Error("Invalid movement")))
        }

        // Update entity position
        yield* _(entityService.updatePosition(command.entityId, command.position))

        // Update physics world
        yield* _(
          physicsService.updateEntityVelocity(command.entityId, command.velocity)
        )

        // Check for chunk loading requirements
        yield* _(worldService.checkChunkRequirements(command.position))

        // Apply movement effects (sounds, particles, etc.)
        yield* _(applyMovementEffects(command))
      })
  })
)

const applyMovementEffects = (command: PlayerMovementCommand) =>
  Effect.gen(function* (_) {
    // Apply visual and audio effects for movement
    // This could include footstep sounds, particle effects, etc.
    yield* _(Effect.log(`Movement effects applied for entity ${command.entityId}`))
  })

export const PlayerMoveUseCaseLive = Layer.provide(
  PlayerMoveUseCase,
  Layer.mergeAll(PhysicsService, WorldService, EntityService)
)