import { Effect, Layer, Context } from 'effect'
import { PlayerMovementCommand } from '@application/commands/player-movement'
import { BlockInteractionCommand } from '@application/commands/block-interaction'
import { PlayerMoveUseCase } from '@application/use-cases/player-move.use-case'
import { BlockPlaceUseCase } from '@application/use-cases/block-place.use-case'
import { ChunkLoadUseCase, ChunkLoadCommand } from '@application/use-cases/chunk-load.use-case'
import { WorldGenerateUseCase, WorldGenerateCommand } from '@application/use-cases/world-generate.use-case'
import { 
  ValidationError, 
  SystemExecutionError, 
  EntityNotFoundError,
  ChunkNotLoadedError,
  WorldStateError 
} from '@domain/errors'

// Service interface with proper error types
interface CommandHandlersService {
  readonly handlePlayerMovement: (command: PlayerMovementCommand) => Effect.Effect<void, ValidationError | SystemExecutionError | EntityNotFoundError, PlayerMoveUseCase>
  readonly handleBlockInteraction: (command: BlockInteractionCommand) => Effect.Effect<void, ValidationError | SystemExecutionError | WorldStateError, BlockPlaceUseCase>
  readonly handleChunkLoad: (command: ChunkLoadCommand) => Effect.Effect<void, ValidationError | ChunkNotLoadedError | SystemExecutionError, ChunkLoadUseCase>
  readonly handleWorldGenerate: (command: WorldGenerateCommand) => Effect.Effect<void, ValidationError | WorldStateError | SystemExecutionError, WorldGenerateUseCase>
}

/**
 * Command Handlers Service
 */
export const CommandHandlers = Context.GenericTag<CommandHandlersService>('CommandHandlers')

export const CommandHandlersLive: Layer.Layer<CommandHandlers, never, PlayerMoveUseCase | BlockPlaceUseCase | ChunkLoadUseCase | WorldGenerateUseCase> = Layer.effect(
  CommandHandlers,
  Effect.gen(function* () {
    return {
      handlePlayerMovement: (command: PlayerMovementCommand): Effect.Effect<void, ValidationError | SystemExecutionError | EntityNotFoundError, PlayerMoveUseCase> =>
        Effect.gen(function* () {
          const playerMoveUseCase = yield* PlayerMoveUseCase

          // Validate command
          yield* validatePlayerMovementCommand(command)

          // Execute use case
          yield* playerMoveUseCase.execute(command)

          // Log command execution
          yield* Effect.log(`Player movement command executed for entity ${command.entityId}`)
        }),

      handleBlockInteraction: (command: BlockInteractionCommand): Effect.Effect<void, ValidationError | SystemExecutionError | WorldStateError, BlockPlaceUseCase> =>
        Effect.gen(function* () {
          const blockPlaceUseCase = yield* BlockPlaceUseCase

          // Validate command
          yield* validateBlockInteractionCommand(command)

          // Execute use case
          yield* blockPlaceUseCase.execute(command)

          // Log command execution
          yield* Effect.log(`Block interaction command executed: ${command.action} at ${command.position.x}, ${command.position.y}, ${command.position.z}`)
        }),

      handleChunkLoad: (command: ChunkLoadCommand): Effect.Effect<void, ValidationError | ChunkNotLoadedError | SystemExecutionError, ChunkLoadUseCase> =>
        Effect.gen(function* () {
          const chunkLoadUseCase = yield* ChunkLoadUseCase

          // Validate command
          yield* validateChunkLoadCommand(command)

          // Execute use case
          yield* chunkLoadUseCase.execute(command)

          // Log command execution
          yield* Effect.log(`Chunk load command executed for chunk ${command.chunkX}, ${command.chunkZ}`)
        }),

      handleWorldGenerate: (command: WorldGenerateCommand): Effect.Effect<void, ValidationError | WorldStateError | SystemExecutionError, WorldGenerateUseCase> =>
        Effect.gen(function* () {
          const worldGenerateUseCase = yield* WorldGenerateUseCase

          // Validate command
          yield* validateWorldGenerateCommand(command)

          // Execute use case
          yield* worldGenerateUseCase.execute(command)

          // Log command execution
          yield* Effect.log(`World generate command executed with seed ${command.seed}`)
        }),
    } satisfies CommandHandlersService
  }),
)

const validatePlayerMovementCommand = (command: PlayerMovementCommand): Effect.Effect<void, ValidationError, never> =>
  Effect.gen(function* () {
    if (!command.entityId) {
      return yield* Effect.fail(ValidationError({
        field: 'entityId',
        message: 'Entity ID is required'
      }))
    }

    if (!command.position || typeof command.position.x !== 'number' || typeof command.position.y !== 'number' || typeof command.position.z !== 'number') {
      return yield* Effect.fail(ValidationError({
        field: 'position',
        message: 'Valid position with x, y, z coordinates is required'
      }))
    }

    if (!command.velocity || typeof command.velocity.dx !== 'number' || typeof command.velocity.dy !== 'number' || typeof command.velocity.dz !== 'number') {
      return yield* Effect.fail(ValidationError({
        field: 'velocity',
        message: 'Valid velocity with dx, dy, dz components is required'
      }))
    }
  })

const validateBlockInteractionCommand = (command: BlockInteractionCommand): Effect.Effect<void, ValidationError, never> =>
  Effect.gen(function* () {
    if (!command.entityId) {
      return yield* Effect.fail(ValidationError({
        field: 'entityId',
        message: 'Entity ID is required'
      }))
    }

    if (!command.position || typeof command.position.x !== 'number' || typeof command.position.y !== 'number' || typeof command.position.z !== 'number') {
      return yield* Effect.fail(ValidationError({
        field: 'position',
        message: 'Valid position with x, y, z coordinates is required'
      }))
    }

    if (!['place', 'destroy'].includes(command.action)) {
      return yield* Effect.fail(ValidationError({
        field: 'action',
        message: "Action must be 'place' or 'destroy'"
      }))
    }

    if (command.action === 'place' && !command.blockType) {
      return yield* Effect.fail(ValidationError({
        field: 'blockType',
        message: 'Block type is required for place action'
      }))
    }
  })

const validateChunkLoadCommand = (command: ChunkLoadCommand): Effect.Effect<void, ValidationError, never> =>
  Effect.gen(function* () {
    if (typeof command.chunkX !== 'number' || typeof command.chunkZ !== 'number') {
      return yield* Effect.fail(ValidationError({
        field: 'chunkCoordinates',
        message: 'Valid chunk coordinates (chunkX, chunkZ) are required'
      }))
    }

    if (!['high', 'medium', 'low'].includes(command.priority)) {
      return yield* Effect.fail(ValidationError({
        field: 'priority',
        message: "Priority must be 'high', 'medium', or 'low'"
      }))
    }
  })

const validateWorldGenerateCommand = (command: WorldGenerateCommand): Effect.Effect<void, ValidationError, never> =>
  Effect.gen(function* () {
    if (typeof command.seed !== 'number') {
      return yield* Effect.fail(ValidationError({
        field: 'seed',
        message: 'Valid numeric seed is required'
      }))
    }

    if (!['flat', 'normal', 'amplified', 'debug'].includes(command.worldType)) {
      return yield* Effect.fail(ValidationError({
        field: 'worldType',
        message: "World type must be 'flat', 'normal', 'amplified', or 'debug'"
      }))
    }

    if (typeof command.generateStructures !== 'boolean') {
      return yield* Effect.fail(ValidationError({
        field: 'generateStructures',
        message: 'Generate structures must be a boolean value'
      }))
    }
  })

// Layer dependencies will be provided by the main Application layer
