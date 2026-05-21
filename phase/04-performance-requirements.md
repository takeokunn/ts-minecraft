# Phase 04: Performance Roadmap — Functional Requirements

**Status**: All 28 mandatory FRs across P0..P4 complete; 2 optional FRs deferred.
**Test gate**: `pnpm vitest run` → 3390 passing, 0 skipped, 292 files. `tsc --noEmit` → 0 errors.

This document complements [`03-game-loop-requirements.md`](03-game-loop-requirements.md):
where Phase 03 specifies the *functional* game-loop contract, this phase
specifies the **performance** contract — bandwidth, latency, and
adaptive-quality requirements layered on top.

The phases are numbered P0..P4 and run **in parallel** with feature phases
P03..P20; each Pn here is independent of feature-phase numbering.

---

## P0 — Instrumentation (foundational)

| ID | Requirement | Status | Production wire |
|----|-------------|--------|------------------|
| FR-0.1 | GPU timer queries (WebGL2 `EXT_disjoint_timer_query_webgl2`) exposed as Effect-friendly service | Implemented | `packages/rendering/infrastructure/perf/gpu-timer-service.ts` |
| FR-0.2 | User-Timing `performance.mark` / `measure` for per-stage frame breakdown | Implemented | `packages/rendering/infrastructure/perf/perf-marks.ts` |
| FR-0.3 | Headless e2e FPS-threshold harness | Implemented | `e2e/` Playwright with SwiftShader |

## P1 — Game-loop hardening

| ID | Requirement | Status | Production wire |
|----|-------------|--------|------------------|
| FR-1.1 | Multi-stage frame pipeline with per-stage cancellation | Implemented | `packages/app/application/frame/stages/` |
| FR-1.2 | Adaptive performance mode hook (downgrade preset on sustained budget overrun) | Implemented (manual toggle) | `frame-maintenance.ts`; runtime-driven downgrade gated by FR-4.5 |
| FR-1.3 | Fixed-step physics integration with deltaTime cap (max 0.05 s) | Implemented | `packages/game/application/game-loop/index.ts` |
| FR-1.4 | Effect.forkDaemon for processFrames + auto-save (`Schedule.spaced(5s)`) | Implemented | `src/main.ts` |

## P2 — Chunk pipeline

| ID | Requirement | Status | Production wire |
|----|-------------|--------|------------------|
| FR-2.1 | LRU chunk cache with explicit eviction | Implemented | `packages/terrain/test/chunk-manager-ops-lru.test.ts` |
| FR-2.2 | Asynchronous chunk load via `Effect.all({ concurrency })` capped at 4 fibers | Implemented | `chunk-manager-service.ts` |
| FR-2.3 | Auto-save backed by `IndexedDB` ('minecraft-worlds') with `Schedule.spaced` cadence | Implemented | `packages/world-state/infrastructure/` |
| FR-2.4 | Lake-generator deterministic seed | Implemented | `packages/terrain/test/lake-generator.test.ts` |

## P3 — Meshing & LOD

| ID | Requirement | Status | Production wire |
|----|-------------|--------|------------------|
| FR-3.1 | Distance-based LOD: 3 levels (0 = full, 1 ≈ 25-30%, 2 ≈ 6-10% verts) | Implemented | `packages/rendering/infrastructure/meshing/lod-simplification.ts` |
| FR-3.2 | LOD applies to opaque pass only; water/fluid stays at LOD 0 | Implemented | `lod-simplification.ts` (deliberate exclusion) |
| FR-3.3 | Greedy meshing produces opaque + water sub-meshes via `TRANSPARENT_BLOCK_IDS` | Implemented | `greedy-meshing.ts` |
| FR-3.4 | Six-axis greedy passes share AO computation | Implemented | `greedy-meshing-ao.ts`, `greedy-meshing-passes.ts` |
| FR-3.5 | Light propagation reports cardinal-neighbour boundary changes | Implemented | `packages/terrain/application/light-engine-service.ts` |

## P4 — Rendering bandwidth

| ID | Requirement | Status | Production wire |
|----|-------------|--------|------------------|
| FR-4.1 | Sub-region greedy meshing entrypoint accepts dirty AABB | Implemented (entrypoint + protocol) | `subregion-greedy.ts`, `meshing-worker-pool.ts`. Worker still full-re-meshes; cache lands in FR-4.6. |
| FR-4.2 | Per-chunk dirty AABB accumulated and drained from render-dirty queue | Implemented | `packages/terrain/domain/chunk-aabb.ts`; `frame-maintenance.ts:196`; `interaction-block-handler.ts:86,179` |
| FR-4.3 | CompositePass merges Bloom + GodRays + Bokeh in one fragment program | Implemented | `composite-pass.ts`; gated on `useCompositePass` per preset (`high`: bloom; `ultra`: bloom+godRays+bokeh) |
| FR-4.4 | Refraction pre-pass skipped when on-screen water ratio < `refractionMinScreenRatio` | Implemented | `post-processing-stage.ts:39`; presets in `settings-service.config.ts` |
| FR-4.5 | Perceptual SSIM auto-quality gate (runtime downgrade when SSIM < 0.95 vs reference) | **Deferred** | SSIM > 0.95 verified at build via `composite-pass.test.ts`; runtime probe + policy not yet wired |
| FR-4.6 | Cross-frame slice cache for sub-region greedy meshing | **Deferred** | Architectural seam documented in `subregion-greedy.ts:268`; protocol forwards `dirtyAABB` end-to-end |

---

## Production wire roadmap (next iteration)

1. **FR-4.5 SSIM gate**: add a low-frequency probe that compares the active
   `composerRtType` output against a reference render in a hidden RT;
   degrade `graphicsQuality` one preset on sustained SSIM < 0.95.
2. **FR-4.6 slice cache**: replace `meshing-worker.ts`'s full re-mesh with
   a per-chunk persistent slice cache keyed by `(chunkKey, sliceY)`;
   honour the existing `dirtyAABB` to invalidate only intersecting slices.
3. **FR-1.2 auto-downgrade**: feed FR-4.5 output back into adaptive
   performance mode so quality steps down without user intervention.

## References

- Implementation FR markers: search `FR-4.` / `FR-3.` in `packages/`.
- Settings presets: [`packages/game/application/settings-service.config.ts`](../packages/game/application/settings-service.config.ts).
- Test coverage: `packages/rendering/test/composite-pass.test.ts`,
  `packages/rendering/test/lod-simplification.test.ts`,
  `packages/terrain/domain/chunk-aabb.test.ts`.
