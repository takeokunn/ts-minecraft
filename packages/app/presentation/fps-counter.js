import { Effect, Option, Ref, Schema, Metric } from 'effect';
export const FPSCounterStateSchema = Schema.Struct({
    frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    fps: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
    accumulatedTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
});
const FPS_SAMPLE_INTERVAL = 0.1; // seconds
const fpsGauge = Metric.gauge('fps');
export class FPSCounterService extends Effect.Service()('@minecraft/presentation/FPSCounter', {
    effect: Ref.make({
        frameCount: 0,
        fps: 0,
        accumulatedTime: 0,
    }).pipe(Effect.map((state) => ({
        tick: (deltaTime) => Effect.gen(function* () {
            const maybeNewFPS = yield* Ref.modify(state, (s) => {
                const next = {
                    ...s,
                    frameCount: s.frameCount + 1,
                    accumulatedTime: s.accumulatedTime + deltaTime,
                };
                if (next.accumulatedTime >= FPS_SAMPLE_INTERVAL) {
                    const calculatedFPS = next.frameCount / next.accumulatedTime;
                    return [Option.some(calculatedFPS), { frameCount: 0, fps: calculatedFPS, accumulatedTime: 0 }];
                }
                return [Option.none(), next];
            });
            yield* Option.match(maybeNewFPS, {
                onNone: () => Effect.void,
                onSome: (fps) => fpsGauge.pipe(Metric.set(fps)),
            });
        }),
        getFPS: () => Ref.get(state).pipe(Effect.map((s) => s.fps)),
        getFrameCount: () => Ref.get(state).pipe(Effect.map((s) => s.frameCount)),
    })))
}) {
}
//# sourceMappingURL=../../../dist/packages/app/presentation/fps-counter.js.map