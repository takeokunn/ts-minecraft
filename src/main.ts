import { Effect, ManagedRuntime } from 'effect'
import { AppService, MainLayer } from './bootstrap'
import { GameApplication } from '@application/game-application'
import { TimeServiceTag } from './shared-kernel/time'

const program = Effect.gen(function* () {
  const app = yield* AppService
  const game = yield* GameApplication
  const time = yield* TimeServiceTag

  const initResult = yield* app.initialize
  yield* game.initialize()
  yield* game.start()

  const readiness = yield* app.readiness
  const bootTimestamp = yield* time.now
  const bootDate = time.toDate(bootTimestamp)

  console.log('App initialized:', initResult)
  console.log('App readiness status:', readiness)
  console.log('Boot timestamp (ms):', Number(bootTimestamp))
  console.log('Boot time (ISO):', bootDate.toISOString())

  const health = yield* game.healthCheck()
  console.log('Game health status:', health)

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      void game.stop().pipe(Effect.catchAll((error) => Effect.sync(() => console.error('Failed to stop game:', error)))).pipe(Effect.runFork)
    })
  }

  return readiness
})

const runtime = ManagedRuntime.make(MainLayer)

const main = Effect.gen(function* () {
  const status = yield* program
  console.log('Application ready:', status)
  return status
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      console.error('Application failed:', error)
      return yield* Effect.fail(error)
    })
  )
)

runtime.runFork(main)
