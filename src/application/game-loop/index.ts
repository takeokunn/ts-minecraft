import { Effect, Option, Queue, Ref, Fiber, Schema, Cause } from 'effect'
import { GameLoopError } from '@/domain/errors'
import { DeltaTimeSecs } from '@/shared/kernel'
import { FIRST_FRAME_DELTA_SECS } from '@/application/constants'

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
      // INTENTIONAL: plain boolean for rAF hot path; cannot use Effect inside rAF callback
      let _isRunning = false

      // Holds the current frame queue (recreated on each start)
      const frameQueueRef = yield* Ref.make<Option.Option<Queue.Queue<FrameCommand>>>(Option.none())

      // Holds the current processing fiber (None when stopped)
      const processingFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none())

      // animationFrameId stays as let — assigned inside sync rAF callback
      let animationFrameId: Option.Option<number> = Option.none()

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
            if (_isRunning) {
              yield* Effect.fail(
                new GameLoopError({ reason: 'Game loop is already running' })
              )
            }

            // Use a dropping queue: when the consumer falls behind, new offers are silently
            // discarded rather than blocking the rAF bridge. This prevents unbounded fiber
            // accumulation under load (the alternative — unbounded blocking offers — would
            // pile up rAF fibers on frame backpressure).
            const frameQueue = yield* Queue.dropping<FrameCommand>(QUEUE_CAPACITY)
            yield* Ref.set(frameQueueRef, Option.some(frameQueue))

            // Timestamp accumulator as Ref — reset to 0 on each start(), no mutable let needed
            const lastTimestampRef = yield* Ref.make(0)

            /**
             * Frame processing loop - runs in a separate fiber.
             * Effect.forever re-executes the take+process step until the fiber is interrupted.
             * Computes variable delta time from successive timestamps via lastTimestampRef.
             */
            const processFrames: Effect.Effect<void, never> = Queue.take(frameQueue).pipe(
              Effect.flatMap((cmd) => Effect.gen(function* () {
                const lastTimestamp = yield* Ref.get(lastTimestampRef)
                // seconds (performance.now() timestamps are ms, divided by 1000)
                const rawDelta =
                  lastTimestamp === 0
                    ? FIRST_FRAME_DELTA_SECS
                    : (cmd.timestamp - lastTimestamp) / 1000
                // Cap at 50ms to prevent physics tunneling on tab-resume or heavy frames
                const deltaTime = DeltaTimeSecs.make(Math.min(Math.max(0.001, rawDelta), 0.05))
                yield* Ref.set(lastTimestampRef, cmd.timestamp)
                // catchAllCause captures both expected errors AND defects (unexpected exceptions).
                // Using catchAll here would let defects propagate and kill the processing fiber,
                // leaving _isRunning=true while the loop has stopped silently.
                yield* frameHandler(deltaTime).pipe(
                  Effect.catchAllCause((cause) =>
                    Effect.logError(`Frame error: ${Cause.pretty(cause)}`)
                  )
                )
              })),
              Effect.forever
            )

            /**
             * Bridge loop - connects requestAnimationFrame to Effect Queue.
             */
            const bridgeLoop = () => {
              // INTENTIONAL: plain boolean for rAF hot path; cannot use Effect inside rAF callback
              if (!_isRunning) return

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

              animationFrameId = Option.some(requestAnimationFrame(bridgeLoop))
            }

            // Mark as running before forking
            _isRunning = true

            // Fork as a daemon fiber — NOT attached to any scope.
            // Using Effect.fork here would tie the fiber to mainProgram's scope
            // (via Effect.scoped), causing it to be interrupted the moment mainProgram
            // exits after start() returns. forkDaemon keeps the fiber alive until
            // stop() explicitly interrupts it via Fiber.interrupt.
            const fiber = yield* Effect.forkDaemon(processFrames)
            yield* Ref.set(processingFiberRef, Option.some(fiber))

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
            _isRunning = false

            // Cancel animation frame
            Option.map(animationFrameId, (id) => cancelAnimationFrame(id))
            animationFrameId = Option.none()

            // Interrupt processing fiber
            yield* Option.match(yield* Ref.get(processingFiberRef), {
              onNone: () => Effect.void,
              onSome: (fiber) => Effect.gen(function* () {
                yield* Fiber.interrupt(fiber)
                yield* Ref.set(processingFiberRef, Option.none())
              }),
            })

            // Shutdown the queue to unblock any pending take
            yield* Option.match(yield* Ref.get(frameQueueRef), {
              onNone: () => Effect.void,
              onSome: (queue) => Effect.gen(function* () {
                yield* Queue.shutdown(queue)
                yield* Ref.set(frameQueueRef, Option.none())
              }),
            })

            yield* Effect.log('Game loop stopped')
          }),

        isRunning: (): Effect.Effect<boolean, never> => Effect.succeed(_isRunning),
      }
    }),
  }
) {}

export const GameLoopServiceLive = GameLoopService.Default
