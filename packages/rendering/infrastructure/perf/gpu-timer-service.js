// GPU-side performance timer using `EXT_disjoint_timer_query_webgl2`.
//
// Activated by `?debug=perf` URL query (same gate as `markEffect` / `PerfHudService`).
// `markGpuRange(name, effect)` wraps an Effect that issues GPU draw commands with
// a `beginQuery(TIME_ELAPSED_EXT, q)` / `endQuery(TIME_ELAPSED_EXT)` pair. The
// resulting timer queries are read back asynchronously in `poll()` (call once per
// frame) and aggregated into per-name rolling averages exposed via `getSnapshot()`.
//
// Disabled-path contract (PERF disabled OR extension absent OR not yet attached):
//   - `markGpuRange` returns the inner effect unchanged (reference equality preserved).
//   - `poll` is `Effect.void`.
//   - `getSnapshot` returns an empty Map.
//
// The service is `scoped:` because allocated `WebGLQuery` objects must be released
// via `gl.deleteQuery()` on scope teardown to avoid leaking GPU resources.
import { Array as Arr, Effect, MutableRef, Option } from 'effect';
import { isPerfEnabled } from '../../application/perf-flags';
// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const ROLLING_SAMPLE_COUNT = 10; // per-name rolling average window
const NS_PER_MS = 1e6;
// EXT_disjoint_timer_query_webgl2 numeric constants. Defined here because lib.dom
// doesn't include them as named WebGL2 constants and we want to avoid pulling in
// a `@webgl/types` dependency.
const TIME_ELAPSED_EXT = 0x88bf;
const QUERY_RESULT_EXT = 0x8866;
const QUERY_RESULT_AVAILABLE_EXT = 0x8867;
const GPU_DISJOINT_EXT = 0x8fbb;
// -----------------------------------------------------------------------------
// Helper: detect WebGL2 + extension availability
// -----------------------------------------------------------------------------
// Resolves the WebGL2 context from a THREE WebGLRenderer and checks for the
// timer-query extension. Returns `Option.none()` if either is unavailable.
const resolveGlBindings = (renderer) => {
    // `getContext()` returns `WebGLRenderingContext | WebGL2RenderingContext` in
    // THREE typings. We need the WebGL2 variant for `beginQuery` / `endQuery`.
    const ctx = renderer.getContext();
    if (!ctx)
        return Option.none();
    // Duck-type WebGL2 by checking for `createQuery` method existence. The
    // renderer typing is `WebGLRenderingContext` (the lowest common denominator)
    // but the runtime instance is WebGL2 when THREE's renderer is WebGL2-capable.
    const maybeWebGL2 = ctx;
    if (typeof maybeWebGL2.createQuery !== 'function')
        return Option.none();
    // Probe for the extension. Per spec, modern browsers expose the extension's
    // entry points directly on the WebGL2 context, but the extension object MUST
    // still be requested to enable them.
    const ext = maybeWebGL2.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext)
        return Option.none();
    return Option.some({ gl: maybeWebGL2 });
};
// -----------------------------------------------------------------------------
// Helper: append sample with rolling cap
// -----------------------------------------------------------------------------
const appendSample = (existing, sample) => {
    const next = [...existing, sample];
    return next.length <= ROLLING_SAMPLE_COUNT
        ? next
        : Arr.drop(next, next.length - ROLLING_SAMPLE_COUNT);
};
const computeAverage = (samples) => {
    if (samples.length === 0)
        return 0;
    const sum = Arr.reduce(samples, 0, (acc, x) => acc + x);
    return sum / samples.length;
};
// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------
export class GpuTimerService extends Effect.Service()('@minecraft/infrastructure/perf/GpuTimerService', {
    // `scoped:` is required because `WebGLQuery` objects must be released via
    // `gl.deleteQuery()` on scope teardown to avoid leaking GPU handles.
    scoped: Effect.gen(function* () {
        const enabled = isPerfEnabled();
        // -------------------------------------------------------------------
        // No-op fallback. Used when:
        //   - `?debug=perf` is absent, OR
        //   - `attach()` is never called, OR
        //   - the WebGL2 extension is unavailable.
        // -------------------------------------------------------------------
        const buildNoop = () => ({
            markGpuRange: (_name, effect) => effect,
            poll: () => Effect.void,
            getSnapshot: () => Effect.succeed(new Map()),
            // Even attach is a no-op in the disabled path — flag check happens once
            // at scope acquisition.
            attach: (_renderer) => Effect.void,
        });
        if (!enabled) {
            return buildNoop();
        }
        // -------------------------------------------------------------------
        // Active path — `?debug=perf` flag detected.
        // We still defer the actual GL binding to `attach()` because the
        // renderer is created later in boot scope.
        // -------------------------------------------------------------------
        const bindingsRef = MutableRef.make(Option.none());
        const inFlightRef = MutableRef.make([]);
        // Per-name rolling-window averages (in ms).
        const samplesRef = MutableRef.make(new Map());
        // Finalizer: release every still-in-flight WebGLQuery. Required because
        // GPU handles are not garbage-collected.
        yield* Effect.addFinalizer(() => Effect.sync(() => {
            const bindings = MutableRef.get(bindingsRef);
            if (Option.isNone(bindings))
                return;
            const { gl } = bindings.value;
            const queue = MutableRef.get(inFlightRef);
            Arr.forEach(queue, ({ query }) => {
                gl.deleteQuery(query);
            });
            MutableRef.set(inFlightRef, []);
        }));
        const attach = (renderer) => Effect.sync(() => {
            // Idempotent — re-attach is a no-op once bound. Prevents accidental
            // double-binding from corrupting in-flight queue.
            if (Option.isSome(MutableRef.get(bindingsRef)))
                return;
            const resolved = resolveGlBindings(renderer);
            MutableRef.set(bindingsRef, resolved);
        });
        const markGpuRange = (name, effect) => {
            const bindingsOpt = MutableRef.get(bindingsRef);
            if (Option.isNone(bindingsOpt))
                return effect;
            const { gl } = bindingsOpt.value;
            return Effect.acquireUseRelease(
            // acquire: create + begin a fresh timer query.
            Effect.sync(() => {
                const query = gl.createQuery();
                // `createQuery` can fail in pathological contexts (context loss).
                // When it does, we degrade gracefully by returning null and
                // skipping the begin/end pair.
                if (!query)
                    return null;
                gl.beginQuery(TIME_ELAPSED_EXT, query);
                return query;
            }), 
            // use: run the wrapped effect (the actual GPU draw).
            () => effect, 
            // release: end the query and enqueue it for later read-back.
            (query) => Effect.sync(() => {
                if (!query)
                    return;
                gl.endQuery(TIME_ELAPSED_EXT);
                MutableRef.update(inFlightRef, (queue) => [...queue, { name, query }]);
            }));
        };
        const poll = () => Effect.sync(() => {
            const bindingsOpt = MutableRef.get(bindingsRef);
            if (Option.isNone(bindingsOpt))
                return;
            const { gl } = bindingsOpt.value;
            // Drain completed queries from the head of the FIFO. The queue is
            // FIFO: queries finish in the order they were issued, so we stop at
            // the first incomplete query.
            const queue = MutableRef.get(inFlightRef);
            // Probe disjoint flag once per poll — when true, every result issued
            // since the last poll is invalid and must be discarded.
            // The parameter type is `number` per the WebGL2 spec.
            const disjoint = gl.getParameter(GPU_DISJOINT_EXT);
            let consumedCount = 0;
            const nextSamples = new Map(MutableRef.get(samplesRef));
            for (const entry of queue) {
                const available = gl.getQueryParameter(entry.query, QUERY_RESULT_AVAILABLE_EXT);
                if (!available)
                    break;
                // Always read + delete to free GPU resources, even when the
                // measurement is invalid (disjoint).
                const ns = gl.getQueryParameter(entry.query, QUERY_RESULT_EXT);
                gl.deleteQuery(entry.query);
                consumedCount += 1;
                if (!disjoint) {
                    const ms = ns / NS_PER_MS;
                    const window = Option.getOrElse(Option.fromNullable(nextSamples.get(entry.name)), () => []);
                    nextSamples.set(entry.name, appendSample(window, ms));
                }
            }
            if (consumedCount > 0) {
                MutableRef.set(inFlightRef, queue.slice(consumedCount));
                MutableRef.set(samplesRef, nextSamples);
            }
        });
        const getSnapshot = () => Effect.sync(() => {
            const samples = MutableRef.get(samplesRef);
            const out = new Map();
            samples.forEach((window, name) => {
                out.set(name, computeAverage(window));
            });
            return out;
        });
        const impl = {
            markGpuRange,
            poll,
            getSnapshot,
            attach,
        };
        return impl;
    }),
}) {
}
export const GpuTimerServiceLive = GpuTimerService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/perf/gpu-timer-service.js.map