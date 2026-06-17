// FPS cap. requestAnimationFrame fires at the display refresh rate, so on a
// 120/144/240 Hz monitor the full simulate+render pipeline ran 2-4x more often
// than needed, burning ~one CPU core continuously (the "CPUを食いすぎ" report).
// We throttle the simulation/render to TARGET_FRAME_RATE using a carry-over
// accumulator (NOT `now - lastOffered`, which undershoots on refresh rates that
// aren't an integer multiple of the target, and can halve a 60 Hz display under
// jitter). 60 fps is smooth for Minecraft and roughly halves CPU on high-refresh
// displays; displays at or below 60 Hz are unaffected.
export const TARGET_FRAME_RATE = 60
export const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FRAME_RATE

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
