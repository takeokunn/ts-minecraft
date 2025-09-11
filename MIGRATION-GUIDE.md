# TypeScript Minecraft 2.0 Migration Guide

## 📋 Overview

This guide provides step-by-step instructions for migrating from TypeScript Minecraft 1.x to 2.0. The migration involves significant architectural changes, including directory restructuring, Effect-TS pattern adoption, and new error handling systems.

## 🚨 Breaking Changes Summary

### 1. Directory Structure Migration
- `src/domain` → `src/core` (complete migration)
- New module organization with clear separation of concerns
- Enhanced component and service architecture

### 2. Effect-TS Integration
- Full adoption of Effect-TS Context.Tag pattern
- Layer-based service composition
- Schema integration with effect/Schema

### 3. Error Handling System
- New typed error system
- Domain-specific error categories
- Structured error recovery patterns

### 4. Worker System Overhaul
- Typed worker protocol implementation
- Protocol-based message passing
- Enhanced worker communication

## 🛠️ Migration Steps

### Step 1: Automated Import Migration

#### Using Provided Migration Scripts
```bash
# Make scripts executable
chmod +x ./migrate-imports-complete.sh

# Run complete migration
./migrate-imports-complete.sh

# Verify changes
git status
```

#### Manual Import Updates
If automated migration fails, update imports manually:

```typescript
// OLD (1.x)
import { Entity } from '../domain/entity'
import { Block } from '../domain/block'
import { Coordinates } from '../domain/values/coordinates'
import { EntityId } from '../domain/values/entity-id'

// NEW (2.0)
import { Entity } from '../core/entities/entity'
import { Block } from '../core/entities/block'
import { Coordinates } from '../core/values/coordinates' 
import { EntityId } from '../core/values/entity-id'
```

### Step 2: Schema Migration

#### Effect Schema Import Update
```typescript
// OLD
import * as S from '@effect/schema/Schema'

// NEW  
import * as S from 'effect/Schema'
```

#### Schema Definition Pattern
```typescript
// OLD
const UserSchema = S.struct({
  id: S.string,
  name: S.string
})

// NEW
const UserSchema = S.Struct({
  id: S.String,
  name: S.String
})
```

### Step 3: Error Handling Migration

#### New Error System Usage
```typescript
// OLD
throw new Error('Component not found')

// NEW
import { ComponentError } from '../core/errors/component-errors'

// In Effect context
Effect.fail(ComponentError.NotFound({ componentId: 'example' }))

// Traditional context
throw ComponentError.NotFound({ componentId: 'example' })
```

#### Error Categories
```typescript
import {
  ComponentError,
  EntityError,  
  PhysicsError,
  WorldError,
  WorkerError
} from '../core/errors'

// Usage examples
ComponentError.ValidationFailed({ reason: 'Invalid schema' })
EntityError.NotFound({ entityId: 'player-1' })
PhysicsError.CollisionDetectionFailed({ details: 'Boundary overflow' })
WorldError.ChunkLoadingFailed({ chunkId: '0,0' })
WorkerError.CommunicationTimeout({ workerId: 'terrain-worker' })
```

### Step 4: Component System Migration

#### Component Registration
```typescript
// OLD
const components = {
  position: PositionComponent,
  velocity: VelocityComponent
}

// NEW
import { ComponentRegistry } from '../core/components/registry'

const registry = ComponentRegistry.create()
  .register('position', PositionComponent)
  .register('velocity', VelocityComponent)
```

#### Component Definition with Schema
```typescript
// NEW Component Pattern
import * as S from 'effect/Schema'

export const PositionComponentSchema = S.Struct({
  x: S.Number,
  y: S.Number, 
  z: S.Number
})

export type PositionComponent = S.Schema.Type<typeof PositionComponentSchema>

export const PositionComponent = {
  schema: PositionComponentSchema,
  create: (x: number, y: number, z: number): PositionComponent => ({ x, y, z }),
  validate: S.decodeUnknownSync(PositionComponentSchema)
}
```

### Step 5: Service Layer Migration

#### Context.Tag Pattern
```typescript
// OLD
class WorldService {
  constructor(private spatialGrid: SpatialGrid) {}
}

// NEW
import { Context, Layer } from 'effect'

class WorldService extends Context.Tag('WorldService')<
  WorldService,
  {
    getChunk: (coords: ChunkCoordinates) => Effect.Effect<Chunk, WorldError>
    updateChunk: (chunk: Chunk) => Effect.Effect<void, WorldError>
  }
>() {}

// Service Implementation
const WorldServiceLive = Layer.succeed(
  WorldService,
  WorldService.of({
    getChunk: (coords) => /* implementation */,
    updateChunk: (chunk) => /* implementation */
  })
)
```

#### Layer Composition
```typescript
// Service layer setup
const ServiceLayer = Layer.mergeAll(
  WorldServiceLive,
  SpatialGridServiceLive,
  PhysicsServiceLive
)

// Usage in application
const program = Effect.gen(function* () {
  const worldService = yield* WorldService
  const chunk = yield* worldService.getChunk(coordinates)
  // ... rest of program
}).pipe(Effect.provide(ServiceLayer))
```

### Step 6: Worker System Migration

#### Typed Worker Protocol
```typescript
// OLD
worker.postMessage({ type: 'GENERATE_TERRAIN', data: chunkData })

// NEW
import { WorkerProtocol } from '../workers/base/protocol'

const terrainWorker = WorkerProtocol.create<TerrainWorkerMessages>()

terrainWorker.send({
  type: 'GENERATE_TERRAIN',
  payload: {
    chunkCoordinates: { x: 0, z: 0 },
    seed: 12345,
    biome: 'plains'
  }
})
```

#### Worker Message Types
```typescript
// Define message schema
export const TerrainWorkerMessages = S.Union(
  S.Struct({
    type: S.Literal('GENERATE_TERRAIN'),
    payload: S.Struct({
      chunkCoordinates: CoordinatesSchema,
      seed: S.Number,
      biome: S.String
    })
  }),
  S.Struct({
    type: S.Literal('TERRAIN_GENERATED'), 
    payload: S.Struct({
      chunkData: ChunkDataSchema,
      meshData: MeshDataSchema
    })
  })
)
```

### Step 7: Testing Updates

#### Test Utility Migration
```typescript
// OLD
import { createTestWorld } from '../test-utils'

// NEW
import { TestHarness, WorldFixtures } from '../test-utils'

const testHarness = TestHarness.create()
const world = WorldFixtures.createEmptyWorld()
```

#### Property-Based Testing
```typescript
// Enhanced arbitraries usage
import { ArbitraryGenerators } from '../test-utils/arbitraries'

fc.test('entity system test', 
  ArbitraryGenerators.entity(),
  ArbitraryGenerators.components(),
  (entity, components) => {
    // Test logic
  }
)
```

## 📋 Migration Checklist

### Phase 1: Basic Migration
- [ ] Run automated migration scripts
- [ ] Update all import paths (domain → core)
- [ ] Fix Schema import statements
- [ ] Update package.json dependencies
- [ ] Verify basic compilation

### Phase 2: Error System
- [ ] Replace Error throwing with typed errors
- [ ] Update error handling patterns
- [ ] Implement error recovery strategies
- [ ] Update test assertions

### Phase 3: Component System
- [ ] Migrate component definitions
- [ ] Update component registrations
- [ ] Add schema validation
- [ ] Update component usage patterns

### Phase 4: Services & Workers
- [ ] Migrate to Context.Tag pattern
- [ ] Update service layer composition
- [ ] Implement typed worker protocol
- [ ] Update worker message handling

### Phase 5: Testing & Validation
- [ ] Update test utilities usage
- [ ] Migrate to new test patterns
- [ ] Verify all tests pass
- [ ] Performance regression testing

## 🔧 Common Migration Issues

### Issue 1: Schema Import Errors
**Problem**: `Cannot find module '@effect/schema/Schema'`
**Solution**: Update to `import * as S from 'effect/Schema'`

### Issue 2: Component Type Errors  
**Problem**: Component validation failures
**Solution**: Ensure all components have proper schema definitions

### Issue 3: Service Injection Errors
**Problem**: Context.Tag not found
**Solution**: Verify service layers are properly composed and provided

### Issue 4: Worker Communication Errors
**Problem**: Worker message validation failures  
**Solution**: Update message types to use new protocol system

## 📊 Migration Validation

### Automated Checks
```bash
# Type checking
pnpm run tsc

# Linting
pnpm run lint

# Testing  
pnpm run test

# Build verification
pnpm run build:production

# Bundle analysis
pnpm run analyze:bundle
```

### Manual Verification
1. **Import Resolution**: All imports resolve correctly
2. **Type Safety**: No `any` types remain
3. **Schema Validation**: All data structures validate properly
4. **Error Handling**: Errors are properly typed and handled
5. **Service Injection**: All services inject correctly
6. **Worker Communication**: Workers communicate using typed protocol

## 📚 Resources

### Documentation
- [Architecture Guide](./docs/architecture.md)
- [Effect-TS Patterns](./docs/effect-ts-patterns.md)
- [Component System](./docs/components-list.md)
- [Testing Strategy](./docs/testing-strategy.md)

### Example Code
- Component Examples: `src/core/components/example-usage.ts`
- Service Patterns: `src/services/layers/`
- Worker Protocol: `src/workers/base/protocol.ts`
- Test Patterns: `src/test-utils/examples/`

### Migration Scripts
- Complete Migration: `migrate-imports-complete.sh`
- Simple Migration: `migrate-imports-simple.sh`  
- Fixed Migration: `migrate-imports-fixed.sh`

## 🆘 Troubleshooting

### Getting Help
1. Check compilation errors first with `pnpm run tsc`
2. Review the [Known Issues](./RELEASE-NOTES.md#-known-issues) section
3. Refer to example implementations in the codebase
4. Use migration scripts for automated fixes where possible

### Common Commands
```bash
# Clean build
pnpm run clear-cache && pnpm run build

# Full validation
pnpm run ci:validate

# Dependency analysis
pnpm run analyze:deps

# Security check
pnpm run security:audit
```

## ✅ Post-Migration Testing

### Functional Testing
- [ ] Game world loads correctly
- [ ] Player movement works
- [ ] Block interaction functions
- [ ] Chunk loading operates properly
- [ ] Performance metrics are acceptable

### Technical Validation  
- [ ] All TypeScript strict checks pass
- [ ] No circular dependencies detected
- [ ] Bundle size within targets
- [ ] Memory usage within limits
- [ ] Test coverage maintains 95%+

---

**Migration Support**: For additional help with migration, refer to the comprehensive examples throughout the codebase and the enhanced documentation suite.