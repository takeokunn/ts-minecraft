import { Effect, Queue, Ref, Fiber, Schema, Cause } from 'effect'
import { GameLoopError } from '@/domain/errors'
import type { DeltaTimeSecs } from '@/shared/kernel'

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
 * Design:
 *   - start() creates a fresh queue, forks the processing fiber, starts rAF bridge,
 *     and returns immediately. The loop runs in the background.
 *   - stop() interrupts the fiber, cancels animation frames, shuts down the queue.
 *   - The queue is recreated on each start() to support restart semantics.
 */
export class GameLoopService extends Effect.Service<GameLoopService>()(
  '@minecraft/application/GameLoopService',
  {
    effect: Effect.gen(function* () {
      const runningRef = yield* Ref.make(false)

      // Holds the current frame queue (recreated on each start)
      const frameQueueRef = yield* Ref.make<Queue.Queue<FrameCommand> | null>(null)

      // Holds the current processing fiber (null when stopped)
      const processingFiberRef = yield* Ref.make<Fiber.RuntimeFiber<void, never> | null>(null)

      // animationFrameId stays as let — assigned inside sync rAF callback
      let animationFrameId: number | null = null

      return {
        /**
         * Start the game loop with a frame handler.
         *
         * Creates a fresh queue, forks the frame-processing fiber, and starts the
         * rAF bridge. Returns immediately — the loop runs in the background until
         * stop() is called.
         *
         * Fails with GameLoopError if the loop is already running.
         */
        start: (
          frameHandler: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>
        ): Effect.Effect<void, GameLoopError> =>
          Effect.gen(function* () {
            const currentlyRunning = yield* Ref.get(runningRef)
            if (currentlyRunning) {
              yield* Effect.fail(
                new GameLoopError({ reason: 'Game loop is already running' })
              )
            }

            // Use a dropping queue: when the consumer falls behind, new offers are silently
            // discarded rather than blocking the rAF bridge. This prevents unbounded fiber
            // accumulation under load (the alternative — unbounded blocking offers — would
            // pile up rAF fibers on frame backpressure).
            const frameQueue = yield* Queue.dropping<FrameCommand>(QUEUE_CAPACITY)
            yield* Ref.set(frameQueueRef, frameQueue)

            /**
             * Frame processing loop - runs in a separate fiber.
             * Computes variable delta time from successive timestamps.
             */
            const processFrames: Effect.Effect<void, never> = Effect.gen(function* () {
              let lastTimestamp = 0
              while (true) {
                const cmd = yield* Queue.take(frameQueue)
                // seconds (performance.now() timestamps are ms, divided by 1000)
                const rawDelta =
                  lastTimestamp === 0
                    ? 0.016
                    : (cmd.timestamp - lastTimestamp) / 1000
                const deltaTime = Math.max(0.001, rawDelta) as unknown as DeltaTimeSecs
                lastTimestamp = cmd.timestamp
                // catchAllCause captures both expected errors AND defects (unexpected exceptions).
                // Using catchAll here would let defects propagate and kill the processing fiber,
                // leaving runningRef=true while the loop has stopped silently.
                yield* frameHandler(deltaTime).pipe(
                  Effect.catchAllCause((cause) =>
                    Effect.logError(`Frame error: ${Cause.pretty(cause)}`)
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

              // With a dropping queue, offer() returns false when the queue is full — no error.
              // We use runFork to avoid blocking the rAF callback, but the dropping semantics
              // ensure that no fiber piles up on backpressure.
              Effect.runFork(
                Queue.offer(frameQueue, { _tag: 'Tick', timestamp: now }).pipe(
                  Effect.asVoid,
                  Effect.catchAllCause(cause =>
                    Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`)
                  )
                )
              )

              animationFrameId = requestAnimationFrame(bridgeLoop)
            }

            // Mark as running before forking
            yield* Ref.set(runningRef, true)

            // Fork the processing fiber — do NOT join it here.
            // The fiber runs in the background; stop() will interrupt it.
            const fiber = yield* Effect.fork(processFrames)
            yield* Ref.set(processingFiberRef, fiber)

            // Start the bridge loop (schedules first rAF callback)
            bridgeLoop()

            yield* Effect.log('Game loop started')
            // Returns immediately — loop runs in the background
          }),

        /**
         * Stop the game loop.
         *
         * Cancels the pending animation frame, interrupts the processing fiber,
         * and shuts down the queue. Safe to call when the loop is not running.
         */
        stop: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(runningRef, false)

            // Cancel animation frame
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId)
              animationFrameId = null
            }

            // Interrupt processing fiber
            const fiber = yield* Ref.get(processingFiberRef)
            if (fiber !== null) {
              yield* Fiber.interrupt(fiber)
              yield* Ref.set(processingFiberRef, null)
            }

            // Shutdown the queue to unblock any pending take
            const queue = yield* Ref.get(frameQueueRef)
            if (queue !== null) {
              yield* Queue.shutdown(queue)
              yield* Ref.set(frameQueueRef, null)
            }

            yield* Effect.log('Game loop stopped')
          }),

        isRunning: (): Effect.Effect<boolean, never> => Ref.get(runningRef),
      }
    }),
  }
) {}

export const GameLoopServiceLive = GameLoopService.Default
