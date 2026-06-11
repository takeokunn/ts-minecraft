import { Effect, Option, Queue, Ref, Fiber, Schema, Cause, MutableRef, Duration } from 'effect'
import { GameLoopError } from '../domain/errors'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { FIRST_FRAME_DELTA_SECS } from '../domain/constants'

export const FrameCommandSchema = Schema.TaggedStruct('Tick', {
  timestamp: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})
export type FrameCommand = Schema.Schema.Type<typeof FrameCommandSchema>
export type FrameHandler = (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>

const QUEUE_CAPACITY = 60

// FPS cap. requestAnimationFrame fires at the display refresh rate, so on a
// 120/144/240 Hz monitor the full simulate+render pipeline ran 2-4x more often
// than needed, burning ~one CPU core continuously (the "CPUを食いすぎ" report).
// We throttle the simulation/render to TARGET_FRAME_RATE using a carry-over
// accumulator (NOT `now - lastOffered`, which undershoots on refresh rates that
// aren't an integer multiple of the target, and can halve a 60 Hz display under
// jitter). 60 fps is smooth for Minecraft and roughly halves CPU on high-refresh
// displays; displays at or below 60 Hz are unaffected.
export const TARGET_FRAME_RATE = 60
const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FRAME_RATE

/**
 * Pure frame-pacing step. Given the accumulated unspent time, the gap since the
 * last rAF callback, and the target interval, decide whether to emit a frame and
 * return the new accumulator. The accumulator carries the remainder so the
 * long-run emit rate converges exactly on the target; it is clamped to one
 * interval of backlog so a long pause (background tab) can't unleash a burst.
 */
export const advanceFramePacing = (
  accumulatedMs: number,
  gapMs: number,
  intervalMs: number,
): { readonly emit: boolean; readonly accumulatedMs: number } => {
  const acc = Math.min(accumulatedMs + gapMs, intervalMs * 2)
  return acc >= intervalMs
    ? { emit: true, accumulatedMs: acc - intervalMs }
    : { emit: false, accumulatedMs: acc }
}

// Stand-alone helper: schedules rAF (or setInterval fallback) frames into the queue.
// Extracted from start() to reduce nesting depth.
const buildScheduleFrame = (
  frameQueue: Queue.Queue<FrameCommand>,
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
              Queue.offer(frameQueue, { _tag: 'Tick', timestamp }).pipe(
                Effect.asVoid,
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
            Queue.offer(frameQueue, { _tag: 'Tick', timestamp: performance.now() }).pipe(
              Effect.asVoid,
              Effect.catchAllCause((cause) => Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`)),
            ),
          )
        }, 16) /* c8 ignore stop */

    MutableRef.set(animationFrameIdRef, Option.some(rafId))
  }
  return scheduleFrame
}

// Queue-based bridge: dropping queue prevents rAF fiber pile-up under load; loop recreated on each start() for restart semantics.
export class GameLoopService extends Effect.Service<GameLoopService>()(
  '@minecraft/application/GameLoopService',
  {
    effect: Effect.all([
      // Holds the current frame queue (recreated on each start)
      Ref.make<Option.Option<Queue.Queue<FrameCommand>>>(Option.none()),
      // Holds the current processing fiber (None when stopped)
      Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none()),
      Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none()),
      Ref.make<Option.Option<FrameHandler>>(Option.none()),
      Effect.sync(() => MutableRef.make(false)),
      Effect.sync(() => MutableRef.make<Option.Option<number>>(Option.none())),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([frameQueueRef, processingFiberRef, maintenanceFiberRef, frameHandlerRef, isRunningRef, animationFrameIdRef]) => {
        const cancelScheduledFrame = (): void => {
          const animationFrameId = MutableRef.get(animationFrameIdRef)
          Option.map(animationFrameId, (id) => {
            if (typeof globalThis.requestAnimationFrame === 'function') {
              globalThis.cancelAnimationFrame(id)
            } else {
              globalThis.clearInterval(id)
            }
          })
          MutableRef.set(animationFrameIdRef, Option.none())
        }

        const startFrameProcessing = (frameHandler: FrameHandler): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const frameQueue = yield* Queue.dropping<FrameCommand>(QUEUE_CAPACITY)
            yield* Ref.set(frameQueueRef, Option.some(frameQueue))

            const lastTimestampRef = yield* Ref.make(0)
            const processFrames: Effect.Effect<void, never> = Queue.take(frameQueue).pipe(
              Effect.flatMap((cmd) =>
                Effect.gen(function* () {
                  const lastTimestamp = yield* Ref.get(lastTimestampRef)
                  const rawDelta =
                    lastTimestamp === 0
                      ? FIRST_FRAME_DELTA_SECS
                      : (cmd.timestamp - lastTimestamp) / 1000
                  const deltaTime = DeltaTimeSecs.make(Math.min(Math.max(0.001, rawDelta), 0.05))
                  yield* Ref.set(lastTimestampRef, cmd.timestamp)
                  yield* frameHandler(deltaTime).pipe(
                    Effect.catchAllCause((cause) => Effect.logError(`Frame error: ${Cause.pretty(cause)}`)),
                  )
                }),
              ),
              Effect.forever,
            )

            MutableRef.set(isRunningRef, true)
            const fiber = yield* Effect.forkDaemon(processFrames)
            yield* Ref.set(processingFiberRef, Option.some(fiber))
            buildScheduleFrame(frameQueue, isRunningRef, animationFrameIdRef)()
          })

        return Effect.succeed({
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

              const processingFiber = yield* Ref.modify(processingFiberRef, (opt): [Option.Option<Fiber.RuntimeFiber<void, never>>, Option.Option<Fiber.RuntimeFiber<void, never>>] =>
                [opt, Option.none()]
              )
              yield* Option.match(processingFiber, {
                onNone: () => Effect.void,
                onSome: (fiber) => Fiber.interrupt(fiber),
              })

              yield* Effect.log('Game loop paused')
            }),

          resume: (frameHandler?: FrameHandler): Effect.Effect<void, GameLoopError> =>
            Effect.gen(function* () {
              if (MutableRef.get(isRunningRef)) return
              if (frameHandler) yield* Ref.set(frameHandlerRef, Option.some(frameHandler))

              const storedHandler = yield* Ref.get(frameHandlerRef)
              yield* Option.match(storedHandler, {
                onNone: () => Effect.fail(new GameLoopError({ reason: 'No frame handler stored' })),
                onSome: (handler) => startFrameProcessing(handler),
              })

              yield* Effect.log('Game loop resumed')
            }),

          startMaintenance: (
            maintenanceHandler: () => Effect.Effect<boolean, never>,
          ): Effect.Effect<void, GameLoopError> =>
            Effect.gen(function* () {
              // Atomically read the current fiber to check if already running
              const existing = yield* Ref.modify(maintenanceFiberRef, (opt): [Option.Option<Fiber.RuntimeFiber<void, never>>, Option.Option<Fiber.RuntimeFiber<void, never>>] =>
                [opt, opt]
              )
              /* c8 ignore next 2 */
              yield* Option.match(existing, {
                onSome: () => Effect.fail(new GameLoopError({ reason: 'Maintenance loop is already running' })),
                onNone: () => Effect.void,
              })

              const maintenanceLoop = maintenanceHandler().pipe(
                Effect.catchAllCause((cause) =>
                  /* c8 ignore next -- defensive error logger: only fires on unexpected defect */
                  Effect.logError(`Maintenance loop error: ${Cause.pretty(cause)}`).pipe(Effect.as(true))
                ),
                /* c8 ignore next */
                Effect.flatMap((wasBusy) => Effect.sleep(Duration.millis(wasBusy ? 16 : 48))),
                Effect.forever,
              )

              const fiber = yield* Effect.forkDaemon(maintenanceLoop)
              yield* Ref.set(maintenanceFiberRef, Option.some(fiber))
              yield* Effect.log('Maintenance loop started')
            }),

          stop: (): Effect.Effect<void, never> =>
            Effect.gen(function* () {
            MutableRef.set(isRunningRef, false)
            cancelScheduledFrame()

              // Atomically extract and clear each ref, then act on the extracted value
              const processingFiber = yield* Ref.modify(processingFiberRef, (opt): [Option.Option<Fiber.RuntimeFiber<void, never>>, Option.Option<Fiber.RuntimeFiber<void, never>>] =>
                [opt, Option.none()]
              )
              yield* Option.match(processingFiber, {
                onNone: () => Effect.void,
                onSome: (fiber) => Fiber.interrupt(fiber),
              })

              const frameQueue = yield* Ref.modify(frameQueueRef, (opt): [Option.Option<Queue.Queue<FrameCommand>>, Option.Option<Queue.Queue<FrameCommand>>] =>
                [opt, Option.none()]
              )
              yield* Option.match(frameQueue, {
                onNone: () => Effect.void,
                onSome: (queue) => Queue.shutdown(queue),
              })

              yield* Ref.set(frameHandlerRef, Option.none())

              const maintenanceFiber = yield* Ref.modify(maintenanceFiberRef, (opt): [Option.Option<Fiber.RuntimeFiber<void, never>>, Option.Option<Fiber.RuntimeFiber<void, never>>] =>
                [opt, Option.none()]
              )
              yield* Option.match(maintenanceFiber, {
                onNone: () => Effect.void,
                onSome: (fiber) => Fiber.interrupt(fiber),
              })

              yield* Effect.log('Game loop stopped')
            }),

        isRunning: (): Effect.Effect<boolean, never> => Effect.sync(() => MutableRef.get(isRunningRef)),
      })
      }),
    ),
  }
) {}

export const GameLoopServiceLive = GameLoopService.Default
