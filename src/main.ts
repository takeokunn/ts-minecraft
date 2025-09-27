import { Effect, ManagedRuntime } from 'effect'
import { MainLayer } from './bootstrap/layers/MainLayer'
import { AppService } from './bootstrap/services/AppService'

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
