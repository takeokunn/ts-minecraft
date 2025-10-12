import { Effect, ManagedRuntime } from 'effect'
import { initApp } from './app'
import { AppService, MainPresentationLayer } from './bootstrap'

const program = Effect.gen(function* () {
  const app = yield* AppService
  const initResult = yield* app.initialize
  yield* Effect.logInfo('App initialized').pipe(Effect.annotateLogs({ result: JSON.stringify(initResult) }))
  const status = yield* app.readiness
  yield* Effect.logInfo('App readiness status').pipe(Effect.annotateLogs({ status: JSON.stringify(status) }))
  return status
})

const runtime = ManagedRuntime.make(MainPresentationLayer)

initApp(runtime)

const main = Effect.gen(function* () {
  const status = yield* program
  yield* Effect.logInfo('Application ready').pipe(Effect.annotateLogs({ status: JSON.stringify(status) }))
  return status
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logError('Application failed').pipe(Effect.annotateLogs({ error: String(error) }))
      return yield* Effect.fail(error)
    })
  )
)

runtime.runFork(main)
