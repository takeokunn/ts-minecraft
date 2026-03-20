# ts-minecraft

A Minecraft-like voxel game built with TypeScript, Three.js, and Effect-TS.

## Tech Stack

- **Effect-TS 3.19+** — functional effect system (services, layers, error handling)
- **Three.js** — 3D rendering (WebGL2)
- **cannon-es** — physics simulation
- **Vite** — dev server and bundler
- **vitest** — testing (with @effect/vitest for fiber-aware tests)

## Getting Started

```sh
pnpm install
pnpm dev        # Start dev server at http://localhost:5173
```

## Running Tests

```sh
pnpm vitest run          # Run all unit tests (1500+ tests)
pnpm typecheck           # TypeScript type check
pnpm lint                # oxlint code style check
pnpm test:e2e            # E2E tests (requires running dev server)
```

## Architecture

```
src/
  domain/         — Pure schemas and types (Block, ItemStack, Chunk, etc.)
  application/    — Business logic services (Effect.Service classes)
  infrastructure/ — External adapters (Three.js, cannon-es, IndexedDB)
  presentation/   — DOM UI and HUD
  shared/         — Cross-cutting utilities (math, branded types)
  main.ts         — Entry point (game startup)
```

All services use [Effect-TS](https://effect.website/) for dependency injection, error handling, and concurrency. See `src/application/layers.ts` for the full service graph.

## Controls

- **WASD** — Move
- **Mouse** — Look around
- **Left click** — Break block
- **Right click** — Place block
- **E** — Open inventory
- **Esc** — Open settings
- **1-9** — Select hotbar slot
