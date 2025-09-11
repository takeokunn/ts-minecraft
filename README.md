# TypeScript Minecraft

A high-performance, fully functional TypeScript implementation of Minecraft using **Domain-Driven Design (DDD)** architecture with **Effect-TS**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Effect-TS](https://img.shields.io/badge/Effect--TS-3.17+-purple.svg)](https://effect.website/)
[![DDD](https://img.shields.io/badge/Architecture-DDD-green.svg)](./ARCHITECTURE.md)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Overview

This project demonstrates a complete Minecraft game engine implementation using cutting-edge functional programming patterns and domain-driven design principles. Built entirely with Effect-TS, it showcases how complex game systems can be architected using pure functional programming while maintaining high performance.

### Key Features

- **🏗️ Clean Architecture**: Strict DDD layer separation with dependency inversion
- **⚡ High Performance**: Structure of Arrays (SoA) ECS with optimized queries  
- **🔒 Type Safety**: 100% Effect-TS type system with comprehensive error handling
- **🚫 Zero Classes**: Pure functional programming - no classes or `this` keyword
- **🔄 Immutable State**: All data structures are immutable by default
- **🧪 Testable**: Pure functions enable comprehensive testing strategies
- **🎮 Full Minecraft Features**: World generation, block physics, player movement, rendering

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/takeokunn/ts-minecraft.git
cd ts-minecraft

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Development Commands

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm build           # Build for production
pnpm type-check      # Run TypeScript type checking

# Code Quality
pnpm lint            # Run oxlint static analysis
pnpm lint:fix        # Auto-fix linting issues
pnpm format          # Format code with Prettier + oxlint
pnpm format:check    # Check code formatting

# Testing
pnpm test            # Run unit tests with Vitest
pnpm test:ui         # Run tests with UI
pnpm test:coverage   # Run tests with coverage report
```

## Architecture Highlights

### DDD Layer Structure

```
src/
├── domain/           # Core business logic (entities, value objects, services)
├── application/      # Use cases, workflows, queries, commands  
├── infrastructure/   # Technical implementations (adapters, repositories)
├── presentation/     # User interface (controllers, view models, CLI tools)
└── shared/          # Common utilities and types
```

### Effect-TS Integration

All code follows Effect-TS patterns for:

- **Service Definition**: Context.Tag pattern with Layer composition
- **Error Handling**: Tagged errors with specific error types
- **Dependency Injection**: Type-safe DI through Effect Context system
- **Async Operations**: Effect.gen for composable async workflows
- **Resource Management**: Scoped resource handling with automatic cleanup

### Example: Player Movement System

```typescript
// Pure domain logic
export const calculateNewPosition = (
  current: Position,
  direction: Direction,
  speed: number
): Effect.Effect<Position, ValidationError> =>
  pipe(
    Effect.succeed(current),
    Effect.map(pos => pos.translate(
      direction.x * speed,
      direction.y * speed, 
      direction.z * speed
    )),
    Effect.flatMap(validatePosition)
  )

// Application use case
export const playerMoveUseCase = (
  playerId: EntityId,
  direction: Direction
): Effect.Effect<void, PlayerMoveError, WorldService | InputService> =>
  Effect.gen(function* () {
    const world = yield* WorldService
    const player = yield* world.getPlayer(playerId)
    
    const newPosition = yield* calculateNewPosition(
      player.position, 
      direction, 
      PLAYER_SPEED
    )
    
    yield* world.updatePlayerPosition(playerId, newPosition)
  })
```

## Performance Features

### Structure of Arrays (SoA) ECS

Components are stored in Structure of Arrays format for optimal CPU cache performance:

```typescript
// Traditional Array of Structures (slow)
const entities = [
  { position: {x: 1, y: 2, z: 3}, velocity: {dx: 0.1, dy: 0, dz: 0.1} },
  { position: {x: 4, y: 5, z: 6}, velocity: {dx: -0.1, dy: 0, dz: 0.2} }
]

// Structure of Arrays (fast - better cache locality)
const components = {
  position: { x: [1, 4], y: [2, 5], z: [3, 6] },
  velocity: { dx: [0.1, -0.1], dy: [0, 0], dz: [0.1, 0.2] }
}
```

### Optimized Query System

Pre-computed entity queries enable fast iteration over entity subsets:

```typescript
const movableQuery = createQuery({
  all: [Position, Velocity],    // Must have these components
  any: [Player, NPC],          // Must have at least one of these
  none: [Frozen, Disabled]     // Must not have any of these
})

// Fast iteration over matching entities
const { entities, components } = yield* world.querySoA(movableQuery)
for (let i = 0; i < entities.length; i++) {
  // Direct array access - no object creation
  components.position.x[i] += components.velocity.dx[i] * deltaTime
}
```

### Web Worker Integration

Heavy computations are offloaded to Web Workers:

- **Terrain Generation**: Procedural world generation in background threads
- **Mesh Building**: 3D geometry construction without blocking main thread  
- **Physics Simulation**: Collision detection and response
- **Lighting Calculations**: Dynamic lighting and shadows

## Project Structure

### Domain Layer (`src/domain/`)

Pure business logic with no external dependencies:

```typescript
// Entities
export class Player extends Data.Class<{
  readonly id: EntityId
  readonly name: string
  readonly position: Position
}> {}

// Value Objects  
export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  translate(dx: number, dy: number, dz: number): Position {
    return new Position({
      x: this.x + dx,
      y: this.y + dy, 
      z: this.z + dz
    })
  }
}

// Domain Services
export interface WorldDomainService {
  readonly generateTerrain: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<TerrainData, TerrainGenerationError>
}
```

### Application Layer (`src/application/`)

Orchestrates domain logic into specific use cases:

```typescript
// Use Cases
export const chunkLoadUseCase = (
  coordinate: ChunkCoordinate
): Effect.Effect<Chunk, ChunkLoadError, WorldService | TerrainService> =>
  Effect.gen(function* () {
    const world = yield* WorldService
    const terrain = yield* TerrainService
    
    const existingChunk = yield* world.getChunk(coordinate)
    if (Option.isSome(existingChunk)) {
      return existingChunk.value
    }
    
    const terrainData = yield* terrain.generateTerrain(coordinate)
    const chunk = yield* createChunk(coordinate, terrainData)
    yield* world.saveChunk(chunk)
    
    return chunk
  })
```

### Infrastructure Layer (`src/infrastructure/`)

Technical implementations of domain ports:

```typescript
// Adapter implementing domain port
export const threeJsRenderAdapter: RenderPort = {
  createMesh: (geometry, material) =>
    Effect.gen(function* () {
      const threeGeometry = convertGeometry(geometry)
      const threeMaterial = convertMaterial(material)
      const mesh = new THREE.Mesh(threeGeometry, threeMaterial)
      
      const id = yield* generateMeshId()
      yield* addToScene(mesh)
      
      return id
    }),
    
  updateMesh: (id, updates) =>
    Effect.gen(function* () {
      const mesh = yield* getMeshById(id)
      yield* applyUpdates(mesh, updates)
    })
}
```

## Development Guidelines

### Code Standards

1. **No Classes**: Use `Data.Class` for data types, pure functions for logic
2. **Immutability**: All data structures must be immutable
3. **Effect Wrapping**: All operations must return `Effect` types
4. **Tagged Errors**: Use specific error types for different failure modes
5. **Type Safety**: No `any`, `unknown`, or `as` assertions

### Testing Strategy

```typescript
import { describe, it, expect } from '@effect/vitest'

describe('PlayerMovement', () => {
  it.effect('should move player to valid position', () =>
    Effect.gen(function* () {
      const useCase = yield* PlayerMoveUseCase
      const world = yield* WorldService
      
      const playerId = EntityId('player-1')
      const initialPosition = yield* world.getPlayerPosition(playerId)
      
      yield* useCase.movePlayer(playerId, Direction.forward)
      
      const newPosition = yield* world.getPlayerPosition(playerId)
      expect(newPosition.z).toBeLessThan(initialPosition.z)
    }).pipe(
      Effect.provide(TestLayer)
    )
  )
})
```

### Error Handling

All errors are typed and handled explicitly:

```typescript
export class ChunkNotFoundError extends Data.TaggedError('ChunkNotFoundError')<{
  readonly coordinate: ChunkCoordinate
  readonly operation: string
}> {}

const loadChunk = (coord: ChunkCoordinate) =>
  pipe(
    chunkRepository.find(coord),
    Effect.catchTag('ChunkNotFoundError', (error) =>
      Effect.logInfo(`Generating new chunk at ${error.coordinate}`)
        .pipe(Effect.andThen(generateNewChunk(error.coordinate)))
    )
  )
```

## Performance Considerations

### Memory Management

- **Object Pooling**: Reuse objects to minimize garbage collection
- **Component Storage**: SoA format reduces memory fragmentation  
- **Batch Operations**: Group similar operations to reduce overhead
- **Lazy Loading**: Load chunks and assets on demand

### Rendering Optimization

- **Frustum Culling**: Only render visible chunks
- **Level of Detail**: Reduce complexity for distant objects
- **Instanced Rendering**: Batch similar objects (e.g., blocks)
- **WebGPU Support**: Hardware-accelerated rendering pipeline

### Compute Performance

- **Web Workers**: Parallel processing for CPU-intensive tasks
- **WASM Integration**: Native performance for critical algorithms
- **Query Optimization**: Pre-computed entity queries
- **Component Locality**: Cache-friendly data layouts

## Effect-TS Dependencies

This project leverages the complete Effect-TS ecosystem:

```json
{
  "dependencies": {
    "effect": "^3.17.13",           // Core Effect library
    "@effect/platform": "^0.90.8",  // Platform abstractions
    "@effect/schema": "^0.75.5"     // Schema validation
  },
  "devDependencies": {
    "@effect/vitest": "^0.25.1",   // Testing integration
    "@effect/test": "^0.1.0"       // Additional test utilities
  }
}
```

### Key Effect-TS Features Used

- **Effect**: Composable, type-safe async operations
- **Layer**: Dependency injection and service composition
- **Context**: Type-safe dependency resolution
- **Schema**: Runtime type validation and parsing
- **Match**: Pattern matching for control flow
- **Data**: Immutable data structures with equality
- **Ref**: Mutable references in controlled contexts
- **Queue**: Type-safe message passing
- **Stream**: Reactive data processing

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for:

- Development setup and workflow
- Code standards and patterns
- Testing requirements
- Pull request process

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes following our guidelines
5. Run tests: `pnpm test`
6. Submit a pull request

## Resources

### Documentation

- [Architecture Guide](./ARCHITECTURE.md) - Detailed system architecture
- [Contributing Guide](./CONTRIBUTING.md) - Development guidelines  
- [DDD Principles](./docs/ddd-principles.md) - Domain-driven design patterns
- [Effect-TS Patterns](./docs/effect-ts-patterns.md) - Best practices
- [Migration Guide](./docs/migration-guide.md) - Upgrade and migration info

### External Resources

- [Effect-TS Documentation](https://effect.website/) - Official Effect-TS docs
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) - DDD overview
- [Three.js Documentation](https://threejs.org/docs/) - 3D rendering library
- [Vite Documentation](https://vitejs.dev/) - Build tool and dev server

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- **Effect-TS Team** - For creating an amazing functional programming library
- **Three.js Community** - For the powerful 3D rendering engine
- **TypeScript Team** - For the robust type system
- **DDD Community** - For domain-driven design principles and patterns

---

**Note**: This project serves as a demonstration of advanced TypeScript patterns, functional programming concepts, and domain-driven design principles. It showcases how complex systems can be built using pure functional programming while maintaining performance and maintainability.