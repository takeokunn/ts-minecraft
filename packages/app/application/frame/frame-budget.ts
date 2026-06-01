// FR-1.1: Dynamic frame-budget calculation parameterised on the target frame rate.
//
// Historically the engine assumed 60 FPS / 16 ms frames and hard-coded the
// chunk-sync time budget at 4 ms together with a few per-frame "max updates"
// counts. On a 120 Hz display that 4 ms slice eats roughly half of the
// available 8.33 ms frame, leaving very little room for the rest of the
// pipeline. These pure helpers derive the same values from the active target
// FPS so that callers can stay framerate-agnostic.
//
// The constants below are chosen so that `targetFps = 60` reproduces the
// previous hard-coded values exactly (4 ms / 8 chunks / 4 dirty chunks).

import { Schema } from 'effect'

export const TargetFpsSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.brand('TargetFps'),
)

export type TargetFps = Schema.Schema.Type<typeof TargetFpsSchema>

export const TargetFps = {
  make: (n: number): TargetFps => Schema.decodeUnknownSync(TargetFpsSchema)(n),
  toNumber: (fps: TargetFps): number => fps,
}

const fpsValue = (fps: TargetFps | number): number => fps

/**
 * Total frame budget in milliseconds for the given target FPS.
 * 60 FPS → 16.667 ms, 120 FPS → 8.333 ms, 240 FPS → 4.167 ms.
 */
export const computeFrameBudgetMs = (targetFps: TargetFps | number): number =>
  1000 / fpsValue(targetFps)

/**
 * Per-frame time budget for the chunk-sync drain.
 * Pinned so that 60 FPS yields exactly 4 ms (matching the previous constant);
 * scales linearly with `1 / targetFps`, i.e. ~25% of the total frame budget.
 * 60 FPS → 4 ms, 120 FPS → 2 ms, 240 FPS → 1 ms.
 */
export const computeChunkSyncBudgetMs = (targetFps: TargetFps | number): number =>
  240 / fpsValue(targetFps)

/**
 * Hard-cap on chunk meshes added to the scene per frame.
 * 60 FPS → 8, 120 FPS → 16, 240 FPS → 32. Higher refresh rates can absorb
 * more chunk work because each frame is shorter and we want roughly the same
 * wall-clock throughput regardless of FPS.
 */
export const computeMaxChunkUpdatesPerFrame = (targetFps: TargetFps | number): number =>
  Math.ceil((8 * fpsValue(targetFps)) / 60)

/**
 * Hard-cap on dirty chunk remeshes flushed per frame.
 * 60 FPS → 4, 120 FPS → 8, 240 FPS → 16.
 */
export const computeMaxDirtyChunkUpdatesPerFrame = (targetFps: TargetFps | number): number =>
  Math.ceil((4 * fpsValue(targetFps)) / 60)

/**
 * Default target FPS used by the rest of the engine until `SettingsSchema`
 * grows a first-class field for it. Centralised here so a single edit will
 * roll the new value out everywhere when that settings field is added.
 */
export const DEFAULT_TARGET_FPS: TargetFps = TargetFps.make(120)
