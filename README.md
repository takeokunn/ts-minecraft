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
  domain/         -- Pure schemas and types (Block, ItemStack, Chunk, etc.)
  application/    -- Business logic services (Effect.Service classes)
  infrastructure/ -- External adapters (Three.js, IndexedDB, custom physics)
  presentation/   -- DOM UI and HUD
  shared/         -- Cross-cutting utilities (math, branded types)
  main.ts         -- Entry point and layer composition
```

All services use Effect-TS layers for dependency injection. See `src/layers.ts` for the full service graph.

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
