import { Effect, ManagedRuntime } from 'effect'
import { AppService } from './core/services/AppService'
import { MainLayer } from './core/layers/MainLayer'

const program = Effect.gen(function* () {
  const app = yield* AppService
  yield* app.initialize()
  const status = yield* app.getReadyStatus()
  console.log('App initialized:', status)
  return status
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
