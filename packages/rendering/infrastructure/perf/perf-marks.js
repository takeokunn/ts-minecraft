// Activated by `?debug=perf` URL query. `markEffect` wraps Effect-typed boundaries
// with `performance.mark`+`performance.measure` for browser DevTools timeline and Playwright
// `browser_console_messages` capture. No-op when the flag is absent.
import { Effect } from 'effect';
import { PERF_ENABLED } from '../../application/perf-flags';
export { isPerfEnabled } from '../../application/perf-flags';
export const markEffect = (name, effect) => {
    if (!PERF_ENABLED)
        return effect;
    const startMark = `${name}:start`;
    const endMark = `${name}:end`;
    return Effect.acquireUseRelease(Effect.sync(() => performance.mark(startMark)), () => effect, () => Effect.sync(() => {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
    }));
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/perf/perf-marks.js.map