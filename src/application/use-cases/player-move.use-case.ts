import { Effect, Layer, Context } from "effect"
import { PlayerMovementCommand } from "../commands/player-movement"
import { PhysicsDomainService } from "../../domain/services/physics-domain.service"
import { WorldDomainService } from "../../domain/services/world-domain.service"
import { EntityDomainService } from "../../domain/services/entity-domain.service"

export class PlayerMoveUseCase extends Context.Tag("PlayerMoveUseCase")<
  PlayerMoveUseCase,
  {
    readonly execute: (command: PlayerMovementCommand) => Effect.Effect<void, Error>
  }
>() {}

export const PlayerMoveUseCaseLive = Layer.succeed(
  PlayerMoveUseCase,
  {
    execute: (command) =>
      Effect.gen(function* (_) {
        const physicsService = yield* _(PhysicsDomainService)
        const worldService = yield* _(WorldDomainService)
        const entityService = yield* _(EntityDomainService)

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
        const chunkCoord = { 
          x: Math.floor(command.position.x / 16), 
          z: Math.floor(command.position.z / 16) 
        }
        yield* _(worldService.ensureChunkLoaded(chunkCoord))

        // Apply movement effects (sounds, particles, etc.)
        yield* _(applyMovementEffects(command))
      })
  }
)

const applyMovementEffects = (command: PlayerMovementCommand) =>
  Effect.gen(function* (_) {
    // Apply visual and audio effects for movement
    // This could include footstep sounds, particle effects, etc.
    yield* _(Effect.log(`Movement effects applied for entity ${command.entityId}`))
  })

// Layer dependencies will be provided by the main Application layer