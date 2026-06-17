import { Effect, Option, Queue, Ref, Fiber, Cause, MutableRef, Duration } from 'effect'
import { GameLoopError } from '../domain/errors'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { FIRST_FRAME_DELTA_SECS } from '../domain/constants'
import { MIN_FRAME_INTERVAL_MS, advanceFramePacing } from './game-loop-pacing'

export type FrameHandler = (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>

const QUEUE_CAPACITY = 60

// Stand-alone helper: schedules rAF (or setInterval fallback) frames into the queue.
// Extracted from start() to reduce nesting depth.
const buildScheduleFrame = (
  frameQueue: Queue.Queue<number>,
  isRunningRef: MutableRef.MutableRef<boolean>,
  animationFrameIdRef: MutableRef.MutableRef<Option.Option<number>>,
): (() => void) => {
  // Frame-pacing state for the FPS cap (rAF path only; setInterval already ~60).
  const pacingAccumulatorRef = MutableRef.make(0)
  const lastRafTimestampRef = MutableRef.make<number>(Number.NaN)
  const scheduleFrame = (): void => {
    const hasRequestAnimationFrame = typeof globalThis.requestAnimationFrame === 'function'
    const rafId = hasRequestAnimationFrame
      ? globalThis.requestAnimationFrame((timestamp) => {
          /* c8 ignore next */
          if (!MutableRef.get(isRunningRef)) return

          // FPS cap: accumulate elapsed time and only emit a frame once a full
          // target interval has built up. First callback (NaN) seeds one interval
          // so the very first frame always emits.
          const lastTs = MutableRef.get(lastRafTimestampRef)
          MutableRef.set(lastRafTimestampRef, timestamp)
          const gapMs = Number.isNaN(lastTs) ? MIN_FRAME_INTERVAL_MS : timestamp - lastTs
          const paced = advanceFramePacing(MutableRef.get(pacingAccumulatorRef), gapMs, MIN_FRAME_INTERVAL_MS)
          MutableRef.set(pacingAccumulatorRef, paced.accumulatedMs)

          if (paced.emit) {
            Effect.runFork(
              Queue.offer(frameQueue, timestamp).pipe(
                Effect.catchAllCause((cause) => Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`)),
              ),
            )
          }

          /* c8 ignore next 2 */
          if (MutableRef.get(isRunningRef)) {
            scheduleFrame()
          }
        })
      : /* c8 ignore start */ globalThis.setInterval(() => {
          if (!MutableRef.get(isRunningRef)) return

          Effect.runFork(
            Queue.offer(frameQueue, performance.now()).pipe(
              Effect.catchAllCause((cause) => Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`)),
            ),
          )
        }, 16) /* c8 ignore stop */

    MutableRef.set(animationFrameIdRef, Option.some(rafId))
  }
  return scheduleFrame
}

// Atomically extracts the current value of a ref and replaces it with none().
const takeOption = <A>(ref: Ref.Ref<Option.Option<A>>): Effect.Effect<Option.Option<A>, never> =>
  Ref.getAndSet(ref, Option.none())

// Queue-based bridge: dropping queue prevents rAF fiber pile-up under load; loop recreated on each start() for restart semantics.
export class GameLoopService extends Effect.Service<GameLoopService>()(
  '@minecraft/application/GameLoopService',
  {
    effect: Effect.gen(function* () {
      // Holds the current frame queue (recreated on each start)
      const frameQueueRef = yield* Ref.make<Option.Option<Queue.Queue<number>>>(Option.none())
      // Holds the current processing fiber (None when stopped)
      const processingFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none())
      const maintenanceFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none())
      const frameHandlerRef = yield* Ref.make<Option.Option<FrameHandler>>(Option.none())
      const isRunningRef = yield* Effect.sync(() => MutableRef.make(false))
      const animationFrameIdRef = yield* Effect.sync(() => MutableRef.make<Option.Option<number>>(Option.none()))

      const cancelScheduledFrame = (): void => {
        const animationFrameId = MutableRef.get(animationFrameIdRef)
        const frameId = Option.getOrNull(animationFrameId)
        if (frameId !== null) {
          if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.cancelAnimationFrame(frameId)
          } else {
            globalThis.clearInterval(frameId)
          }
        }
        MutableRef.set(animationFrameIdRef, Option.none())
      }

      const startFrameProcessing = (frameHandler: FrameHandler): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const frameQueue = yield* Queue.dropping<number>(QUEUE_CAPACITY)
          yield* Ref.set(frameQueueRef, Option.some(frameQueue))

          const lastTimestampRef = yield* Ref.make(0)
          // processFrames: Effect.flatMap chain instead of Effect.gen to avoid
          // a per-iteration generator allocation under Effect.forever.
          const processFrames: Effect.Effect<void, never> = Queue.take(frameQueue).pipe(
            Effect.flatMap((timestamp) =>
              Ref.get(lastTimestampRef).pipe(
                Effect.flatMap((lastTimestamp) => {
                  const rawDelta = lastTimestamp === 0
                    ? FIRST_FRAME_DELTA_SECS
                    : (timestamp - lastTimestamp) / 1000
                  const deltaTime = DeltaTimeSecs.make(Math.min(Math.max(0.001, rawDelta), 0.05))
                  return Ref.set(lastTimestampRef, timestamp).pipe(
                    Effect.flatMap(() =>
                      frameHandler(deltaTime).pipe(
                        Effect.catchAllCause((cause) => Effect.logError(`Frame error: ${Cause.pretty(cause)}`)),
                      ),
                    ),
                  )
                }),
              ),
            ),
          ).pipe(Effect.forever)

          MutableRef.set(isRunningRef, true)
          const fiber = yield* Effect.forkDaemon(processFrames)
          yield* Ref.set(processingFiberRef, Option.some(fiber))
          buildScheduleFrame(frameQueue, isRunningRef, animationFrameIdRef)()
        })

      return {
        start: (frameHandler: FrameHandler): Effect.Effect<void, GameLoopError> =>
          Effect.gen(function* () {
            if (MutableRef.get(isRunningRef)) {
              /* c8 ignore next 2 */
              yield* Effect.fail(new GameLoopError({ reason: 'Game loop is already running' }))
            }

            yield* Ref.set(frameHandlerRef, Option.some(frameHandler))
            yield* startFrameProcessing(frameHandler)
            yield* Effect.log('Game loop started')
          }),

        pause: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            MutableRef.set(isRunningRef, false)
            cancelScheduledFrame()
            const processingFiber = Option.getOrNull(yield* takeOption(processingFiberRef))
            if (processingFiber !== null) yield* Fiber.interrupt(processingFiber)
            yield* Effect.log('Game loop paused')
          }),

        resume: (frameHandler?: FrameHandler): Effect.Effect<void, GameLoopError> =>
          Effect.gen(function* () {
            if (MutableRef.get(isRunningRef)) return
            if (frameHandler) yield* Ref.set(frameHandlerRef, Option.some(frameHandler))

            const storedHandler = Option.getOrNull(yield* Ref.get(frameHandlerRef))
            if (storedHandler === null) yield* Effect.fail(new GameLoopError({ reason: 'No frame handler stored' }))
            else yield* startFrameProcessing(storedHandler)

            yield* Effect.log('Game loop resumed')
          }),

        startMaintenance: (
          maintenanceHandler: () => Effect.Effect<boolean, never>,
        ): Effect.Effect<void, GameLoopError> =>
          Effect.gen(function* () {
            const existing = yield* Ref.get(maintenanceFiberRef)
            /* c8 ignore next 2 */
            if (Option.isSome(existing)) yield* Effect.fail(new GameLoopError({ reason: 'Maintenance loop is already running' }))

            const maintenanceLoop = Effect.gen(function* () {
              const wasBusy = yield* maintenanceHandler().pipe(
                Effect.catchAllCause((cause) =>
                  /* c8 ignore next -- defensive error logger: only fires on unexpected defect */
                  Effect.gen(function* () {
                    yield* Effect.logError(`Maintenance loop error: ${Cause.pretty(cause)}`)
                    return true
                  })
                ),
              )
              /* c8 ignore next */
              yield* Effect.sleep(Duration.millis(wasBusy ? 16 : 48))
            }).pipe(Effect.forever)

            const fiber = yield* Effect.forkDaemon(maintenanceLoop)
            yield* Ref.set(maintenanceFiberRef, Option.some(fiber))
            yield* Effect.log('Maintenance loop started')
          }),

        stop: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            MutableRef.set(isRunningRef, false)
            cancelScheduledFrame()
            const processingFiber = Option.getOrNull(yield* takeOption(processingFiberRef))
            if (processingFiber !== null) yield* Fiber.interrupt(processingFiber)
            const frameQueue = Option.getOrNull(yield* takeOption(frameQueueRef))
            if (frameQueue !== null) yield* Queue.shutdown(frameQueue)
            yield* Ref.set(frameHandlerRef, Option.none())
            const maintenanceFiber = Option.getOrNull(yield* takeOption(maintenanceFiberRef))
            if (maintenanceFiber !== null) yield* Fiber.interrupt(maintenanceFiber)
            yield* Effect.log('Game loop stopped')
          }),

        isRunning: (): Effect.Effect<boolean, never> => Effect.sync(() => MutableRef.get(isRunningRef)),
      }
    }),
  }
) {}
