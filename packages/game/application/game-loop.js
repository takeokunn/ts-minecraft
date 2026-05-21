import { Effect, Option, Queue, Ref, Fiber, Schema, Cause, MutableRef, Duration } from 'effect';
import { GameLoopError } from '../domain/errors';
import { DeltaTimeSecs } from '@ts-minecraft/kernel';
import { FIRST_FRAME_DELTA_SECS } from '../domain/constants';
export const FrameCommandSchema = Schema.TaggedStruct('Tick', {
    timestamp: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
});
const QUEUE_CAPACITY = 60;
// Queue-based bridge: dropping queue prevents rAF fiber pile-up under load; loop recreated on each start() for restart semantics.
export class GameLoopService extends Effect.Service()('@minecraft/application/GameLoopService', {
    effect: Effect.all([
        // Holds the current frame queue (recreated on each start)
        Ref.make(Option.none()),
        // Holds the current processing fiber (None when stopped)
        Ref.make(Option.none()),
        Ref.make(Option.none()),
        Effect.sync(() => MutableRef.make(false)),
        Effect.sync(() => MutableRef.make(Option.none())),
    ], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([frameQueueRef, processingFiberRef, maintenanceFiberRef, isRunningRef, animationFrameIdRef]) => Effect.succeed({
        start: (frameHandler) => Effect.gen(function* () {
            if (MutableRef.get(isRunningRef)) {
                /* c8 ignore next 2 */
                yield* Effect.fail(new GameLoopError({ reason: 'Game loop is already running' }));
            }
            // Use a dropping queue: when the consumer falls behind, new offers are silently
            // discarded rather than blocking the rAF bridge. This prevents unbounded fiber
            // accumulation under load (the alternative — unbounded blocking offers — would
            // pile up rAF fibers on frame backpressure).
            const frameQueue = yield* Queue.dropping(QUEUE_CAPACITY);
            yield* Ref.set(frameQueueRef, Option.some(frameQueue));
            // Timestamp accumulator as Ref — reset to 0 on each start(), no mutable let needed
            const lastTimestampRef = yield* Ref.make(0);
            // Effect.forever drives the take+process loop; fiber interrupt (from stop()) terminates it cleanly.
            const processFrames = Queue.take(frameQueue).pipe(Effect.flatMap((cmd) => Effect.gen(function* () {
                const lastTimestamp = yield* Ref.get(lastTimestampRef);
                const rawDelta = lastTimestamp === 0
                    ? FIRST_FRAME_DELTA_SECS
                    : (cmd.timestamp - lastTimestamp) / 1000;
                const deltaTime = DeltaTimeSecs.make(Math.min(Math.max(0.001, rawDelta), 0.05));
                yield* Ref.set(lastTimestampRef, cmd.timestamp);
                yield* frameHandler(deltaTime).pipe(Effect.catchAllCause((cause) => Effect.logError(`Frame error: ${Cause.pretty(cause)}`)));
            })), Effect.forever);
            MutableRef.set(isRunningRef, true);
            const fiber = yield* Effect.forkDaemon(processFrames);
            yield* Ref.set(processingFiberRef, Option.some(fiber));
            const scheduleFrame = () => {
                const hasRequestAnimationFrame = typeof globalThis.requestAnimationFrame === 'function';
                const rafId = hasRequestAnimationFrame
                    ? globalThis.requestAnimationFrame((timestamp) => {
                        /* c8 ignore next */
                        if (!MutableRef.get(isRunningRef))
                            return;
                        Effect.runFork(Queue.offer(frameQueue, { _tag: 'Tick', timestamp }).pipe(Effect.asVoid, Effect.catchAllCause((cause) => Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`))));
                        /* c8 ignore next 2 */
                        if (MutableRef.get(isRunningRef)) {
                            scheduleFrame();
                        }
                    })
                    : /* c8 ignore start */ globalThis.setInterval(() => {
                        if (!MutableRef.get(isRunningRef))
                            return;
                        Effect.runFork(Queue.offer(frameQueue, { _tag: 'Tick', timestamp: performance.now() }).pipe(Effect.asVoid, Effect.catchAllCause((cause) => Effect.logError(`Frame queue error: ${Cause.pretty(cause)}`))));
                    }, 16); /* c8 ignore stop */
                MutableRef.set(animationFrameIdRef, Option.some(rafId));
            };
            scheduleFrame();
            yield* Effect.log('Game loop started');
        }),
        startMaintenance: (maintenanceHandler) => Effect.gen(function* () {
            const existingMaintenanceFiber = yield* Ref.get(maintenanceFiberRef);
            /* c8 ignore next 2 */
            yield* Option.match(existingMaintenanceFiber, {
                onSome: () => Effect.fail(new GameLoopError({ reason: 'Maintenance loop is already running' })),
                onNone: () => Effect.void,
            });
            const maintenanceLoop = maintenanceHandler().pipe(Effect.catchAllCause((cause) => 
            /* c8 ignore next -- defensive error logger: only fires on unexpected defect */
            Effect.logError(`Maintenance loop error: ${Cause.pretty(cause)}`).pipe(Effect.as(true))), 
            /* c8 ignore next */
            Effect.flatMap((wasBusy) => Effect.sleep(Duration.millis(wasBusy ? 16 : 48))), Effect.forever);
            const fiber = yield* Effect.forkDaemon(maintenanceLoop);
            yield* Ref.set(maintenanceFiberRef, Option.some(fiber));
            yield* Effect.log('Maintenance loop started');
        }),
        stop: () => Effect.gen(function* () {
            MutableRef.set(isRunningRef, false);
            const animationFrameId = MutableRef.get(animationFrameIdRef);
            Option.map(animationFrameId, (id) => {
                if (typeof globalThis.requestAnimationFrame === 'function') {
                    globalThis.cancelAnimationFrame(id);
                }
                else {
                    globalThis.clearInterval(id);
                }
            });
            MutableRef.set(animationFrameIdRef, Option.none());
            yield* Option.match(yield* Ref.get(processingFiberRef), {
                onNone: () => Effect.void,
                onSome: (fiber) => Effect.gen(function* () {
                    yield* Fiber.interrupt(fiber);
                    yield* Ref.set(processingFiberRef, Option.none());
                }),
            });
            yield* Option.match(yield* Ref.get(frameQueueRef), {
                onNone: () => Effect.void,
                onSome: (queue) => Effect.gen(function* () {
                    yield* Queue.shutdown(queue);
                    yield* Ref.set(frameQueueRef, Option.none());
                }),
            });
            yield* Option.match(yield* Ref.get(maintenanceFiberRef), {
                onNone: () => Effect.void,
                onSome: (fiber) => Effect.gen(function* () {
                    yield* Fiber.interrupt(fiber);
                    yield* Ref.set(maintenanceFiberRef, Option.none());
                }),
            });
            yield* Effect.log('Game loop stopped');
        }),
        isRunning: () => Effect.sync(() => MutableRef.get(isRunningRef)),
    }))),
}) {
}
export const GameLoopServiceLive = GameLoopService.Default;
//# sourceMappingURL=../../../dist/packages/game/application/game-loop.js.map