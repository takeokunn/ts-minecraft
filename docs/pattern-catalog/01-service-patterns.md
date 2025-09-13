# Service Implementation Patterns

## Pattern 1: Basic Service
**使用場面**: 単純な状態を持たないサービス

**実装**:
```typescript
export interface BasicService {
  readonly process: (input: string) => Effect.Effect<string, ProcessingError>
}

export const BasicService = Context.GenericTag<BasicService>("@minecraft/BasicService")

const makeBasicService = Effect.succeed(
  BasicService.of({
    process: (input) => Effect.succeed(input.toUpperCase())
  })
)

export const BasicServiceLive = Layer.effect(BasicService, makeBasicService)
```

## Pattern 2: Stateful Service
**使用場面**: 内部状態を管理する必要がある場合

**実装**:
```typescript
export interface StatefulService {
  readonly increment: () => Effect.Effect<number, never>
  readonly reset: () => Effect.Effect<void, never>
}

export const StatefulService = Context.GenericTag<StatefulService>("@minecraft/StatefulService")

const makeStatefulService = Effect.gen(function* () {
  const counter = yield* Ref.make(0)

  return StatefulService.of({
    increment: () => Ref.updateAndGet(counter, n => n + 1),
    reset: () => Ref.set(counter, 0)
  })
})

export const StatefulServiceLive = Layer.effect(StatefulService, makeStatefulService)
```

## Pattern 3: Service with Dependencies
**使用場面**: 他のサービスに依存する場合

**実装**:
```typescript
export interface ComplexService {
  readonly complexProcess: (input: string) => Effect.Effect<string, ProcessingError>
}

export const ComplexService = Context.GenericTag<ComplexService>("@minecraft/ComplexService")

const makeComplexService = Effect.gen(function* () {
  const basicService = yield* BasicService
  const logger = yield* Logger

  return ComplexService.of({
    complexProcess: (input) => Effect.gen(function* () {
      yield* logger.info(`Processing: ${input}`)
      return yield* basicService.process(input)
    })
  })
})

export const ComplexServiceLive = Layer.effect(ComplexService, makeComplexService)
```

## Pattern 4: Caching Service
**使用場面**: 高価な計算結果をキャッシュする場合

**実装**:
```typescript
export interface CachingService {
  readonly expensiveOperation: (key: string) => Effect.Effect<string, ComputationError>
}

export const CachingService = Context.GenericTag<CachingService>("@minecraft/CachingService")

const makeCachingService = Effect.gen(function* () {
  const cache = yield* Ref.make(new Map<string, string>())

  const expensiveComputation = (input: string) =>
    Effect.gen(function* () {
      // 重い計算をシミュレート
      yield* Effect.sleep(Duration.seconds(1))
      return `computed-${input}`
    })

  return CachingService.of({
    expensiveOperation: (key) => Effect.gen(function* () {
      const currentCache = yield* Ref.get(cache)

      if (currentCache.has(key)) {
        return currentCache.get(key)!
      }

      const result = yield* expensiveComputation(key)
      yield* Ref.update(cache, c => new Map(c).set(key, result))
      return result
    })
  })
})

export const CachingServiceLive = Layer.effect(CachingService, makeCachingService)
```

## Pattern 5: Resource Management Service
**使用場面**: リソースの取得と解放が必要な場合

**実装**:
```typescript
export interface ResourceService {
  readonly acquireResource: (id: string) => Effect.Effect<Resource, ResourceError>
  readonly releaseResource: (resource: Resource) => Effect.Effect<void, ResourceError>
}

export const ResourceService = Context.GenericTag<ResourceService>("@minecraft/ResourceService")

const makeResourceService = Effect.gen(function* () {
  const activeResources = yield* Ref.make(new Set<string>())

  return ResourceService.of({
    acquireResource: (id) => Effect.gen(function* () {
      const active = yield* Ref.get(activeResources)

      if (active.has(id)) {
        return yield* Effect.fail(new ResourceError({
          message: `Resource ${id} is already in use`,
          resourceId: id,
          timestamp: Date.now()
        }))
      }

      return yield* Effect.acquireRelease(
        Effect.gen(function* () {
          yield* Ref.update(activeResources, s => new Set(s).add(id))
          return { id, data: `resource-data-${id}` }
        }),
        (resource) => Effect.gen(function* () {
          yield* Ref.update(activeResources, s => {
            const newSet = new Set(s)
            newSet.delete(resource.id)
            return newSet
          })
        })
      )
    }),

    releaseResource: (resource) => Effect.gen(function* () {
      yield* Ref.update(activeResources, s => {
        const newSet = new Set(s)
        newSet.delete(resource.id)
        return newSet
      })
    })
  })
})

export const ResourceServiceLive = Layer.effect(ResourceService, makeResourceService)
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Class-based Service
```typescript
// これは使わない
class GameService {
  constructor(private dependencies: Dependencies) {}

  public processGame(input: GameInput): Promise<GameOutput> {
    // 手続き的実装
  }
}
```

### ❌ Anti-Pattern 2: Direct instantiation
```typescript
// これも避ける
const service = new SomeService()
```

### ❌ Anti-Pattern 3: Try-catch in Effect.gen
```typescript
// これは不適切
const badService = Effect.gen(function* () {
  try {
    const result = yield* someOperation()
    return result
  } catch (error) {
    return yield* Effect.fail(error)
  }
})
```

### ✅ Always Use: Context.GenericTag + Layer
```typescript
const Service = Context.GenericTag<ServiceInterface>("@namespace/Service")
const ServiceLive = Layer.effect(Service, makeService)
```

## Best Practices

### 1. Service Naming Convention
- Interface: `ServiceNameService`
- Context Tag: Same as interface name
- Layer: `ServiceNameLive`
- Implementation: `makeServiceName`

### 2. Error Handling
```typescript
// 常にSchema.TaggedErrorを使用
export class ServiceError extends Schema.TaggedError("ServiceError")<{
  readonly operation: string
  readonly reason: string
  readonly timestamp: number
}> {}
```

### 3. Dependency Management
```typescript
// 依存関係は常にEffect.genで取得
const makeServiceWithDeps = Effect.gen(function* () {
  const dep1 = yield* Dependency1
  const dep2 = yield* Dependency2

  return ServiceInterface.of({
    // 実装
  })
})
```

### 4. Configuration
```typescript
// 設定はSchemaで型安全に
const ServiceConfig = Schema.Struct({
  maxRetries: Schema.Number.pipe(Schema.positive()),
  timeout: Schema.Number.pipe(Schema.positive())
})

type ServiceConfig = Schema.Schema.Type<typeof ServiceConfig>
```

### 5. Testing
```typescript
// テスト用のモック実装
export const MockServiceLive = Layer.succeed(
  Service,
  Service.of({
    operation: () => Effect.succeed("mock-result")
  })
)
```