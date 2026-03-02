import { Effect, Queue, Ref, Fiber, Schema, Cause } from 'effect'
import { GameLoopError } from '@/domain/errors'

/**
 * Frame command type for queue-based game loop
 */
export const FrameCommandSchema = Schema.TaggedStruct('Tick', {
  timestamp: Schema.Number,
})
export type FrameCommand = Schema.Schema.Type<typeof FrameCommandSchema>

/**
 * Maximum queue capacity for frame commands
 */
const QUEUE_CAPACITY = 60

/**
 * GameLoopService class for managing the game loop
 *
 * Uses Effect.Queue for frame command processing with a bridge pattern
 * that connects requestAnimationFrame to the Effect-TS ecosystem.
 *
 * The caller passes a frameHandler that receives the variable delta time
 * (in seconds) for each frame, allowing all per-frame operations to be
 * composed externally (e.g. in main.ts).
 */
export class GameLoopService extends Effect.Service<GameLoopService>()(
  '@minecraft/application/GameLoopService',
  {
    effect: Effect.gen(function* () {
      const frameQueue = yield* Queue.bounded<FrameCommand>(QUEUE_CAPACITY)
      const runningRef = yield* Ref.make(false)

      // Track resources for cleanup
      let processingFiber: Fiber.RuntimeFiber<void, never> | null = null
      let animationFrameId: number | null = null

      return {
        start: (
          frameHandler: (deltaTime: number) => Effect.Effect<void, never>
        ): Effect.Effect<void, GameLoopError> =>
          Effect.gen(function* () {
            const currentlyRunning = yield* Ref.get(runningRef)
            if (currentlyRunning) {
              yield* Effect.fail(
                new GameLoopError({ reason: 'Game loop is already running' })
              )
            }

            /**
             * Frame processing loop - runs in a separate fiber.
             * Computes variable delta time from successive timestamps.
             */
            const processFrames = Effect.gen(function* () {
              let lastTimestamp = 0
              while (true) {
                const cmd = yield* Queue.take(frameQueue)
                const deltaTime =
                  lastTimestamp === 0
                    ? 0.016
                    : (cmd.timestamp - lastTimestamp) / 1000
                lastTimestamp = cmd.timestamp
                yield* frameHandler(deltaTime).pipe(
                  Effect.catchAll((e) =>
                    Effect.logError(`Frame error: ${String(e)}`)
                  )
                )
              }
            })

            /**
             * Bridge loop - connects requestAnimationFrame to Effect Queue.
             */
            const bridgeLoop = () => {
              const isRunning = Effect.runSync(Ref.get(runningRef))
              if (!isRunning) return

              const now = performance.now()

              Effect.runFork(
                Queue.offer(frameQueue, { _tag: 'Tick', timestamp: now }).pipe(
                  Effect.catchAllCause(cause =>
                    Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`)
                  )
                )
              )

              animationFrameId = requestAnimationFrame(bridgeLoop)
            }

            // Mark as running
            yield* Ref.set(runningRef, true)

            // Fork the processing fiber
            processingFiber = yield* Effect.fork(processFrames)

            // Start the bridge loop
            bridgeLoop()

            yield* Effect.log('Game loop started')
          }),

        stop: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(runningRef, false)

            // Cancel animation frame
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId)
              animationFrameId = null
            }

            // Interrupt processing fiber
            if (processingFiber !== null) {
              yield* Fiber.interrupt(processingFiber)
              processingFiber = null
            }

            // Shutdown the queue
            yield* Queue.shutdown(frameQueue)

            yield* Effect.log('Game loop stopped')
          }),

        isRunning: (): Effect.Effect<boolean, never> => Ref.get(runningRef),
      }
    }),
  }
) {}

export const GameLoopServiceLive = GameLoopService.Default
