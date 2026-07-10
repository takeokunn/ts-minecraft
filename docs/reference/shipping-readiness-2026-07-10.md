# Shipping Readiness Assessment — updated 2026-07-11

Evidence-based snapshot of release quality across functional, non-functional,
UX, and accessibility dimensions. Every claim below is backed by an automated
gate or an in-browser verification.

## Quality gates (all green as of 2026-07-11)

| Gate | Result |
| --- | --- |
| Type check (`pnpm typecheck`, build + test configs) | 0 errors |
| Lint (`pnpm lint`, oxlint, ~1,900 files) | 0 warnings / 0 errors |
| Unit + integration tests (`pnpm vitest run`) | 9,366 passed / 0 failed (814 files) |
| End-to-end suite (`pnpm test:e2e`, Playwright + SwiftShader) | 64 passed / 0 failed / 2 skipped (2026-07-10 baseline) |
| Production build (`pnpm build`) | success |

## Feature completeness (2026-07-11)

- **23 entity types** including the Guardian (ocean hostile with a prismarine
  laser beam); aquatic spawn selection (land mobs no longer spawn on the
  ocean surface).
- **Status effects**: Regeneration, Poison, Speed, Slowness, Hunger, and
  Absorption (golden hearts HUD row above health; golden apple grants
  Regen II + Absorption I, vanilla-parity).
- **World content**: 120 block types incl. the amethyst geode family
  (basalt/calcite/amethyst shells, glowing clusters), deepslate layer + ore
  variants, ocean monuments, woodland mansions, jungle/desert temples,
  shipwrecks, strongholds, villages, kelp/seagrass ocean flora.
- **Vehicles**: parked boats/minecarts persist in the world and in saves;
  rail-following minecart physics (straights lock to the axis, curves turn,
  ascending rails climb). Curved/sloped rail *meshes* still render the flat
  tile — visual polish item.
- **Multiplayer sync roster complete**: dimension-tagged block edits, chest
  contents (close-broadcast + late-joiner replay), dropped items
  (owner-diff; item trading works), parked vehicles (owner-diff + live
  replay log), entity-host authority, session clock extrapolation, seed
  handshake. Documented races: simultaneous pickup/boarding within one RTT.
- **Modding API v1**: `window.__TS_MINECRAFT_MODS__` registration; onInit /
  onBlockBreak / onBlockPlace / onTick hooks with a capability-scoped
  context (see `docs/reference/modding-api.md`).

## Performance (measured, not estimated)

From the 2026-07-10 in-browser profiling campaign (CDP profiler, QA APIs):

- Walking p95 frame time **10 ms** at 120 fps target; **0 frame spikes** at
  2.3× sprint speed.
- Heap: **no leak** — 207 MB post-GC plateau.
- Block targeting via voxel-DDA: 2.3 ms → **0.09 ms** (~25×).
- Fluid simulation event-driven rework: 37–55× on its hot path.

## Accessibility

- Full key remapping, UI scale (75–150 %), reduced motion, FOV slider.
- Colorblind correction (protanopia/deuteranopia/tritanopia).
- Sound-cue captions (works with audio muted; `aria-live`).
- HUD icon + numeric redundancy; damage-direction indicator; menus are
  dialog-role, focus-trapped, WCAG-AA contrast audited.

## Save compatibility

- Worlds saved before the 2026-07-10 carver fix keep their old terrain on
  disk; the load-time healer (`healHollowWaterBeds`) repairs hollow water
  beds in memory on **every load** (idempotent, verified on an affected
  save) — no user-visible defect remains.
- All newer save fields (portals, parked vehicles, dimension tags,
  absorption) are optional-schema: old saves load unchanged.

## Known limitations / watch items (updated 2026-07-11)

All previously listed watch items are now closed:

- ~~E2E new-world-regression SwiftShader flake~~ — root-caused: the spec
  embedded a startup-FPS floor of 20, stricter than the platform's own
  calibrated SwiftShader floors (CI 10 / local 12) owned by
  fps-threshold.e2e.ts. FPS floors now live only in the dedicated spec;
  wall-clock-sensitive samplings converted to condition polling with
  unchanged thresholds. Verified: 9 consecutive passes under parallel
  SwiftShader contention.
- ~~Multiplayer sub-RTT pickup/boarding dupes~~ — server-authoritative
  first-claim-wins arbitration (ClaimDenied protocol); losers undo their
  local prediction. Residual: an item consumed within one round trip of a
  lost claim is best-effort.
- ~~Maintenance fiber interruption latency~~ — root-caused (interruption
  pending on a heavy iteration's suspensions, not a stuck fiber); stale
  loops now exit at the next iteration boundary via a generation gate.
- ~~Curved/sloped rail meshes~~ and ~~guardian beam charge-up~~ — shipped.

## Verification methodology

- Every visual fix verified in a real browser (screenshots, QA API probes),
  not only by unit tests — including this period's absorption-hearts HUD
  (hold-to-eat under SwiftShader needs wall-clock patience: game time crawls
  at low frame rates because deltaTime caps at 0.05/frame).
- Terrain fixes verified by block-level scans; save-heal verified against an
  affected pre-fix save.
