# ts-minecraft

A Minecraft-like voxel game built entirely in the browser with TypeScript, Three.js, and Effect-TS.

## Features

- Procedural terrain generation with biomes (plains, forests, deserts, mountains, lakes)
- Block breaking and placement
- Inventory system with hotbar
- Day/night cycle with physical sky simulation
- Custom physics engine (Euler integration + AABB collision)
- Greedy meshing for efficient chunk rendering
- Post-processing pipeline (GTAO, bloom, SSR, depth-of-field, god rays, SMAA)
- Water rendering with refraction shader
- World persistence via IndexedDB
- Comprehensive test suite (1800+ unit tests, E2E tests with Playwright)

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
  kernel/         -- Shared kernel: branded types, constants, pure math, ports
  app/            -- Session, frame pipeline, menu/UI composition
  game/           -- Game state, time, and game-loop services
  terrain/        -- Chunks, terrain generation, and block rules
  rendering/      -- Three.js rendering bounded context
  physics/        -- Physics and collision systems
  inventory/      -- Inventory, crafting, and furnace systems
  player/         -- Player domain state and camera/movement logic
  entities/       -- Entity data models
  world-state/    -- Persistent world-state data and storage ports
```

Each package follows package-by-feature layering where needed: `domain/` for pure data/rules/ports, `application/` for Effect services and orchestration, `infrastructure/` for external adapters, and `presentation/` for UI-facing code. Layer composition lives in `packages/app/application/main/layers/` and is wired from `src/main.ts`.

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
