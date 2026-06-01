# ts-minecraft

A Minecraft-like voxel game built entirely in the browser with TypeScript, Three.js, and Effect-TS.

## Features

- Procedural terrain generation with biomes (plains, forests, deserts, mountains, dry lake/ocean basins)
- Block breaking and placement
- Inventory system with hotbar
- Day/night cycle with physical sky simulation
- Custom physics engine (Euler integration + AABB collision)
- Greedy meshing for efficient chunk rendering, with sub-region re-meshing on dirty AABBs (FR-4.1/4.2) and distance-based LOD simplification (FR-3.1/3.2)
- Post-processing pipeline (GTAO + SMAA always; bloom + DOF + god rays merged via CompositePass on `high`/`ultra` presets to save ~25 MB/frame full-screen RT bandwidth — FR-4.3)
- Water rendering support remains available, while new terrain generation keeps lake/ocean basins dry; water refraction pre-pass is screen-ratio gated (FR-4.4)
- World persistence via IndexedDB
- Comprehensive test suite (3580+ unit tests across 287 files, E2E tests with Playwright)

## Tech Stack

- **[Effect-TS](https://effect.website/)** -- Functional effect system for dependency injection, error handling, and concurrency
- **[Three.js](https://threejs.org/)** -- 3D rendering (WebGL2)
- **[Vite](https://vite.dev/)** -- Dev server and bundler
- **[Vitest](https://vitest.dev/)** -- Testing framework

## Getting Started

```sh
pnpm install
pnpm dev        # Start dev server at http://localhost:5173
```

## Scripts

```sh
pnpm dev            # Start development server
pnpm build          # Type check + production build
pnpm test           # Run all unit tests
pnpm typecheck      # TypeScript type check
pnpm lint           # oxlint code style check
pnpm test:e2e       # E2E tests (Playwright)
pnpm verify         # Run typecheck + lint + test + build
```

## Architecture

```
src/
  main.ts         -- Browser entry point
packages/
  core/           -- Shared kernel: branded types, constants, pure math, ports
  block/          -- Block definitions, light model, and block-level data
  world/          -- Terrain generation, chunk management, world persistence (IndexedDB)
  entity/         -- Entity management (mobs, player, AI, physics, drops)
  inventory/      -- Inventory, crafting, furnace pipeline, recipe definitions
  game/           -- Game state, time, settings presets, and game-loop services (physics absorbed)
  rendering/      -- Three.js rendering: greedy meshing, entity rendering, post-processing, GPU timer
  worker/         -- Web Worker pools (terrain generation, meshing)
  presentation/   -- Menu, HUD, debug overlay (extracted from app)
  app/            -- Boot, session lifecycle, frame pipeline, composition root
```

Each package follows DDD layering: `domain/` for pure data/rules/ports, `application/` for Effect services and orchestration, `infrastructure/` for external adapters, and `presentation/` for UI-facing code. All production source files are ≤300 lines. Layer composition lives in `packages/app/application/main/layers/` and is wired from `src/main.ts`.

## Performance Status

The performance roadmap covers five phases (P0..P4) of mandatory functional requirements (FRs) — all 28 mandatory FRs are implemented and gated on test count `3390+ passing`. Production wiring is complete for the user-visible quality presets (`low` / `medium` / `high` / `ultra`); the optional FR-4.5 (perceptual SSIM auto-quality gate) and FR-4.6 (cross-frame slice cache for sub-region greedy; FR-4.1 worker still full-re-meshes pending the cache) remain deferred and are tracked in [`CHANGELOG.md`](CHANGELOG.md) and [`phase/04-performance-requirements.md`](phase/04-performance-requirements.md).

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| Mouse | Look around |
| F5 | Toggle camera view |
| Left click | Break block |
| Right click | Place block |
| E | Open inventory |
| Esc | Open settings |
| 1-9 | Select hotbar slot |

## License

[MIT](LICENSE)
