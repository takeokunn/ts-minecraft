import { Effect, pipe, Option } from 'effect'
import { Archetype, createArchetype } from '@domain'
import { World } from '@infrastructure/layers/unified.layer'
import { getAppLayer } from '@/layers'
import { blockInteractionSystem } from '@application/commands/block-interaction'
import { playerMovementSystem } from '@application/commands/player-movement'
import { chunkLoadingWorkflow } from '@application/workflows/chunk-loading'
// import { worldUpdateSystem } from '@application/workflows/world-update'

// Simplified game systems for initial integration
// Note: worldUpdateSystem not yet implemented, temporarily removed
export const gameSystems = [playerMovementSystem, blockInteractionSystem, chunkLoadingWorkflow]

// Simplified game loop for testing using pipe pattern
const gameLoop = (systems: Array<(context?: unknown) => Effect.Effect<void>>) =>
  pipe(
    Effect.log(`Starting game loop with ${systems.length} systems`),
    Effect.flatMap(() =>
      Effect.forEach(
        systems,
        (system) =>
          pipe(
            Effect.tryPromise(() => Effect.runPromise(system())),
            Effect.tapBoth({
              onSuccess: () => Effect.log(`System executed successfully: ${system.name}`),
              onFailure: (error) => Effect.log(`System execution failed: ${system.name} - ${error}`),
            }),
            Effect.orElse(() => Effect.succeed(undefined)),
          ),
        { concurrency: 'unbounded' },
      ),
    ),
  )

export const main = (player: Archetype) =>
  pipe(
    World,
    Effect.tap(() => Effect.log(`Application starting with player: ${JSON.stringify(player)}`)),
    Effect.flatMap((world) =>
      pipe(
        world.initialize(),
        Effect.flatMap(() => gameLoop(gameSystems)),
      ),
    ),
  )

const initialize = pipe(
  Effect.log('Initializing TypeScript Minecraft...'),
  Effect.flatMap(() =>
    pipe(
      createArchetype({
        type: 'player',
        pos: { x: 0, y: 80, z: 0 },
      }),
      Effect.tap((player) => Effect.log(`Player created: ${JSON.stringify(player)}`)),
      Effect.flatMap(main),
    ),
  ),
)

// Get the appropriate layer for the current environment
const environment = (import.meta.env.MODE as 'development' | 'production' | 'test') || 'development'
const AppLive = initialize.pipe(Effect.provide(getAppLayer(environment)))

// Application entry point
console.log('TypeScript Minecraft - Phase 3 Integration')
console.log('Environment:', environment)

/* v8 ignore next 3 */
if (import.meta.env.PROD) {
  Effect.runFork(AppLive)
} else {
  // Development mode - run with error handling
  Effect.runPromise(AppLive).then(
    () => console.log('Application completed successfully'),
    (error) => console.error('Application failed:', error),
  )
}
