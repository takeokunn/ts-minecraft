// Piecewise-linear spline utilities.
// Pure math primitive — no Effect wrapper, no service dependencies.
// Used by the 1.18-style multi-noise heightmap pipeline.
// Returns the endpoint value when t is outside the spline range (clamped, not extrapolated).
export const evaluateSpline = (spline, t) => {
    const n = spline.length;
    if (n === 0)
        return 0;
    const first = spline[0];
    if (t <= first[0])
        return first[1];
    const last = spline[n - 1];
    if (t >= last[0])
        return last[1];
    // Linear scan for the bracket. Splines here have <= 8 control points,
    // so the branch-predictor-friendly linear scan beats a binary search.
    for (let i = 1; i < n; i++) {
        const [t1, v1] = spline[i];
        if (t <= t1) {
            const [t0, v0] = spline[i - 1];
            const span = t1 - t0;
            // Guard against zero-width segments (duplicate t values).
            /* c8 ignore next */
            if (span === 0)
                return v1;
            return v0 + (v1 - v0) * (t - t0) / span;
        }
        /* c8 ignore next */
    }
    /* c8 ignore next 3 */
    // Unreachable given the upper-bound clamp above, but satisfies the type system.
    return last[1];
};
//# sourceMappingURL=../../../dist/packages/terrain/domain/spline.js.map