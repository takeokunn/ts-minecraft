import { Effect, Layer, Context } from 'effect'
import { CHUNK_SIZE } from '@shared/constants/world'
import { PlayerMovementCommand } from '@application/commands/player-movement'
import { PhysicsDomainService } from '@domain/services/physics.domain-service'
import { WorldDomainService } from '@domain/services/world.domain-service'
import { EntityDomainService } from '@domain/services/entity.domain-service'
import { 
  ValidationError,
  EntityNotFoundError,
  InvalidPositionError,
  ChunkNotLoadedError,
  PhysicsSimulationError,
  CollisionDetectionError
} from '@domain/errors'

/**
 * Player Move Use Case Service interface
 */
export interface PlayerMoveUseCaseService {
  readonly execute: (command: PlayerMovementCommand) => Effect.Effect<void, ValidationError | EntityNotFoundError | InvalidPositionError | ChunkNotLoadedError | PhysicsSimulationError | CollisionDetectionError>
}

/**
 * Player Move Use Case Service
 */
export const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCaseService>('PlayerMoveUseCase')

export const PlayerMoveUseCaseLive = Layer.succeed(PlayerMoveUseCase, {
  execute: (command) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsDomainService
      const worldService = yield* WorldDomainService
      const entityService = yield* EntityDomainService

      // Validate movement
      const isValidMove = yield* physicsService.validateMovement(
        command.entityId,
        command.position,
        command.velocity
      )

      if (!isValidMove) {
        return yield* Effect.fail(new InvalidPositionError({ 
          message: 'Invalid movement', 
          position: command.position 
        }))
      }

      // Update entity position and velocity
      yield* entityService.updatePosition(command.entityId, command.position)
      yield* physicsService.updateEntityVelocity(command.entityId, command.velocity)

      // Ensure chunk is loaded for the new position
      const chunkCoord = {
        x: Math.floor(command.position.x / CHUNK_SIZE),
        z: Math.floor(command.position.z / CHUNK_SIZE),
      }
      yield* worldService.ensureChunkLoaded(chunkCoord)

      // Apply movement effects
      yield* applyMovementEffects(command)
    }),
} satisfies PlayerMoveUseCaseService)

const applyMovementEffects = (command: PlayerMovementCommand) =>
  Effect.gen(function* () {
    yield* Effect.log(`Movement effects applied for entity ${command.entityId}`)
  })

// Layer dependencies will be provided by the main Application layer
