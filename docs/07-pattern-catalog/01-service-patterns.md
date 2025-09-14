---
title: "サービスパターン - Effect-TS 最新実装パターン (Context.Tag + Layer.effect)"
description: "Context.Tag、Layer.effect、Schedule-based retries、Effect.Serviceを活用したモダンなサービス層実装の完全ガイド。DI、エラーハンドリング、テスト戦略を含む。"
category: "reference"
difficulty: "advanced"
tags: ["service-patterns", "context-tag", "layer-effect", "effect-service", "schedule-retry", "dependency-injection", "error-handling", "testing"]
prerequisites: ["effect-ts-fundamentals", "context-usage", "schema-basics"]
estimated_reading_time: "20分"
related_patterns: ["error-handling-patterns", "data-modeling-patterns", "test-patterns"]
related_docs: ["../../01-architecture/06-effect-ts-patterns.md", "../examples/01-basic-usage/01-simple-block-placement.md"]
---

# Service Implementation Patterns

## Pattern 1: Basic Service with Schema Validation
**使用場面**: 単純な状態を持たないサービス

**実装**:
```typescript
import { Context, Effect, Layer, Schema, Schedule, pipe } from "effect"

// Branded types for type safety
const ProcessInput = Schema.String.pipe(Schema.brand("ProcessInput"))
const ProcessOutput = Schema.String.pipe(Schema.brand("ProcessOutput"))
type ProcessInput = Schema.Schema.Type<typeof ProcessInput>
type ProcessOutput = Schema.Schema.Type<typeof ProcessOutput>

// Domain error with schema validation
export class ProcessingError extends Schema.TaggedError<ProcessingError>()("ProcessingError", {
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// Service interface
export interface BasicService {
  readonly process: (input: ProcessInput) => Effect.Effect<ProcessOutput, ProcessingError>
}

// Context tag
export const BasicService = Context.Tag<BasicService>("@minecraft/BasicService")

// Implementation using early return pattern with retry strategy
const makeBasicService: Effect.Effect<BasicService, never, never> =
  Effect.succeed({
    process: (input) => pipe(
      Schema.decodeUnknown(ProcessInput)(input),
      Effect.mapError(() => new ProcessingError({
        operation: "process",
        reason: "Invalid input format",
        timestamp: Date.now()
      })),
      Effect.map(validInput => validInput.toUpperCase() as ProcessOutput),
      // 外部API呼び出しがある場合のリトライ戦略
      Effect.retry(
        Schedule.exponential("100 millis").pipe(
          Schedule.compose(Schedule.recurs(3)),
          Schedule.intersect(Schedule.spaced("5 seconds"))
        )
      )
    )
  })

// Alternative: Effect.Service pattern (recommended for modern Effect-TS)
export class BasicServiceImpl extends Effect.Service<BasicServiceImpl>()(
  "@minecraft/BasicService", {
    effect: makeBasicService
  }
) {}

// Layer for dependency injection
export const BasicServiceLive = Layer.effect(BasicService, makeBasicService)
```

## Pattern 2: Stateful Service with Resource Management
**使用場面**: 内部状態を管理する必要がある場合

**実装**:
```typescript
import { Context, Effect, Layer, Schema, Ref, Match, pipe } from "effect"

// Branded counter type
const Counter = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("Counter")
)
type Counter = Schema.Schema.Type<typeof Counter>

// State operations type
type CounterOperation =
  | { readonly _tag: "increment" }
  | { readonly _tag: "reset" }
  | { readonly _tag: "get" }

// Service interface
export interface StatefulService {
  readonly increment: () => Effect.Effect<Counter, never>
  readonly reset: () => Effect.Effect<void, never>
  readonly get: () => Effect.Effect<Counter, never>
}

export const StatefulService = Context.Tag<StatefulService>("@minecraft/StatefulService")

// Implementation with resource management and pattern matching
const makeStatefulService: Effect.Effect<StatefulService, never, never> =
  Effect.gen(function* () {
    const counter = yield* Ref.make(0 as Counter)

    const executeOperation = (operation: CounterOperation) =>
      Match.value(operation).pipe(
        Match.when({ _tag: "increment" }, () =>
          Ref.updateAndGet(counter, (n) => (n + 1) as Counter)
        ),
        Match.when({ _tag: "reset" }, () =>
          Ref.set(counter, 0 as Counter)
        ),
        Match.when({ _tag: "get" }, () =>
          Ref.get(counter)
        ),
        Match.exhaustive
      )

    return {
      increment: () => executeOperation({ _tag: "increment" }),
      reset: () => executeOperation({ _tag: "reset" }).pipe(Effect.asVoid),
      get: () => executeOperation({ _tag: "get" })
    }
  })

export const StatefulServiceLive = Layer.effect(StatefulService, makeStatefulService)
```

## Pattern 3: Service with Dependencies and Effect Layers
**使用場面**: 他のサービスに依存する場合

**実装**:
```typescript
import { Context, Effect, Layer, Schema, Logger, Match, pipe } from "effect"

// Input validation schema
const ComplexProcessInput = Schema.Struct({
  data: Schema.String.pipe(Schema.minLength(1)),
  priority: Schema.Union(
    Schema.Literal("high"),
    Schema.Literal("medium"),
    Schema.Literal("low")
  )
})
type ComplexProcessInput = Schema.Schema.Type<typeof ComplexProcessInput>

// Output schema
const ComplexProcessOutput = Schema.Struct({
  result: Schema.String,
  processedAt: Schema.Number,
  priority: Schema.String
})
type ComplexProcessOutput = Schema.Schema.Type<typeof ComplexProcessOutput>

// Enhanced error handling
export class ComplexProcessingError extends Schema.TaggedError<ComplexProcessingError>()("ComplexProcessingError", {
  operation: Schema.String,
  input: Schema.Unknown,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// Service interface
export interface ComplexService {
  readonly complexProcess: (input: ComplexProcessInput) => Effect.Effect<ComplexProcessOutput, ComplexProcessingError>
}

export const ComplexService = Context.Tag<ComplexService>("@minecraft/ComplexService")

// Implementation with dependency injection and pattern matching
const makeComplexService = Effect.gen(function* () {
  const basicService = yield* BasicService
  const logger = yield* Logger.Logger

  const processWithPriority = (input: ComplexProcessInput) =>
    Match.value(input.priority).pipe(
      Match.when("high", () =>
        pipe(
          basicService.process(input.data as ProcessInput),
          Effect.tap(() => logger.info(`High priority processing: ${input.data}`)),
          Effect.map(result => `URGENT: ${result}`)
        )
      ),
      Match.when("medium", () =>
        pipe(
          basicService.process(input.data as ProcessInput),
          Effect.tap(() => logger.info(`Medium priority processing: ${input.data}`)),
          Effect.map(result => `NORMAL: ${result}`)
        )
      ),
      Match.when("low", () =>
        pipe(
          basicService.process(input.data as ProcessInput),
          Effect.tap(() => logger.debug(`Low priority processing: ${input.data}`)),
          Effect.map(result => `DEFERRED: ${result}`)
        )
      ),
      Match.exhaustive
    )

  return {
    complexProcess: (input) =>
      pipe(
        Schema.decodeUnknown(ComplexProcessInput)(input),
        Effect.mapError(parseError =>
          new ComplexProcessingError({
            operation: "complexProcess",
            input,
            reason: `Schema validation failed: ${parseError.message}`,
            timestamp: Date.now()
          })
        ),
        Effect.flatMap(processWithPriority),
        Effect.map(result => ({
          result,
          processedAt: Date.now(),
          priority: input.priority
        } as ComplexProcessOutput)),
        Effect.mapError(error =>
          error instanceof ComplexProcessingError ? error :
          new ComplexProcessingError({
            operation: "complexProcess",
            input,
            reason: `Processing failed: ${error}`,
            timestamp: Date.now()
          })
        )
      )
  }
})

// Layer composition with dependencies
export const ComplexServiceLive = Layer.effect(ComplexService, makeComplexService).pipe(
  Layer.provide(BasicServiceLive),
  Layer.provide(Logger.layer)
)
```

## Pattern 4: Caching Service with TTL and Effect Resource Management
**使用場面**: 高価な計算結果をキャッシュする場合

**実装**:
```typescript
import { Context, Effect, Layer, Schema, Ref, Duration, Match, Option, pipe } from "effect"

// Cache key and value types with branding
const CacheKey = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("CacheKey")
)
type CacheKey = Schema.Schema.Type<typeof CacheKey>

const CacheValue = Schema.String.pipe(Schema.brand("CacheValue"))
type CacheValue = Schema.Schema.Type<typeof CacheValue>

// Cache entry with TTL
const CacheEntry = Schema.Struct({
  value: CacheValue,
  expiresAt: Schema.Number,
  createdAt: Schema.Number
})
type CacheEntry = Schema.Schema.Type<typeof CacheEntry>

// Cache configuration
const CacheConfig = Schema.Struct({
  ttlMs: Schema.Number.pipe(Schema.positive()),
  maxSize: Schema.Number.pipe(Schema.positive())
})
type CacheConfig = Schema.Schema.Type<typeof CacheConfig>

// Domain error
export class ComputationError extends Schema.TaggedError<ComputationError>()("ComputationError", {
  key: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// Service interface
export interface CachingService {
  readonly expensiveOperation: (key: CacheKey) => Effect.Effect<CacheValue, ComputationError>
  readonly invalidateKey: (key: CacheKey) => Effect.Effect<void, never>
  readonly clearCache: () => Effect.Effect<void, never>
  readonly getCacheStats: () => Effect.Effect<{ size: number; hitRate: number }, never>
}

export const CachingService = Context.Tag<CachingService>("@minecraft/CachingService")

// Configuration tag
export const CachingConfig = Context.Tag<CacheConfig>("@minecraft/CachingConfig")

// Implementation with resource management and guard clauses
const makeCachingService = Effect.gen(function* () {
  const config = yield* CachingConfig
  const cache = yield* Ref.make(new Map<CacheKey, CacheEntry>())
  const stats = yield* Ref.make({ hits: 0, misses: 0 })

  const isExpired = (entry: CacheEntry, now: number): boolean =>
    entry.expiresAt < now

  const evictExpiredEntries = (cacheMap: Map<CacheKey, CacheEntry>, now: number): Map<CacheKey, CacheEntry> => {
    const filtered = new Map<CacheKey, CacheEntry>()
    for (const [key, entry] of cacheMap.entries()) {
      if (!isExpired(entry, now)) {
        filtered.set(key, entry)
      }
    }
    return filtered
  }

  const expensiveComputation = (key: CacheKey): Effect.Effect<CacheValue, ComputationError> =>
    pipe(
      Effect.sleep(Duration.millis(1000)), // Simulate expensive operation
      Effect.as(`computed-${key}` as CacheValue),
      Effect.mapError(() => new ComputationError({
        key,
        reason: "Computation failed",
        timestamp: Date.now()
      }))
    )

  const getCachedValue = (key: CacheKey): Effect.Effect<Option.Option<CacheValue>, never> =>
    Effect.gen(function* () {
      const now = Date.now()
      const currentCache = yield* Ref.get(cache)

      // Early return for cache miss
      if (!currentCache.has(key)) {
        yield* Ref.update(stats, s => ({ ...s, misses: s.misses + 1 }))
        return Option.none()
      }

      const entry = currentCache.get(key)!

      // Early return for expired entry
      if (isExpired(entry, now)) {
        yield* Ref.update(cache, c => {
          const newCache = new Map(c)
          newCache.delete(key)
          return newCache
        })
        yield* Ref.update(stats, s => ({ ...s, misses: s.misses + 1 }))
        return Option.none()
      }

      yield* Ref.update(stats, s => ({ ...s, hits: s.hits + 1 }))
      return Option.some(entry.value)
    })

  const setCachedValue = (key: CacheKey, value: CacheValue): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const now = Date.now()
      const entry: CacheEntry = {
        value,
        expiresAt: now + config.ttlMs,
        createdAt: now
      }

      yield* Ref.update(cache, currentCache => {
        const cleaned = evictExpiredEntries(currentCache, now)

        // Evict oldest entry if cache is full
        if (cleaned.size >= config.maxSize) {
          const oldest = Array.from(cleaned.entries())
            .sort(([, a], [, b]) => a.createdAt - b.createdAt)[0]
          if (oldest) {
            cleaned.delete(oldest[0])
          }
        }

        return new Map(cleaned).set(key, entry)
      })
    })

  return {
    expensiveOperation: (key) =>
      pipe(
        getCachedValue(key),
        Effect.flatMap(Option.match({
          onNone: () => pipe(
            expensiveComputation(key),
            Effect.tap(value => setCachedValue(key, value))
          ),
          onSome: (value) => Effect.succeed(value)
        }))
      ),

    invalidateKey: (key) =>
      Ref.update(cache, c => {
        const newCache = new Map(c)
        newCache.delete(key)
        return newCache
      }),

    clearCache: () =>
      pipe(
        Ref.set(cache, new Map()),
        Effect.flatMap(() => Ref.set(stats, { hits: 0, misses: 0 }))
      ),

    getCacheStats: () =>
      Effect.gen(function* () {
        const currentStats = yield* Ref.get(stats)
        const currentCache = yield* Ref.get(cache)
        const total = currentStats.hits + currentStats.misses

        return {
          size: currentCache.size,
          hitRate: total > 0 ? currentStats.hits / total : 0
        }
      })
  }
})

// Default configuration layer
const defaultCacheConfig: CacheConfig = {
  ttlMs: 300000, // 5 minutes
  maxSize: 1000
}

export const CachingConfigLive = Layer.succeed(CachingConfig, defaultCacheConfig)

// Service layer with configuration dependency
export const CachingServiceLive = Layer.effect(CachingService, makeCachingService).pipe(
  Layer.provide(CachingConfigLive)
)
```

## Pattern 5: Resource Management Service with Scoped Resources
**使用場面**: リソースの取得と解放が必要な場合

**実装**:
```typescript
import { Context, Effect, Layer, Schema, Ref, Scope, Match, Duration, pipe } from "effect"

// Resource types with branding
const ResourceId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("ResourceId")
)
type ResourceId = Schema.Schema.Type<typeof ResourceId>

const ResourceData = Schema.String.pipe(Schema.brand("ResourceData"))
type ResourceData = Schema.Schema.Type<typeof ResourceData>

// Resource state tracking
type ResourceState =
  | { readonly _tag: "available" }
  | { readonly _tag: "acquired"; readonly acquiredAt: number; readonly scope: Scope.Scope }
  | { readonly _tag: "released"; readonly releasedAt: number }

// Resource entity with validation
const Resource = Schema.Struct({
  id: ResourceId,
  data: ResourceData,
  createdAt: Schema.Number,
  lastAccessed: Schema.Number
})
type Resource = Schema.Schema.Type<typeof Resource>

// Domain errors
export class ResourceError extends Schema.TaggedError<ResourceError>()("ResourceError", {
  operation: Schema.String,
  resourceId: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// Resource pool configuration
const ResourcePoolConfig = Schema.Struct({
  maxResources: Schema.Number.pipe(Schema.positive()),
  acquireTimeoutMs: Schema.Number.pipe(Schema.positive()),
  idleTimeoutMs: Schema.Number.pipe(Schema.positive())
})
type ResourcePoolConfig = Schema.Schema.Type<typeof ResourcePoolConfig>

// Service interface with scoped resource management
export interface ResourceService {
  readonly acquireResource: (id: ResourceId) => Effect.Effect<Resource, ResourceError, Scope.Scope>
  readonly withResource: <A, E>(id: ResourceId, use: (resource: Resource) => Effect.Effect<A, E>) => Effect.Effect<A, E | ResourceError, Scope.Scope>
  readonly getResourceStatus: (id: ResourceId) => Effect.Effect<ResourceState, ResourceError>
  readonly cleanupIdleResources: () => Effect.Effect<number, never> // Returns count of cleaned up resources
}

export const ResourceService = Context.Tag<ResourceService>("@minecraft/ResourceService")
export const ResourcePoolConfigTag = Context.Tag<ResourcePoolConfig>("@minecraft/ResourcePoolConfig")

// Implementation with proper resource lifecycle management
const makeResourceService = Effect.gen(function* () {
  const config = yield* ResourcePoolConfigTag
  const activeResources = yield* Ref.make(new Map<ResourceId, ResourceState>())
  const resourcePool = yield* Ref.make(new Map<ResourceId, Resource>())

  // Resource state management with pattern matching
  const updateResourceState = (id: ResourceId, newState: ResourceState): Effect.Effect<void, never> =>
    Ref.update(activeResources, resources => new Map(resources).set(id, newState))

  const getResourceState = (id: ResourceId): Effect.Effect<ResourceState, ResourceError> =>
    pipe(
      Ref.get(activeResources),
      Effect.map(resources => resources.get(id)),
      Effect.flatMap(state =>
        state ? Effect.succeed(state) :
        Effect.fail(new ResourceError({
          operation: "getResourceState",
          resourceId: id,
          reason: "Resource not found",
          timestamp: Date.now()
        }))
      )
    )

  // Resource creation with proper error handling
  const createResource = (id: ResourceId): Effect.Effect<Resource, ResourceError> =>
    Effect.gen(function* () {
      const now = Date.now()
      const resource: Resource = {
        id,
        data: `resource-data-${id}` as ResourceData,
        createdAt: now,
        lastAccessed: now
      }

      yield* Ref.update(resourcePool, pool => new Map(pool).set(id, resource))
      return resource
    })

  // Guard clause pattern for resource acquisition validation
  const validateResourceAcquisition = (id: ResourceId): Effect.Effect<void, ResourceError> =>
    Effect.gen(function* () {
      const resources = yield* Ref.get(activeResources)
      const currentState = resources.get(id)

      // Early return for already acquired resource
      if (currentState?._tag === "acquired") {
        return yield* Effect.fail(new ResourceError({
          operation: "acquireResource",
          resourceId: id,
          reason: "Resource is already acquired",
          timestamp: Date.now()
        }))
      }

      // Early return if pool is at capacity
      if (resources.size >= config.maxResources) {
        return yield* Effect.fail(new ResourceError({
          operation: "acquireResource",
          resourceId: id,
          reason: `Resource pool at capacity (${config.maxResources})`,
          timestamp: Date.now()
        }))
      }
    })

  return {
    acquireResource: (id) =>
      Effect.scoped(
        pipe(
          validateResourceAcquisition(id),
          Effect.flatMap(() => {
            const pool = Ref.get(resourcePool)
            return pipe(
              pool,
              Effect.flatMap(resources => {
                const existing = resources.get(id)
                return existing ?
                  Effect.succeed(existing) :
                  createResource(id)
              })
            )
          }),
          Effect.flatMap(resource =>
            Effect.acquireRelease(
              Effect.gen(function* () {
                const scope = yield* Effect.scope
                yield* updateResourceState(id, {
                  _tag: "acquired",
                  acquiredAt: Date.now(),
                  scope
                })
                return resource
              }),
              () => updateResourceState(id, {
                _tag: "released",
                releasedAt: Date.now()
              })
            )
          ),
          Effect.timeout(Duration.millis(config.acquireTimeoutMs)),
          Effect.mapError(error =>
            error instanceof ResourceError ? error :
            new ResourceError({
              operation: "acquireResource",
              resourceId: id,
              reason: `Acquisition timeout or unexpected error: ${error}`,
              timestamp: Date.now()
            })
          )
        )
      ),

    withResource: (id, use) =>
      Effect.scoped(
        pipe(
          ResourceService.acquireResource(id),
          Effect.flatMap(use)
        )
      ),

    getResourceStatus: getResourceState,

    cleanupIdleResources: () =>
      Effect.gen(function* () {
        const now = Date.now()
        const resources = yield* Ref.get(activeResources)
        const pool = yield* Ref.get(resourcePool)

        let cleanedCount = 0
        const cleanedResources = new Map<ResourceId, ResourceState>()
        const cleanedPool = new Map<ResourceId, Resource>()

        for (const [id, state] of resources.entries()) {
          const shouldCleanup = Match.value(state).pipe(
            Match.when({ _tag: "available" }, () => {
              const resource = pool.get(id)
              return resource && (now - resource.lastAccessed) > config.idleTimeoutMs
            }),
            Match.when({ _tag: "released" }, (s) =>
              (now - s.releasedAt) > config.idleTimeoutMs
            ),
            Match.orElse(() => false)
          )

          if (shouldCleanup) {
            cleanedCount++
          } else {
            cleanedResources.set(id, state)
            const resource = pool.get(id)
            if (resource) {
              cleanedPool.set(id, resource)
            }
          }
        }

        yield* Ref.set(activeResources, cleanedResources)
        yield* Ref.set(resourcePool, cleanedPool)

        return cleanedCount
      })
  }
})

// Default configuration
const defaultResourcePoolConfig: ResourcePoolConfig = {
  maxResources: 100,
  acquireTimeoutMs: 5000,
  idleTimeoutMs: 300000 // 5 minutes
}

export const ResourcePoolConfigLive = Layer.succeed(ResourcePoolConfigTag, defaultResourcePoolConfig)

// Service layer with configuration dependency
export const ResourceServiceLive = Layer.effect(ResourceService, makeResourceService).pipe(
  Layer.provide(ResourcePoolConfigLive)
)
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Promise-based Services
```typescript
// Promise を使わない（Effect を使う）
class GameService {
  constructor(private dependencies: Dependencies) {}

  public async processGame(input: GameInput): Promise<GameOutput> {
    try {
      const result = await this.heavyComputation(input)
      return result
    } catch (error) {
      throw new Error(`Processing failed: ${error.message}`)
    }
  }
}
```

### ❌ Anti-Pattern 2: Imperative Error Handling
```typescript
// try-catch を使わない（Effect の combinators を使う）
const badService = async (input: string) => {
  try {
    const result = await someOperation(input)
    if (!result) {
      throw new Error("No result")
    }
    return result.toUpperCase()
  } catch (error) {
    console.error("Error:", error)
    return "ERROR"
  }
}
```

### ❌ Anti-Pattern 3: Deep Nesting and Complex Conditionals
```typescript
// 深いネストと複雑な条件分岐を避ける
const processComplex = (input: ComplexInput) => {
  if (input.type === "A") {
    if (input.priority === "high") {
      if (input.data) {
        if (input.data.length > 0) {
          return processHighPriorityA(input.data)
        } else {
          return Effect.fail(new Error("Empty data"))
        }
      } else {
        return Effect.fail(new Error("No data"))
      }
    } else {
      return processLowPriorityA(input)
    }
  } else {
    return processTypeB(input)
  }
}
```

### ❌ Anti-Pattern 4: Untyped Services
```typescript
// 型安全性のないサービス
const untypedService = {
  process: (input: any) => {
    return Effect.succeed(input?.data?.value || "default")
  }
}
```

### ✅ Modern Effect-TS Patterns

```typescript
// 1. Schema validation for all inputs/outputs
const ProcessInput = Schema.String.pipe(Schema.brand("ProcessInput"))
const ProcessOutput = Schema.String.pipe(Schema.brand("ProcessOutput"))

// 2. Tagged errors with schema validation
class ServiceError extends Schema.TaggedError<ServiceError>()("ServiceError", {
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// 3. Pattern matching instead of if/else
const processWithPattern = (input: ProcessInput) =>
  Match.value(input.priority).pipe(
    Match.when("high", () => processHighPriority(input)),
    Match.when("low", () => processLowPriority(input)),
    Match.exhaustive
  )

// 4. Early return pattern with guard clauses
const validateAndProcess = (input: unknown) =>
  pipe(
    // Early return for invalid input
    Schema.decodeUnknown(ProcessInput)(input),
    Effect.mapError(createValidationError),
    Effect.flatMap(processWithPattern)
  )

// 5. Context.Tag + Layer for dependency injection
const Service = Context.Tag<ServiceInterface>("@namespace/Service")
const ServiceLive = Layer.effect(Service, makeService)
```

## Modern Effect-TS Best Practices

### 1. Service Architecture Patterns
```typescript
// Service interface with branded types
export interface ServiceNameService {
  readonly operation: (input: BrandedInput) => Effect.Effect<BrandedOutput, DomainError>
}

// Context tag
export const ServiceNameService = Context.Tag<ServiceNameService>("@namespace/ServiceNameService")

// Implementation with dependencies
const makeServiceNameService = Effect.gen(function* () {
  const dep1 = yield* Dependency1Service
  const config = yield* ServiceConfig

  return {
    operation: (input) => pipe(
      validateInput(input),
      Effect.flatMap(processWithDependencies(dep1, config))
    )
  }
})

// Layer with dependency composition
export const ServiceNameServiceLive = Layer.effect(ServiceNameService, makeServiceNameService).pipe(
  Layer.provide(Dependency1ServiceLive),
  Layer.provide(ConfigLive)
)
```

### 2. Schema-First Design
```typescript
// Input/Output schemas with branding
const ServiceInput = Schema.Struct({
  data: Schema.String.pipe(Schema.minLength(1)),
  priority: Schema.Union(
    Schema.Literal("high"),
    Schema.Literal("medium"),
    Schema.Literal("low")
  )
}).pipe(Schema.brand("ServiceInput"))

  const ServiceOutput = Schema.Struct({
  result: Schema.String,
  processedAt: Schema.Number,
  metadata: Schema.Record(Schema.String, Schema.Unknown)
}).pipe(Schema.brand("ServiceOutput"))

// Configuration schema
const ServiceConfig = Schema.Struct({
  maxRetries: Schema.Number.pipe(Schema.int(), Schema.positive()),
  timeoutMs: Schema.Number.pipe(Schema.positive()),
  batchSize: Schema.Number.pipe(Schema.int(), Schema.positive())
})
type ServiceConfig = Schema.Schema.Type<typeof ServiceConfig>
```

### 3. Domain Error Modeling
```typescript
// Hierarchical error types with schema validation
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String,
  expectedType: Schema.String,
  actualValue: Schema.Unknown,
  timestamp: Schema.Number
}) {}

export class BusinessLogicError extends Schema.TaggedError<BusinessLogicError>()("BusinessLogicError", {
  operation: Schema.String,
  reason: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  timestamp: Schema.Number
}) {}

export class ResourceError extends Schema.TaggedError<ResourceError>()("ResourceError", {
  resourceType: Schema.String,
  resourceId: Schema.String,
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
}) {}

// Union type for all service errors
type ServiceError = ValidationError | BusinessLogicError | ResourceError
```

### 4. Pattern Matching and Guard Clauses
```typescript
// Early return pattern with guard clauses
const processRequest = (input: ServiceInput) => {
  // Input validation with early return
  if (!input.data) {
    return Effect.fail(new ValidationError({
      field: "data",
      expectedType: "non-empty string",
      actualValue: input.data,
      timestamp: Date.now()
    }))
  }

  // Pattern matching for business logic
  return Match.value(input.priority).pipe(
    Match.when("high", () => processHighPriority(input)),
    Match.when("medium", () => processMediumPriority(input)),
    Match.when("low", () => processLowPriority(input)),
    Match.exhaustive
  )
}

// Resource state pattern matching
const handleResourceState = (state: ResourceState) =>
  Match.value(state).pipe(
    Match.when({ _tag: "available" }, () => acquireResource()),
    Match.when({ _tag: "busy" }, ({ until }) => waitForResource(until)),
    Match.when({ _tag: "error" }, ({ error }) => handleResourceError(error)),
    Match.exhaustive
  )
```

### 5. Testing with Effect Services
```typescript
// Mock service with proper typing
export const MockServiceLive = Layer.succeed(
  ServiceNameService,
  {
    operation: (input) =>
      Effect.succeed({
        result: `mock-result-${input.data}`,
        processedAt: Date.now(),
        metadata: { mock: true }
      } as ServiceOutput)
  }
)

// Test helper for service behavior with Effect.provideService
const testServiceOperation = (input: ServiceInput, expectedOutput: ServiceOutput) =>
  pipe(
    ServiceNameService.operation(input),
    Effect.provideService(ServiceNameService, {
      operation: (input) =>
        Effect.succeed({
          result: `test-result-${input.data}`,
          processedAt: Date.now(),
          metadata: { test: true }
        } as ServiceOutput)
    }),
    Effect.runSync
  )

// Property-based test structure
const serviceProperty = (input: ServiceInput) => {
  const result = testServiceOperation(input, expectedOutput)
  return {
    input,
    output: result,
    isValid: Schema.is(ServiceOutput)(result)
  }
}
```

### 6. Resource Management and Effect Scopes
```typescript
// Scoped resource management
const withManagedResource = <A, E>(use: (resource: Resource) => Effect.Effect<A, E>) =>
  Effect.scoped(
    pipe(
      acquireResource(),
      Effect.flatMap(use)
    )
  )

// Layer composition with proper resource lifecycle
export const CompleteServiceLive = Layer.mergeAll(
  ServiceNameServiceLive,
  DatabaseServiceLive,
  CacheServiceLive
).pipe(
  Layer.provide(ConfigLive)
)
```

### 7. Configuration Management
```typescript
import { Context, Effect, Layer, Schema, Config, Schedule, pipe } from "effect"

// Service configuration tag
const ServiceConfigTag = Context.Tag<ServiceConfig>("@namespace/ServiceConfig")

// Configuration with environment variable loading and Schedule-based retries
const loadConfig = (): Effect.Effect<ServiceConfig, ConfigError> =>
  pipe(
    Effect.all({
      maxRetries: Config.number("MAX_RETRIES").pipe(Config.withDefault(3)),
      timeoutMs: Config.number("TIMEOUT_MS").pipe(Config.withDefault(5000)),
      batchSize: Config.number("BATCH_SIZE").pipe(Config.withDefault(10))
    }),
    Effect.flatMap(config => Schema.decodeUnknown(ServiceConfig)(config)),
    // 指数バックオフでリトライ - より実践的な設定
    Effect.retry(
      Schedule.exponential("1 second").pipe(
        Schedule.compose(Schedule.recurs(3)),
        Schedule.intersect(Schedule.spaced("10 seconds"))
      )
    )
  )

export const ServiceConfigLive = Layer.effect(
  ServiceConfigTag,
  loadConfig()
)
```
