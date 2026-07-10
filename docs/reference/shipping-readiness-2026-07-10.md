# Shipping Readiness Assessment — 2026-07-10

Evidence-based snapshot of release quality across functional, non-functional,
UX, and accessibility dimensions. Every claim below is backed by an automated
gate or an in-browser verification performed on this date.

## Quality gates (all green)

| Gate | Result |
| --- | --- |
| Type check (`pnpm typecheck`, build + test configs) | 0 errors |
| Lint (`pnpm lint`, oxlint, 1,896 files) | 0 warnings / 0 errors |
| Unit + integration tests (`pnpm vitest run`) | 9,287 passed / 0 failed |
| End-to-end suite (`pnpm test:e2e`, Playwright + SwiftShader) | 64 passed / 0 failed / 2 skipped |
| Production build (`pnpm build`) | success |

## E2E coverage (systematic gameplay verification)

The Playwright suite drives the real game in a browser and covers:

- **Gameplay**: block mining/placement, inventory management, player controls,
  the survival progression loop, new-world regression checks (terrain, night
  readability, mob movement), lighting/entities, long-run stability.
- **Performance**: FPS threshold, perf-stage baseline, perf targets.
- **UI**: main menu, HUD, settings overlay, inventory overlay, loading screen,
  accessibility.
- **Persistence**: IndexedDB creation, reload persistence, save & quit →
  reload with restored player position (fixed today, see below).
- **Multiplayer, contracts, smoke boot.**

## Performance (measured, not estimated)

From the 2026-07-10 in-browser profiling campaign (CDP profiler, QA APIs):

- Walking p95 frame time **10 ms** at 120 fps target; **0 frame spikes** at
  2.3× sprint speed.
- Heap: **no leak** — 207 MB post-GC plateau (earlier "345 MB" reading was a
  pre-GC transient).
- Block targeting via voxel-DDA: 2.3 ms → **0.09 ms** (~25×).
- Fluid simulation event-driven rework: 37–55× on its hot path.

## Accessibility

- Full key remapping (curated action set), UI scale (75–150 %), reduced
  motion (setting + `prefers-reduced-motion`), FOV slider (30–110°).
- **Colorblind correction** (protanopia / deuteranopia / tritanopia; SVG
  feColorMatrix daltonization on the world canvas) — shipped today.
- **Sound-cue captions** (self-expiring on-screen text for every gameplay
  sound; works with audio muted; `aria-live`) — shipped today.
- HUD carries icon + numeric redundancy; critical states never rely on color
  alone. Menus are dialog-role, focus-trapped, WCAG-AA contrast audited.

## User-visible fixes shipped today (11 commits)

1. Jittered-grid tree placement (crowns no longer fuse into walkable leaf slabs).
2. Level-up / achievement celebration cues (sound + visual, redundant channels).
3. Colorblind correction filter (settings, persisted).
4. Sound-cue captions (hearing accessibility).
5. Black-void terrain bug: carvers no longer hollow out river/lake beds.
6. Save-heal for pre-fix worlds (hollow beds flood-filled on load).
7. Underwater giant-wireframe: fluids draw no outline; camera cell untargetable.
8. Second-world loading-screen deadlock (game-loop fiber teardown).
9. QA diagnostics for rendering triage (light probes, mesh light stats).
10. Terrain-appearance test repairs; carver regression tests.

## Known limitations / watch items

- Worlds saved before today keep their old terrain on disk; the load-time
  healer repairs hollow water beds in memory on every load (idempotent).
- A torn-down session's maintenance fiber can be slow to acknowledge
  interruption; teardown now never blocks on it (`Fiber.interruptFork`), but
  the root cause of the slow acknowledgement is still open.
- E2E `new-world-regression` is occasionally flaky under SwiftShader (passes
  on retry).
- Pointer lock is unavailable in headless browsers; camera-rotation E2E
  coverage relies on QA aim helpers instead.

## Verification methodology

- Every visual fix was verified in a real browser (screenshots, QA API
  probes), not only by unit tests.
- Terrain fixes verified by block-level scans (e.g., 204 water columns / 0
  hollow beds in a fresh world; the previously broken column healed in the
  original save).
- The loading-screen deadlock was diagnosed from its console signature
  (second session logs "Game loop started" but never "Maintenance loop
  started") and confirmed fixed by the previously failing E2E test.
