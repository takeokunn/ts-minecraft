import { Effect } from 'effect'
import { Archetype, createArchetype } from '@domain/archetypes'
import { World } from '@infrastructure/layers/unified.layer'
import { getAppLayer } from '@/layers'
import { blockInteractionSystem } from '@application/commands/block-interaction'
import { playerMovementSystem } from '@application/commands/player-movement'
import { chunkLoadingSystem } from '@application/workflows/chunk-loading'
import { worldUpdateSystem } from '@application/workflows/world-update'

// Simplified game systems for initial integration
export const gameSystems = [playerMovementSystem, blockInteractionSystem, chunkLoadingSystem, worldUpdateSystem]

// Simplified game loop for testing
const gameLoop = (systems: Array<(context?: any) => Effect.Effect<void>>) =>
  Effect.gen(function* () {
    console.log('Starting game loop with', systems.length, 'systems')

    // For now, just run systems once to verify they can be instantiated
    for (const system of systems) {
      try {
        yield* system()
        console.log('System executed successfully:', system.name)
      } catch (error) {
        console.warn('System execution failed:', system.name, error)
      }
    }
  })

export const main = (player: Archetype) =>
  Effect.gen(function* () {
    const world = yield* World

    console.log('Application starting with player:', player)

    // Initialize world
    yield* world.initialize()

    // Run simplified game loop
    yield* gameLoop(gameSystems)
  })

const initialize = Effect.gen(function* () {
  console.log('Initializing TypeScript Minecraft...')

  const player = yield* createArchetype({
    type: 'player',
    pos: { x: 0, y: 80, z: 0 },
  })

  console.log('Player created:', player)

  yield* main(player)
})

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
