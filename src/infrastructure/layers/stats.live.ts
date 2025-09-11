import { Layer, Effect, Ref } from 'effect'
import { Stats } from '@/infrastructure/services/stats.service'

/**
 * Production implementation of Stats service
 * Provides performance monitoring and FPS tracking
 */
export const StatsLive = Layer.effect(
  Stats,
  Effect.gen(function* () {
    const frameCount = yield* Ref.make(0)
    const frameStartTime = yield* Ref.make(Date.now())
    const lastFPS = yield* Ref.make(60)
    const lastFrameTime = yield* Ref.make(Date.now())
    const frameTimes = yield* Ref.make<number[]>([])
    
    return Stats.of({
      begin: () =>
        Ref.set(frameStartTime, Date.now()),
      
      end: () =>
        Effect.gen(function* () {
          const startTime = yield* Ref.get(frameStartTime)
          const frameTime = Date.now() - startTime
          
          // Update frame count
          const count = yield* Ref.modify(frameCount, n => [n + 1, n + 1])
          
          // Update frame times for averaging
          yield* Ref.modify(frameTimes, times => {
            const newTimes = [...times, frameTime].slice(-60) // Keep last 60 frames
            return [newTimes, newTimes]
          })
          
          // Calculate FPS every second
          const last = yield* Ref.get(lastFrameTime)
          const now = Date.now()
          
          if (now - last >= 1000) {
            const fps = Math.round((count * 1000) / (now - last))
            yield* Ref.set(lastFPS, fps)
            yield* Ref.set(frameCount, 0)
            yield* Ref.set(lastFrameTime, now)
          }
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const fps = yield* Ref.get(lastFPS)
          const times = yield* Ref.get(frameTimes)
          
          const avgFrameTime = times.length > 0
            ? times.reduce((a, b) => a + b, 0) / times.length
            : 16.67
          
          // Estimate memory usage (would need actual implementation in browser)
          const memory = typeof performance !== 'undefined' && 
                        'memory' in performance
            ? (performance as { memory: MemoryInfo }).memory.usedJSHeapSize / 1048576
            : 100
          
          return {
            fps,
            ms: avgFrameTime,
            memory
          }
        })
    })
  })
)