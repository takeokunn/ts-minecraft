import { Effect, ManagedRuntime } from 'effect'
import { AppService, MainLayer } from './bootstrap'

const program = Effect.gen(function* () {
  const app = yield* AppService
  const initResult = yield* app.initialize
  const status = yield* app.readiness
  console.log('App initialized:', initResult)
  console.log('App readiness status:', status)
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
