# TypeScript Minecraft DDD Migration Execution Plan v4

## Executive Summary
This execution plan addresses comprehensive refactoring of the TypeScript Minecraft codebase to achieve:
- Full DDD architecture compliance
- Complete functional programming paradigm (class elimination)
- Effect-TS strict type safety
- Path alias adoption
- Clean barrel exports
- Dead code elimination
- Consistent naming conventions

## Critical Issues Identified

### 1. Architecture Violations
- **180+ class declarations** across all layers
- **Mixed paradigms**: OOP classes mixed with Effect-TS functional patterns
- **Inconsistent barrel exports**: Some using `export *`, others using named exports
- **Path aliases configured but unused**: `@domain/*`, `@application/*`, etc. not utilized
- **Naming convention violations**: Files not following `.vo.ts`, `.entity.ts`, `.service.ts` patterns consistently

### 2. Code Quality Issues
- **Dead code**: Multiple unused exports and re-exports
- **Circular dependencies risk**: Through broad `export *` patterns
- **Type safety gaps**: Not fully leveraging Effect-TS type system
- **Mutable state in classes**: Presentation layer classes with private mutable fields

## Migration Strategy

### Phase Organization
The migration will be executed in **5 parallel tracks** by independent sub-agents to maximize efficiency:

```
Track 1: Domain Layer Pure Functional Migration
Track 2: Application Layer Effect-TS Compliance  
Track 3: Infrastructure Adapter Pattern Cleanup
Track 4: Presentation Layer State Management
Track 5: Cross-Cutting Concerns (Shared/Config)
```

---

## Track 1: Domain Layer Pure Functional Migration
**Agent Type**: general-purpose
**Priority**: CRITICAL
**Estimated Duration**: 8-10 hours

### Objectives
- Eliminate all classes in domain layer
- Convert to pure functional programming
- Implement proper Effect-TS patterns
- Fix naming conventions

### Tasks

#### 1.1 Value Objects Migration
```typescript
// Files to migrate:
src/domain/value-objects/**/*.vo.ts

// Pattern transformation:
// FROM: export class ValidationChain<T>
// TO: export const createValidationChain = <T>() => Effect.gen(function* () { ... })
```

#### 1.2 Entity Refactoring
```typescript
// Files to migrate:
src/domain/entities/*.entity.ts

// Key migrations:
- world.entity.ts: Remove WorldState class → functional state management
- entity.entity.ts: Class-based entities → functional factories
- player.entity.ts: Mutable player state → immutable Effect-based state
- chunk.entity.ts: Class methods → pure functions
- block.entity.ts: OOP patterns → functional composition
```

#### 1.3 Service Layer Transformation
```typescript
// Critical services requiring migration (30+ files):
src/domain/services/**/*.service.ts

// Priority services:
1. TerrainGenerationDomainService (class with 200+ lines)
2. MeshGenerationDomainService (complex class hierarchy)
3. PhysicsDomainService (mutable state management)
4. EntityDomainService (Context.Tag pattern needs cleanup)
5. WorldManagementDomainService (heavy class usage)

// Pattern:
// FROM: export class ServiceName { methods() {} }
// TO: export const serviceName = { methods: Effect.gen(function* () {}) }
```

#### 1.4 Error System Overhaul
```typescript
// Eliminate error classes:
src/domain/errors/*.ts

// FROM: export class EntityNotFoundError extends DomainError
// TO: export const EntityNotFoundError = Schema.TaggedError("EntityNotFoundError")({ ... })
```

#### 1.5 Port Definitions Cleanup
```typescript
// Update all ports to functional interfaces:
src/domain/ports/*.port.ts

// Ensure Context.GenericTag usage is consistent
// Remove class-based port definitions
```

### Deliverables
- [ ] All domain classes eliminated
- [ ] Pure functional value objects
- [ ] Immutable entity factories
- [ ] Effect-based service layer
- [ ] Schema-based error definitions
- [ ] Clean port interfaces

---

## Track 2: Application Layer Effect-TS Compliance
**Agent Type**: general-purpose
**Priority**: HIGH
**Estimated Duration**: 6-8 hours

### Objectives
- Remove query system classes
- Implement Effect-TS patterns throughout
- Clean up use cases and workflows
- Fix barrel exports

### Tasks

#### 2.1 Query System Overhaul
```typescript
// Eliminate classes in query system:
src/application/queries/*.ts

// Critical migrations:
1. UnifiedQuery class → functional query builder
2. ArchetypeManager class → Effect-based state management
3. QueryProfiler class → functional profiling utilities
4. QueryBuilder classes → pipe-based composition
```

#### 2.2 Use Case Migration
```typescript
// Convert Context.Tag classes to proper Effect patterns:
src/application/use-cases/*.use-case.ts

// FROM: export class PlayerMoveUseCase extends Context.Tag
// TO: export const PlayerMoveUseCase = Context.GenericTag<...>()
```

#### 2.3 Workflow Refactoring
```typescript
// Migrate workflow classes:
src/application/workflows/*.ts

// UIUpdateWorkflow, WorldUpdateWorkflow → functional workflows
// SchedulerError class → Schema.TaggedError
```

#### 2.4 Command & Handler Cleanup
```typescript
// Update handlers to functional patterns:
src/application/handlers/*.ts
src/application/commands/*.ts

// Remove class-based handlers
// Implement Effect-based command processing
```

### Deliverables
- [ ] Functional query system
- [ ] Effect-based use cases
- [ ] Pure functional workflows
- [ ] Clean command handlers
- [ ] Proper barrel exports in index.ts

---

## Track 3: Infrastructure Adapter Pattern Cleanup
**Agent Type**: general-purpose
**Priority**: MEDIUM
**Estimated Duration**: 8-10 hours

### Objectives
- Standardize adapter implementations
- Remove infrastructure classes
- Implement proper repository patterns
- Clean up worker management

### Tasks

#### 3.1 Adapter Standardization
```typescript
// Migrate all adapters to functional pattern:
src/infrastructure/adapters/*.adapter.ts

// Priority adapters (15+ files):
1. TerrainGeneratorAdapter (class with infrastructure dependencies)
2. MeshGeneratorAdapter (complex class)
3. SpatialGridAdapter (mutable state)
4. MaterialManagerAdapter (class-based)
5. Three.js adapters (multiple classes)
```

#### 3.2 Repository Pattern Implementation
```typescript
// Convert repository classes:
src/infrastructure/repositories/*.repository.ts

// FROM: export class EntityRepositoryImpl
// TO: export const createEntityRepository = () => Effect.gen(function* () {})

// Critical repositories:
- EntityRepository
- ChunkRepository
- WorldRepository
```

#### 3.3 Worker System Refactoring
```typescript
// Eliminate worker classes:
src/infrastructure/workers/**/*.ts

// WorkerError, WorkerTimeoutError → Schema errors
// Worker pool classes → functional worker management
```

#### 3.4 Performance Layer Cleanup
```typescript
// Migrate performance utilities:
src/infrastructure/performance/*.layer.ts

// Classes to eliminate:
- LRUCache
- PooledVector3, PooledMatrix4, PooledAABB
- Error classes → Schema.TaggedError
```

### Deliverables
- [ ] Functional adapters
- [ ] Effect-based repositories
- [ ] Clean worker management
- [ ] Performance utilities refactored
- [ ] Proper error handling

---

## Track 4: Presentation Layer State Management
**Agent Type**: general-purpose
**Priority**: MEDIUM
**Estimated Duration**: 6-8 hours

### Objectives
- Eliminate all UI classes
- Implement functional state management
- Clean up view models and controllers

### Tasks

#### 4.1 CLI Tools Migration
```typescript
// Convert all CLI classes to functional modules:
src/presentation/cli/*.ts

// Classes to eliminate (11 files):
- StateDebugger
- HotReloadManager
- ProfilingUI
- NetworkInspector
- GameDebugger
- CommandPalette
- EntityInspector
- PerformanceProfiler
- DevConsole
- WorldEditor
- DevToolsManager

// Pattern:
// FROM: export class DevConsole { private isOpen: boolean }
// TO: export const createDevConsole = () => Ref.make(initialState).pipe(...)
```

#### 4.2 View Model Refactoring
```typescript
// Update view models:
src/presentation/view-models/*.vm.ts

// Convert Context.GenericTag patterns to functional
// Implement proper Effect-based state management
```

#### 4.3 Controller Migration
```typescript
// Refactor controllers:
src/presentation/controllers/*.controller.ts

// Remove Context.Tag class extension
// Implement functional controller factories
```

### Deliverables
- [ ] Functional CLI tools
- [ ] Effect-based view models
- [ ] Clean controller implementations
- [ ] Proper state management

---

## Track 5: Cross-Cutting Concerns
**Agent Type**: general-purpose
**Priority**: LOW
**Estimated Duration**: 4-6 hours

### Objectives
- Clean up shared utilities
- Implement path aliases
- Fix barrel exports
- Remove dead code

### Tasks

#### 5.1 Shared Utilities Cleanup
```typescript
// Migrate shared classes:
src/shared/utils/*.ts

// Classes to eliminate:
- ValidationChain
- CircuitBreaker
- MonitoringState
- LoggerState
```

#### 5.2 Path Alias Implementation
```typescript
// Update all imports to use configured aliases:
// FROM: import { ... } from '../../../domain/services'
// TO: import { ... } from '@domain/services'

// Aliases to implement:
- @domain/*
- @application/*
- @infrastructure/*
- @presentation/*
- @shared/*
- @config/*
```

#### 5.3 Barrel Export Standardization
```typescript
// Standardize all index.ts files:
// - Use named exports only
// - No export * patterns
// - Group related exports
// - Add proper type exports
```

#### 5.4 Dead Code Elimination
```typescript
// Remove identified dead code:
- Unused exports in *-exports.ts files
- Redundant re-exports
- Orphaned utility functions
- Deprecated service implementations
```

### Deliverables
- [ ] Clean shared utilities
- [ ] Path aliases implemented
- [ ] Standardized barrel exports
- [ ] Dead code removed

---

## Implementation Guidelines

### For Each Sub-Agent

1. **Start with Effect-TS patterns**:
```typescript
import { Effect, Context, Layer, Schema, Ref, pipe } from 'effect'
```

2. **Naming Conventions**:
- Value Objects: `*.vo.ts`
- Entities: `*.entity.ts`
- Services: `*.service.ts`
- Repositories: `*.repository.ts`
- Adapters: `*.adapter.ts`
- Ports: `*.port.ts`
- Use Cases: `*.use-case.ts`

3. **Functional Patterns**:
```typescript
// Service pattern
export const serviceName = {
  method: (params: Params) => Effect.gen(function* () {
    // implementation
  })
}

// Repository pattern
export const createRepository = () => Effect.gen(function* () {
  const stateRef = yield* Ref.make(initialState)
  return {
    find: (id: Id) => Ref.get(stateRef).pipe(...)
  }
})

// Error pattern
export const ErrorName = Schema.TaggedError("ErrorName")({
  message: Schema.String,
  // other fields
})
```

4. **Barrel Exports**:
```typescript
// index.ts pattern
export { specificExport1 } from './module1'
export { specificExport2 } from './module2'
export type { Type1, Type2 } from './types'
```

---

## Validation Criteria

### Each track must ensure:
1. ✅ Zero classes remaining in assigned layer
2. ✅ All imports use path aliases
3. ✅ Proper Effect-TS type safety
4. ✅ Clean barrel exports (no export *)
5. ✅ Consistent file naming
6. ✅ No circular dependencies
7. ✅ All tests passing

---

## Risk Mitigation

### Potential Issues:
1. **Breaking changes in public API** → Maintain compatibility layer during migration
2. **Test failures** → Update tests incrementally with each change
3. **Performance degradation** → Profile critical paths before/after
4. **Type inference issues** → Use explicit type annotations where needed

---

## Success Metrics

### Quantitative:
- 0 classes in codebase
- 100% path alias adoption
- 0 export * statements
- 0 unused exports
- 100% Effect-TS pattern compliance

### Qualitative:
- Clean DDD layer separation
- Consistent functional programming
- Improved type safety
- Better code organization
- Enhanced maintainability

---

## Execution Timeline

```
Day 1-2: Track 1 (Domain Layer) + Track 5 (Cross-cutting)
Day 2-3: Track 2 (Application Layer) + Track 3 (Infrastructure Layer)
Day 3-4: Track 4 (Presentation Layer) + Integration Testing
Day 4-5: Final validation, cleanup, and documentation
```

---

## Post-Migration Checklist

- [ ] All classes eliminated
- [ ] Effect-TS patterns throughout
- [ ] Path aliases working
- [ ] Barrel exports cleaned
- [ ] Tests passing
- [ ] Performance validated
- [ ] Documentation updated
- [ ] Git commits organized

---

## Notes for Sub-Agents

1. **Communicate conflicts**: If changes overlap between tracks, coordinate
2. **Test incrementally**: Run tests after each major change
3. **Document patterns**: Update inline documentation for new patterns
4. **Preserve functionality**: Ensure no breaking changes to external API
5. **Performance first**: Profile critical paths if concerned about performance

This plan is designed for parallel execution. Each track can be assigned to a different sub-agent for maximum efficiency.