import { Effect, ManagedRuntime } from "effect"
import { AppService } from "./core/services/AppService"
import { MainLayer } from "./core/layers/MainLayer"

const program = Effect.gen(function* () {
  const app = yield* AppService
  yield* app.initialize()
  const status = yield* app.getStatus()
  console.log("App initialized:", status)
  return status
})

const runtime = ManagedRuntime.make(MainLayer)

runtime.runPromise(program).then(
  (status) => console.log("Application ready:", status),
  (error) => console.error("Application failed:", error)
)