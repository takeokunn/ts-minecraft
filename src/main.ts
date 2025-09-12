import { Effect, pipe, Option, Schema } from 'effect'
import { Archetype, createArchetype } from '@domain'
import { World } from '@infrastructure/layers/unified.layer'
import { getAppLayer } from '@/layers'
import { blockInteractionSystem } from '@application/commands/block-interaction'
import { playerMovementSystem } from '@application/commands/player-movement'
import { chunkLoadingWorkflow } from '@application/workflows/chunk-loading'
import type { AppConfig } from '@config/app-config'
import type { SystemFunction } from '@application/workflows/system-scheduler'
// import { worldUpdateSystem } from '@application/workflows/world-update'

// ===== TAGGED ERROR DEFINITIONS =====

/**
 * Application initialization error
 */
export class AppInitError extends Schema.TaggedError<AppInitError>()('AppInitError', {
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
  stage: Schema.optional(Schema.String), // initialization stage that failed
}) {}

/**
 * Game loop execution error
 */
export class GameLoopError extends Schema.TaggedError<GameLoopError>()('GameLoopError', {
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
  systemName: Schema.optional(Schema.String), // system that caused the error
  iteration: Schema.optional(Schema.Number), // loop iteration count
}) {}

/**
 * Union type for all main.ts errors
 */
export type MainError = AppInitError | GameLoopError

/**
 * Game system function signature with proper error types
 */
type GameSystemFunction = () => Effect.Effect<void, MainError, never>

/**
 * Array of game systems for execution
 */
export const gameSystems: ReadonlyArray<GameSystemFunction> = [
  playerMovementSystem,
  blockInteractionSystem,
  chunkLoadingWorkflow,
] as const

/**
 * Game loop execution with TaggedError handling and logging
 */
const gameLoop = (systems: ReadonlyArray<GameSystemFunction>): Effect.Effect<void, GameLoopError, never> =>
  pipe(
    Effect.log(`Starting game loop with ${systems.length} systems`),
    Effect.flatMap(() =>
      Effect.forEach(
        systems,
        (system, index) =>
          pipe(
            system(),
            Effect.tapBoth({
              onSuccess: () => Effect.log(`System ${index + 1} executed successfully`),
              onFailure: (error) => Effect.log(`System ${index + 1} execution failed - ${JSON.stringify(error)}`),
            }),
            Effect.catchAll((error) =>
              new GameLoopError({
                message: `System execution failed at index ${index}`,
                timestamp: Date.now(),
                cause: error,
                systemName: `system_${index}`,
                iteration: index,
              })
            ),
          ),
        { concurrency: 'unbounded' },
      ),
    ),
  )

/**
 * Main application entry point with TaggedError handling
 * @param player - Player archetype configuration
 */
export const main = (player: Archetype): Effect.Effect<void, AppInitError | GameLoopError, World> =>
  pipe(
    World,
    Effect.tap(() => Effect.log(`Application starting with player: ${JSON.stringify(player)}`)),
    Effect.flatMap((world) =>
      pipe(
        world.initialize(),
        Effect.catchAll((error) =>
          new AppInitError({
            message: 'World initialization failed',
            timestamp: Date.now(),
            cause: error,
            stage: 'world_initialization',
          })
        ),
        Effect.flatMap(() => gameLoop(gameSystems)),
      ),
    ),
  )

/**
 * Initialize the application with TaggedError handling
 */
const initialize: Effect.Effect<void, AppInitError | GameLoopError, World> = pipe(
  Effect.log('Initializing TypeScript Minecraft...'),
  Effect.flatMap(() =>
    pipe(
      createArchetype({
        type: 'player',
        pos: { x: 0, y: 80, z: 0 },
      }),
      Effect.catchAll((error) =>
        new AppInitError({
          message: 'Player archetype creation failed',
          timestamp: Date.now(),
          cause: error,
          stage: 'player_creation',
        })
      ),
      Effect.tap((player) => Effect.log(`Player created: ${JSON.stringify(player)}`)),
      Effect.flatMap(main),
    ),
  ),
)

/**
 * Environment configuration
 */
type Environment = 'development' | 'production' | 'test'

/**
 * Current application environment
 */
const environment: Environment = (import.meta.env.MODE as Environment) || 'development'

/**
 * Application configuration for the current environment
 */
const appConfig: AppConfig = (() => {
  // This would ideally be imported from a config service
  // For now, we use a minimal config structure
  return {
    environment,
    debug: environment === 'development',
    version: '1.0.0',
    logging: {
      level: environment === 'production' ? 'warn' : 'debug',
      enableConsole: true,
      enableRemote: false,
    },
    features: {
      enableMultiplayer: false,
      enableWebGPU: true,
      enableWasm: true,
      enableServiceWorker: environment === 'production',
      enableHotReload: environment === 'development',
    },
    storage: {
      enableLocalStorage: true,
      enableIndexedDB: true,
      maxCacheSize: environment === 'production' ? 200 : 500,
    },
    security: {
      enableCSP: environment === 'production',
      allowedOrigins: environment === 'production' ? ['https://your-domain.com'] : ['*'],
    },
  } as const satisfies AppConfig
})()

/**
 * Application with all dependencies provided and comprehensive error handling
 */
const AppLive: Effect.Effect<void, never, never> = initialize.pipe(
  Effect.provide(getAppLayer(environment)),
  Effect.catchAll((error) =>
    pipe(
      Effect.logError(`Application error: ${JSON.stringify(error)}`),
      Effect.flatMap(() => {
        // Log specific error types for better debugging
        if (error._tag === 'AppInitError') {
          return Effect.logError(`Initialization failed at stage: ${error.stage || 'unknown'}`)
        }
        if (error._tag === 'GameLoopError') {
          return Effect.logError(`Game loop failed at system: ${error.systemName || 'unknown'}, iteration: ${error.iteration || 'unknown'}`)
        }
        return Effect.logError('Unknown error type')
      }),
      Effect.as(undefined),
    ),
  ),
)

/**
 * Application startup sequence with comprehensive logging
 */
const appStartup: Effect.Effect<void, never, never> = pipe(
  Effect.log('TypeScript Minecraft - Phase 3 Integration'),
  Effect.flatMap(() => Effect.log(`Environment: ${environment}`)),
  Effect.flatMap(() => AppLive)
)

/* v8 ignore next 3 */
if (import.meta.env.PROD) {
  Effect.runFork(appStartup)
} else {
  // Development mode - run with error handling
  Effect.runPromise(appStartup).then(
    () => Effect.runSync(Effect.log('Application completed successfully')),
    (error) => Effect.runSync(Effect.logError('Application failed:', error)),
  )
}
