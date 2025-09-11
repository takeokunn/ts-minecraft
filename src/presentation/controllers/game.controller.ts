import { Effect, Context, Layer } from 'effect'
import { CommandHandlers } from '@/application/handlers/command-handlers'
import { QueryHandlers } from '@/application/handlers/query-handlers'
import type { PlayerMovementCommand } from '@/application/commands/player-movement'
import type { BlockInteractionCommand } from '@/application/commands/block-interaction'
import type { WorldGenerateCommand } from '@/application/use-cases/world-generate.use-case'

/**
 * Game Controller
 * メインゲーム機能の制御を担当する薄いコントローラー層
 * ビジネスロジックは含まず、適切なアプリケーション層への委譲のみを行う
 */
export interface GameControllerInterface {
  readonly initializeWorld: (seed?: string) => Effect.Effect<void, Error, never>
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

export class GameController extends Context.Tag('GameController')<GameController, GameControllerInterface>() {}

export const GameControllerLive: Layer.Layer<GameController, never, CommandHandlers | QueryHandlers> = Layer.effect(
  GameController,
  Effect.gen(function* () {
    const commandHandlers = yield* CommandHandlers
    const queryHandlers = yield* QueryHandlers

    const initializeWorld = (seed?: string): Effect.Effect<void, Error, never> =>
      Effect.gen(function* () {
        const worldGenerateCommand: WorldGenerateCommand = {
          seed: seed || Math.random().toString(36).substring(7),
          worldType: 'default',
          generateStructures: true,
          timestamp: Date.now(),
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
