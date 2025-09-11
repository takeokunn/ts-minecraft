import { Layer, Effect, Ref } from 'effect'
import { Clock } from '@/infrastructure/services/clock.service'

/**
 * Production implementation of Clock service
 * Provides frame timing and delta time calculation
 */
export const ClockLive = Layer.effect(
  Clock,
  Effect.gen(function* () {
    const startTime = yield* Ref.make(Date.now())
    const lastTime = yield* Ref.make(Date.now())
    const isRunning = yield* Ref.make(false)
    
    return Clock.of({
      getDelta: () =>
        Effect.gen(function* () {
          const running = yield* Ref.get(isRunning)
          if (!running) return 0
          
          const last = yield* Ref.get(lastTime)
          const now = Date.now()
          yield* Ref.set(lastTime, now)
          
          // Cap delta time to prevent large jumps
          const delta = Math.min((now - last) / 1000, 0.1)
          return delta
        }),
      
      getElapsedTime: () =>
        Effect.gen(function* () {
          const start = yield* Ref.get(startTime)
          return (Date.now() - start) / 1000
        }),
      
      start: () =>
        Effect.gen(function* () {
          const now = Date.now()
          yield* Ref.set(startTime, now)
          yield* Ref.set(lastTime, now)
          yield* Ref.set(isRunning, true)
        }),
      
      stop: () =>
        Ref.set(isRunning, false)
    })
  })
)