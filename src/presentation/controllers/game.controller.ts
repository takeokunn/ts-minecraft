import { Effect, Context, Layer, Random, Clock } from 'effect'
import { CommandHandlers } from '@application/handlers/command.handler'
import { QueryHandlers } from '@application/handlers/query.handler'
import type { PlayerMovementCommand } from '@application/commands/player-movement'
import type { BlockInteractionCommand } from '@application/commands/block-interaction'
import type { WorldGenerateCommand } from '@application/use-cases/world-generate.usecase'

/**
 * Game Controller
 * メインゲーム機能の制御を担当する薄いコントローラー層
 * ビジネスロジックは含まず、適切なアプリケーション層への委譲のみを行う
 */
export interface GameControllerInterface {
  readonly initializeWorld: (seed?: string) => Effect.Effect<void, Error, Random.Random | Clock.Clock>
  readonly pauseGame: () => Effect.Effect<void, never, never>
  readonly resumeGame: () => Effect.Effect<void, never, never>
  readonly handlePlayerMovement: (command: PlayerMovementCommand) => Effect.Effect<void, Error, never>
  readonly handleBlockInteraction: (command: BlockInteractionCommand) => Effect.Effect<void, Error, never>
  readonly getGameState: () => Effect.Effect<GameControllerState, Error, never>
}

export interface GameControllerState {
  readonly isRunning: boolean
  readonly isPaused: boolean
  readonly playerCount: number
  readonly loadedChunks: number
}

// Create context tag for dependency injection
export const GameController = Context.GenericTag<GameControllerInterface>('GameController')

export const GameControllerLive: Layer.Layer<GameController, never, CommandHandlers | QueryHandlers> = Layer.effect(
  GameController,
  Effect.gen(function* () {
    const commandHandlers = yield* CommandHandlers
    const queryHandlers = yield* QueryHandlers

    const initializeWorld = (seed?: string): Effect.Effect<void, Error, Random.Random | Clock.Clock> =>
      Effect.gen(function* () {
        const generatedSeed = seed
          ? Effect.succeed(seed)
          : Effect.map(Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER), (n) => n.toString(36))
        
        const seedValue = yield* generatedSeed
        const currentTime = yield* Clock.currentTimeMillis
        
        const worldGenerateCommand: WorldGenerateCommand = {
          seed: seedValue,
          worldType: 'default',
          generateStructures: true,
          timestamp: currentTime,
        }

        yield* commandHandlers.handleWorldGenerate(worldGenerateCommand)
        yield* Effect.log(`World initialized with seed: ${worldGenerateCommand.seed}`)
      })

    const pauseGame = (): Effect.Effect<void, never, never> => Effect.log('Game paused')

    const resumeGame = (): Effect.Effect<void, never, never> => Effect.log('Game resumed')

    const handlePlayerMovement = (command: PlayerMovementCommand): Effect.Effect<void, Error, never> =>
      Effect.gen(function* () {
        yield* commandHandlers.handlePlayerMovement(command)
        yield* Effect.log(`Player movement handled for entity ${command.entityId}`)
      })

    const handleBlockInteraction = (command: BlockInteractionCommand): Effect.Effect<void, Error, never> =>
      Effect.gen(function* () {
        yield* commandHandlers.handleBlockInteraction(command)
        yield* Effect.log(`Block interaction handled: ${command.action}`)
      })

    const getGameState = (): Effect.Effect<GameControllerState, Error, never> =>
      Effect.gen(function* () {
        const worldState = yield* queryHandlers.getWorldState({
          includeEntities: false,
          includeChunks: false,
          includePhysics: false,
        })

        const loadedChunks = yield* queryHandlers.getLoadedChunks()

        return {
          isRunning: true, // This should come from game state management
          isPaused: false, // This should come from game state management
          playerCount: worldState.entities?.length || 0,
          loadedChunks: loadedChunks.length,
        }
      })

    return {
      initializeWorld,
      pauseGame,
      resumeGame,
      handlePlayerMovement,
      handleBlockInteraction,
      getGameState,
    } satisfies GameControllerInterface
  }),
)

// Factory function for direct usage
export const createGameController = (commandHandlers: CommandHandlers, queryHandlers: QueryHandlers) =>
  Effect.runSync(Effect.provide(GameControllerLive, Layer.mergeAll(Layer.succeed(CommandHandlers, commandHandlers), Layer.succeed(QueryHandlers, queryHandlers))))
