import { Effect, Layer, Context } from "effect"
import { PlayerMovementCommand } from "../commands/player-movement"
import { BlockInteractionCommand } from "../commands/block-interaction"
import { PlayerMoveUseCase } from "../use-cases/player-move.use-case"
import { BlockPlaceUseCase } from "../use-cases/block-place.use-case"
import { ChunkLoadUseCase, ChunkLoadCommand } from "../use-cases/chunk-load.use-case"
import { WorldGenerateUseCase, WorldGenerateCommand } from "../use-cases/world-generate.use-case"

export class CommandHandlers extends Context.Tag("CommandHandlers")<
  CommandHandlers,
  {
    readonly handlePlayerMovement: (command: PlayerMovementCommand) => Effect.Effect<void, Error>
    readonly handleBlockInteraction: (command: BlockInteractionCommand) => Effect.Effect<void, Error>
    readonly handleChunkLoad: (command: ChunkLoadCommand) => Effect.Effect<void, Error>
    readonly handleWorldGenerate: (command: WorldGenerateCommand) => Effect.Effect<void, Error>
  }
>() {}

export const CommandHandlersLive = Layer.succeed(
  CommandHandlers,
  {
    handlePlayerMovement: (command) =>
      Effect.gen(function* (_) {
        const playerMoveUseCase = yield* _(PlayerMoveUseCase)
        
        // Validate command
        yield* _(validatePlayerMovementCommand(command))
        
        // Execute use case
        yield* _(playerMoveUseCase.execute(command))
        
        // Log command execution
        yield* _(Effect.log(`Player movement command executed for entity ${command.entityId}`))
      }),

    handleBlockInteraction: (command) =>
      Effect.gen(function* (_) {
        const blockPlaceUseCase = yield* _(BlockPlaceUseCase)
        
        // Validate command
        yield* _(validateBlockInteractionCommand(command))
        
        // Execute use case
        yield* _(blockPlaceUseCase.execute(command))
        
        // Log command execution
        yield* _(Effect.log(`Block interaction command executed: ${command.action} at ${command.position.x}, ${command.position.y}, ${command.position.z}`))
      }),

    handleChunkLoad: (command) =>
      Effect.gen(function* (_) {
        const chunkLoadUseCase = yield* _(ChunkLoadUseCase)
        
        // Validate command
        yield* _(validateChunkLoadCommand(command))
        
        // Execute use case
        yield* _(chunkLoadUseCase.execute(command))
        
        // Log command execution
        yield* _(Effect.log(`Chunk load command executed for chunk ${command.chunkX}, ${command.chunkZ}`))
      }),

    handleWorldGenerate: (command) =>
      Effect.gen(function* (_) {
        const worldGenerateUseCase = yield* _(WorldGenerateUseCase)
        
        // Validate command
        yield* _(validateWorldGenerateCommand(command))
        
        // Execute use case
        yield* _(worldGenerateUseCase.execute(command))
        
        // Log command execution
        yield* _(Effect.log(`World generate command executed with seed ${command.seed}`))
      })
  }
)

const validatePlayerMovementCommand = (command: PlayerMovementCommand) =>
  Effect.gen(function* (_) {
    if (!command.entityId) {
      return yield* _(Effect.fail(new Error("Entity ID is required")))
    }
    
    if (!command.position || typeof command.position.x !== 'number' || 
        typeof command.position.y !== 'number' || typeof command.position.z !== 'number') {
      return yield* _(Effect.fail(new Error("Valid position is required")))
    }
    
    if (!command.velocity || typeof command.velocity.dx !== 'number' || 
        typeof command.velocity.dy !== 'number' || typeof command.velocity.dz !== 'number') {
      return yield* _(Effect.fail(new Error("Valid velocity is required")))
    }
  })

const validateBlockInteractionCommand = (command: BlockInteractionCommand) =>
  Effect.gen(function* (_) {
    if (!command.entityId) {
      return yield* _(Effect.fail(new Error("Entity ID is required")))
    }
    
    if (!command.position || typeof command.position.x !== 'number' || 
        typeof command.position.y !== 'number' || typeof command.position.z !== 'number') {
      return yield* _(Effect.fail(new Error("Valid position is required")))
    }
    
    if (!['place', 'destroy'].includes(command.action)) {
      return yield* _(Effect.fail(new Error("Action must be 'place' or 'destroy'")))
    }
    
    if (command.action === 'place' && !command.blockType) {
      return yield* _(Effect.fail(new Error("Block type is required for place action")))
    }
  })

const validateChunkLoadCommand = (command: ChunkLoadCommand) =>
  Effect.gen(function* (_) {
    if (typeof command.chunkX !== 'number' || typeof command.chunkZ !== 'number') {
      return yield* _(Effect.fail(new Error("Valid chunk coordinates are required")))
    }
    
    if (!['high', 'medium', 'low'].includes(command.priority)) {
      return yield* _(Effect.fail(new Error("Priority must be 'high', 'medium', or 'low'")))
    }
  })

const validateWorldGenerateCommand = (command: WorldGenerateCommand) =>
  Effect.gen(function* (_) {
    if (typeof command.seed !== 'number') {
      return yield* _(Effect.fail(new Error("Valid seed is required")))
    }
    
    if (!['flat', 'normal', 'amplified', 'debug'].includes(command.worldType)) {
      return yield* _(Effect.fail(new Error("World type must be 'flat', 'normal', 'amplified', or 'debug'")))
    }
    
    if (typeof command.generateStructures !== 'boolean') {
      return yield* _(Effect.fail(new Error("Generate structures must be a boolean")))
    }
  })

// Layer dependencies will be provided by the main Application layer