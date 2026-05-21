# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Performance roadmap — P0 .. P4 mandatory FRs complete

All 28 mandatory functional requirements across the five performance phases
(P0 instrumentation, P1 game-loop, P2 chunk pipeline, P3 meshing/LOD, P4
rendering) are implemented and covered by the test suite. See
[`phase/04-performance-requirements.md`](phase/04-performance-requirements.md)
for the FR-by-FR table and production wire status.

### Added

- **P0 — Instrumentation** (`packages/rendering/infrastructure/perf/`)
  - `gpu-timer-service.ts` — WebGL2 disjoint timer query wrapper (FR-0.x).
  - `perf-marks.ts` — User-Timing API marks for frame-stage breakdowns.
- **P1 — Game-loop hardening** (`packages/app/application/frame/`)
  - Multi-stage frame pipeline (`stages/`) with cancellable per-stage Effects.
  - Adaptive performance mode hooks honoured by `frame-maintenance.ts`.
- **P2 — Chunk pipeline**
  - `packages/terrain/domain/chunk-aabb.ts` — chunk-local dirty AABB primitive
    used by light propagation, render-dirty drains, and sub-region meshing
    (FR-4.2).
  - Render-dirty queue carries accumulated AABBs through to the meshing
    worker pool (`packages/rendering/infrastructure/meshing/meshing-worker-pool.ts`).
- **P3 — Meshing & LOD**
  - `packages/rendering/infrastructure/meshing/subregion-greedy.ts` — sub-region
    greedy meshing entrypoint (FR-4.1). Architectural seam in place; persistent
    cross-frame slice cache is deferred (see Deferred below).
  - `packages/rendering/infrastructure/meshing/lod-simplification.ts` —
    distance-based LOD with snap-to-grid quad decimation: LOD 0 (full),
    LOD 1 (~25-30% verts), LOD 2 (~6-10% verts) — FR-3.1 / FR-3.2.
- **P4 — Rendering bandwidth**
  - `packages/rendering/infrastructure/post-processing/composite-pass.ts` —
    CompositePass merges Bloom + GodRays + Bokeh into a single full-screen
    fragment shader, saving ~25 MB/frame at 1080p `HalfFloatType` (FR-4.3).
    SSIM > 0.95 budget verified against legacy passes via `composite-pass.test.ts`.
  - Refraction pre-pass screen-ratio gating (FR-4.4) — water RT update is
    skipped when on-screen water area falls below
    `refractionMinScreenRatio` (per preset).
- **Settings presets** (`packages/game/application/settings-service.config.ts`)
  - `low` / `medium` / `high` / `ultra` graphics presets with explicit
    `useCompositePass`, `composerRtType`, `pixelRatioCap`, and
    `refractionMinScreenRatio` per preset.

### Changed

- README "Features" section now reflects CompositePass merge, sub-region
  re-mesh, and LOD; test count updated `1800+` → `3390+ across 292 files`.
- Architecture section in README enumerates the post-monorepo package layout
  (kernel / app / game / terrain / rendering / physics / inventory / furnace /
  player / entities / world-state) instead of the legacy DDD subfolders inside
  `src/`.
- DDD package structure: every package has `domain/`, `application/`,
  `infrastructure/`, `presentation/` layers with `index.ts` at package root
  (no `src/` subdirectory).

### Deferred

These items are gated by future work and do **not** block the P0..P4 mandatory
deliverables:

- **FR-4.5 — Perceptual SSIM auto-quality gate**: runtime SSIM probe to
  auto-step `graphicsQuality` down on sustained frame budget overruns.
  Architecture seam exists in `composite-pass.ts` (SSIM > 0.95 verified at
  build time); runtime probe + downgrade policy not yet wired.
- **FR-4.6 — Cross-frame slice cache**: persistent per-chunk meshing slice
  cache for sub-region greedy. The architectural hook is documented in
  `subregion-greedy.ts:268`; the worker currently full-re-meshes the chunk
  while honouring the dirty AABB protocol, leaving room for the cache to
  drop into the same data path.

### Tests

- `pnpm vitest run` — 3390 passing, 0 skipped, 292 files (post-P4 cleanup
  baseline; saturation tests un-skipped).
- `pnpm exec tsc --noEmit` — 0 errors.
- E2E smoke + FPS-threshold suites continue to pass via Playwright with
  SwiftShader WebGL.

[Unreleased]: https://github.com/takeokunn/ts-minecraft/compare/HEAD
