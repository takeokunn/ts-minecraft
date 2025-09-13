# ECSシステム

TypeScript MinecraftのECS（Entity Component System）は、ゲームオブジェクトの効率的な管理と更新を提供する。Archetypeベースの最適化とEffect-TSによる型安全な実装により、高いパフォーマンスとスケーラビリティを実現している。

## アーキテクチャ概要

```
ECSシステム構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - ECSWorkflow                          │
│ - SystemScheduler                      │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - ArchetypeService                     │
│ - QueryService                         │
│ - ComponentService                     │
│ - EntityDomainService                  │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - EntityRepository                      │
│ - ComponentRepository                   │
└─────────────────────────────────────────┘
```

## コンポーネント管理

### コンポーネント定義

```typescript
// 基本コンポーネントタイプ
type ComponentName = string
type ComponentData = unknown

// コンポーネントスキーマ
interface ComponentSchema<T> {
  readonly name: ComponentName
  readonly schema: Schema.Schema<T, T, never>
  readonly factory?: () => T
}

// 位置コンポーネント
const PositionComponent = Schema.Struct({
  _tag: Schema.Literal('PositionComponent'),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

// 速度コンポーネント
const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal('VelocityComponent'),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// 健康コンポーネント
const HealthComponent = Schema.Struct({
  _tag: Schema.Literal('HealthComponent'),
  current: Schema.Number,
  maximum: Schema.Number
})
type HealthComponent = Schema.Schema.Type<typeof HealthComponent>
```

### コンポーネント登録システム

```typescript
interface ComponentRegistry {
  readonly register: <T>(schema: ComponentSchema<T>) => Effect.Effect<void>
  readonly getComponent: <T>(entityId: EntityId, componentName: ComponentName) => Effect.Effect<Option.Option<T>>
  readonly setComponent: <T>(entityId: EntityId, componentName: ComponentName, data: T) => Effect.Effect<void>
  readonly removeComponent: (entityId: EntityId, componentName: ComponentName) => Effect.Effect<void>
  readonly hasComponent: (entityId: EntityId, componentName: ComponentName) => Effect.Effect<boolean>
  readonly query: (components: ReadonlyArray<ComponentName>) => Effect.Effect<QueryResult>
}

const ComponentRegistry = Context.GenericTag<ComponentRegistry>("@app/ComponentRegistry")

const ComponentRegistryLive = Layer.effect(
  ComponentRegistry,
  Effect.gen(function* () {
    // コンポーネントスキーマの保存
    const schemas = yield* Ref.make(new Map<ComponentName, Schema.Schema<unknown>>())

    // エンティティのコンポーネントデータ
    const entityComponents = yield* Ref.make(new Map<EntityId, Map<ComponentName, unknown>>())

    // アーキタイプ管理
    const archetypes = yield* Ref.make(new Map<string, Set<EntityId>>())

    const register = <T>(schema: ComponentSchema<T>) =>
      Ref.update(schemas, map => map.set(schema.name, schema.schema))

    const getComponent = <T>(entityId: EntityId, componentName: ComponentName): Effect.Effect<Option.Option<T>> =>
      Effect.gen(function* () {
        const components = yield* Ref.get(entityComponents)
        const entityData = components.get(entityId)
        
        if (!entityData) return Option.none()
        
        const componentData = entityData.get(componentName)
        return componentData ? Option.some(componentData as T) : Option.none()
      })

    const setComponent = <T>(entityId: EntityId, componentName: ComponentName, data: T) =>
      Effect.gen(function* () {
        // スキーマ検証
        const schemaMap = yield* Ref.get(schemas)
        const schema = schemaMap.get(componentName)
        
        if (schema) {
          yield* Schema.decodeUnknownEither(schema)(data).pipe(
            Effect.mapError(error => new ComponentError({ message: "Invalid component data", cause: error }))
          )
        }

        // コンポーネント設定
        yield* Ref.update(entityComponents, map => {
          const entityData = map.get(entityId) || new Map()
          entityData.set(componentName, data)
          return map.set(entityId, entityData)
        })

        // アーキタイプ更新
        yield* updateArchetype(entityId)
      })

    return ComponentRegistry.of({
      register,
      getComponent,
      setComponent,
      removeComponent,
      hasComponent,
      query
    })
  })
)
```

### システム実行順序

```typescript
// システム実行フェーズ定義
const SystemPhase = Schema.Literal(
  "input",        // 入力処理
  "logic",        // ゲームロジック
  "physics",      // 物理計算
  "rendering",    // レンダリング
  "cleanup"       // クリーンアップ
)
type SystemPhase = Schema.Schema.Type<typeof SystemPhase>

interface SystemScheduler {
  readonly registerSystem: (phase: SystemPhase, system: System) => Effect.Effect<void>
  readonly executePhase: (phase: SystemPhase, deltaTime: number) => Effect.Effect<void>
  readonly executeFrame: (deltaTime: number) => Effect.Effect<void>
}

const SystemScheduler = Context.GenericTag<SystemScheduler>("@app/SystemScheduler")

const SystemSchedulerLive = Layer.effect(
  SystemScheduler,
  Effect.gen(function* () {
    const systems = yield* Ref.make(new Map<SystemPhase, System[]>([
      ["input", []],
      ["logic", []],
      ["physics", []],
      ["rendering", []],
      ["cleanup", []]
    ]))

    const executeFrame = (deltaTime: number) =>
      Effect.gen(function* () {
        const phases: SystemPhase[] = ["input", "logic", "physics", "rendering", "cleanup"]

        yield* Effect.forEach(phases, phase => executePhase(phase, deltaTime), { concurrency: 1 })
      })

    const executePhase = (phase: SystemPhase, deltaTime: number) =>
      Effect.gen(function* () {
        const systemMap = yield* Ref.get(systems)
        const phaseSystems = systemMap.get(phase) || []
        
        // 並列実行可能なシステムは並列処理
        const concurrency = Match.value(phase).pipe(
          Match.when("logic", () => "unbounded" as const),
          Match.orElse(() => 1)
        )

        yield* Effect.forEach(
          phaseSystems,
          system => system.update(deltaTime),
          { concurrency }
        )
      })

    return SystemScheduler.of({
      registerSystem,
      executePhase,
      executeFrame
    })
  })
)
```

## Archetypeベースの最適化

### Archetype定義

```typescript
interface Archetype {
  readonly id: string
  readonly components: ReadonlySet<ComponentName>
  readonly entities: ReadonlySet<EntityId>
}

interface ArchetypeSignature {
  readonly required: ReadonlyArray<ComponentName>
  readonly forbidden: ReadonlyArray<ComponentName>
}

// Archetype管理サービス
interface ArchetypeService {
  readonly createSignature: (required: ReadonlyArray<ComponentName>, forbidden?: ReadonlyArray<ComponentName>) => Effect.Effect<ArchetypeSignature>
  readonly addEntity: (entity: Entity) => Effect.Effect<void, ArchetypeError>
  readonly removeEntity: (entityId: EntityId) => Effect.Effect<void>
  readonly findMatchingArchetypes: (signature: ArchetypeSignature) => Effect.Effect<ReadonlyArray<Archetype>>
  readonly getStats: () => Effect.Effect<ArchetypeStats>
  readonly clear: () => Effect.Effect<void>
}

const ArchetypeService = Context.GenericTag<ArchetypeService>("@app/ArchetypeService")
```

### Archetype最適化アルゴリズム

```typescript
const ArchetypeServiceLive = Layer.effect(
  ArchetypeService,
  Effect.gen(function* () {
    // アーキタイプ管理
    const archetypes = yield* Ref.make(new Map<string, Archetype>())
    
    // エンティティ->アーキタイプマッピング
    const entityArchetypes = yield* Ref.make(new Map<EntityId, string>())

    const addEntity = (entity: Entity): Effect.Effect<void, ArchetypeError> =>
      Effect.gen(function* () {
        // エンティティのコンポーネント取得
        const componentNames = Object.keys(entity.components)
        const archetypeHash = createArchetypeHash(componentNames)

        // アーキタイプ取得または作成
        const archetype = yield* getOrCreateArchetype(componentNames)

        // エンティティをアーキタイプに追加
        yield* Ref.update(archetypes, map => {
          const updated = { ...archetype, entities: new Set([...archetype.entities, entity.id]) }
          return map.set(archetypeHash, updated)
        })

        // マッピング更新
        yield* Ref.update(entityArchetypes, map => map.set(entity.id, archetypeHash))
      })

    const findMatchingArchetypes = (signature: ArchetypeSignature): Effect.Effect<ReadonlyArray<Archetype>> =>
      Effect.gen(function* () {
        const archetypeMap = yield* Ref.get(archetypes)
        const matches: Archetype[] = []

        for (const archetype of archetypeMap.values()) {
          if (archetypeMatches(archetype, signature)) {
            matches.push(archetype)
          }
        }

        return matches
      })

    // アーキタイプマッチング判定（純粋関数）
    const archetypeMatches = (archetype: Archetype, signature: ArchetypeSignature): boolean => {
      const archetypeSet = archetype.components

      // 早期リターン: 必須コンポーネントチェック
      const hasAllRequired = signature.required.every(required => archetypeSet.has(required))
      if (!hasAllRequired) return false

      // 早期リターン: 禁止コンポーネントチェック
      const hasForbidden = signature.forbidden.some(forbidden => archetypeSet.has(forbidden))
      if (hasForbidden) return false

      return true
    }

    return ArchetypeService.of({
      createSignature,
      addEntity,
      removeEntity,
      findMatchingArchetypes,
      getStats,
      clear
    })
  })
)
```

### メモリレイアウト最適化

```typescript
// データ指向設計によるコンポーネント配列
interface ComponentArray<T> {
  readonly componentName: ComponentName
  readonly data: T[]
  readonly entityIds: EntityId[]
  readonly sparse: Map<EntityId, number> // エンティティID -> インデックス
}

const createComponentArray = <T>(componentName: ComponentName): ComponentArray<T> => ({
  componentName,
  data: [],
  entityIds: [],
  sparse: new Map()
})

// SOA (Structure of Arrays) 形式でのデータ保存
const optimizeDataLayout = (archetype: Archetype) => {
  const componentArrays = new Map<ComponentName, ComponentArray<unknown>>()
  
  // 各コンポーネントタイプごとに配列作成
  for (const componentName of archetype.components) {
    componentArrays.set(componentName, createComponentArray(componentName))
  }
  
  return componentArrays
}
```

## クエリビルダー

### クエリ定義

```typescript
interface Query {
  readonly with: ReadonlyArray<ComponentName>
  readonly without: ReadonlyArray<ComponentName>
  readonly filter?: (entity: Entity) => boolean
}

interface QueryResult {
  readonly entities: ReadonlyArray<EntityId>
  readonly getComponent: <T>(entityId: EntityId, componentName: ComponentName) => T | undefined
  readonly count: number
}

// クエリビルダーAPI
const createQuery = () => ({
  with: (...components: ComponentName[]) => ({
    components,
    without: (...forbidden: ComponentName[]) => ({
      required: components,
      forbidden,
      filter: (predicate: (entity: Entity) => boolean) => ({
        required: components,
        forbidden,
        predicate
      })
    })
  })
})

// 使用例
const movableEntitiesQuery = createQuery()
  .with('position', 'velocity')
  .without('static')
  .filter(entity => entity.components.velocity.magnitude > 0)
```

### クエリ最適化

```typescript
interface QueryService {
  readonly executeQuery: (query: Query) => Effect.Effect<QueryResult>
  readonly createCachedQuery: (query: Query) => Effect.Effect<CachedQuery>
  readonly invalidateCache: (componentName: ComponentName) => Effect.Effect<void>
}

const QueryService = Context.GenericTag<QueryService>("@app/QueryService")

const QueryServiceLive = Layer.effect(
  QueryService,
  Effect.gen(function* () {
    const archetypeService = yield* ArchetypeService
    const queryCache = yield* Ref.make(new Map<string, QueryResult>())

    const executeQuery = (query: Query): Effect.Effect<QueryResult> =>
      Effect.gen(function* () {
        // キャッシュ確認
        const cacheKey = createQueryCacheKey(query)
        const cached = yield* Ref.get(queryCache).pipe(
          Effect.map(cache => cache.get(cacheKey))
        )
        
        if (cached) {
          return cached
        }

        // アーキタイプベースクエリ実行
        const signature: ArchetypeSignature = {
          required: query.with,
          forbidden: query.without
        }
        
        const matchingArchetypes = yield* archetypeService.findMatchingArchetypes(signature)
        
        // エンティティ収集
        const entities: EntityId[] = []
        for (const archetype of matchingArchetypes) {
          entities.push(...archetype.entities)
        }

        // フィルタ適用
        const filteredEntities = query.filter
          ? yield* Effect.forEach(entities, entity =>
              Effect.gen(function* () {
                const entityData = yield* getEntity(entity)
                return query.filter!(entityData) ? Option.some(entity) : Option.none()
              })
            ).pipe(
              Effect.map(options => options.filter(Option.isSome).map(option => option.value))
            )
          : entities

        const result: QueryResult = {
          entities: filteredEntities,
          getComponent: createComponentGetter(filteredEntities),
          count: filteredEntities.length
        }

        // 結果をキャッシュ
        yield* Ref.update(queryCache, cache => cache.set(cacheKey, result))

        return result
      })

    return QueryService.of({
      executeQuery,
      createCachedQuery,
      invalidateCache
    })
  })
)
```

## パフォーマンスマネージャー

### システム実行統計

```typescript
interface SystemPerformanceStats {
  readonly systemName: string
  readonly executionTime: number
  readonly entityCount: number
  readonly executionCount: number
  readonly averageTime: number
  readonly lastUpdate: number
}

interface PerformanceManager {
  readonly trackSystemExecution: (systemName: string, executionTime: number, entityCount: number) => Effect.Effect<void>
  readonly getSystemStats: (systemName: string) => Effect.Effect<Option.Option<SystemPerformanceStats>>
  readonly getAllStats: () => Effect.Effect<ReadonlyArray<SystemPerformanceStats>>
  readonly optimizeSystemOrder: () => Effect.Effect<ReadonlyArray<string>>
}

const PerformanceManager = Context.GenericTag<PerformanceManager>("@app/PerformanceManager")

const PerformanceManagerLive = Layer.effect(
  PerformanceManager,
  Effect.gen(function* () {
    const systemStats = yield* Ref.make(new Map<string, SystemPerformanceStats>())

    const trackSystemExecution = (systemName: string, executionTime: number, entityCount: number) =>
      Ref.update(systemStats, stats => {
        const existing = stats.get(systemName)
        
        if (existing) {
          const newExecutionCount = existing.executionCount + 1
          const newTotalTime = existing.averageTime * existing.executionCount + executionTime
          const newAverageTime = newTotalTime / newExecutionCount

          const updated: SystemPerformanceStats = {
            ...existing,
            executionTime,
            entityCount,
            executionCount: newExecutionCount,
            averageTime: newAverageTime,
            lastUpdate: Date.now()
          }
          
          return stats.set(systemName, updated)
        } else {
          const newStats: SystemPerformanceStats = {
            systemName,
            executionTime,
            entityCount,
            executionCount: 1,
            averageTime: executionTime,
            lastUpdate: Date.now()
          }
          
          return stats.set(systemName, newStats)
        }
      })

    const optimizeSystemOrder = (): Effect.Effect<ReadonlyArray<string>> =>
      Effect.gen(function* () {
        const stats = yield* Ref.get(systemStats)
        
        // 実行時間とエンティティ数を考慮した最適化
        return Array.from(stats.values())
          .sort((a, b) => {
            const aScore = a.averageTime / Math.max(a.entityCount, 1)
            const bScore = b.averageTime / Math.max(b.entityCount, 1)
            return aScore - bScore
          })
          .map(stat => stat.systemName)
      })

    return PerformanceManager.of({
      trackSystemExecution,
      getSystemStats,
      getAllStats,
      optimizeSystemOrder
    })
  })
)
```

### メモリ使用量最適化

```typescript
interface ECSMemoryStats {
  readonly totalEntities: number
  readonly totalComponents: number
  readonly archetypeCount: number
  readonly memoryUsage: {
    entities: number
    components: number
    archetypes: number
    queries: number
  }
}

const ECSOptimizer = {
  // 未使用エンティティのクリーンアップ
  cleanupDeadEntities: () =>
    Effect.gen(function* () {
      const entityService = yield* EntityDomainService
      const deadEntities = yield* entityService.findDeadEntities()
      
      yield* Effect.forEach(
        deadEntities,
        entityId => entityService.removeEntity(entityId),
        { concurrency: 'unbounded' }
      )
      
      return deadEntities.length
    }),

  // アーキタイプの最適化
  optimizeArchetypes: () =>
    Effect.gen(function* () {
      const archetypeService = yield* ArchetypeService
      const stats = yield* archetypeService.getStats()
      
      // 空のアーキタイプ削除
      const emptyArchetypes = stats.archetypeDistribution
        .filter(archetype => archetype.entityCount === 0)
      
      yield* Effect.forEach(
        emptyArchetypes,
        archetype => archetypeService.removeArchetype(archetype.hash),
        { concurrency: 'unbounded' }
      )
      
      return emptyArchetypes.length
    }),

  // コンポーネントデータの最適化  
  compactComponentData: () =>
    Effect.gen(function* () {
      const componentRegistry = yield* ComponentRegistry
      
      // 削除されたエンティティのコンポーネントデータクリーンアップ
      yield* componentRegistry.compactMemory()
      
      // アーキタイプのメモリレイアウト最適化
      yield* componentRegistry.optimizeLayout()
    })
}
```

## システム例

### 移動システム

```typescript
const MovementSystem: System = {
  name: "MovementSystem",
  phase: "logic",

  update: (deltaTime: number) =>
    Effect.gen(function* () {
      const queryService = yield* QueryService
      
      // 位置と速度を持つエンティティを取得
      const query: Query = {
        with: ["position", "velocity"],
        without: ["static"]
      }
      
      const result = yield* queryService.executeQuery(query)
      
      yield* Effect.forEach(
        result.entities,
        entityId => Effect.gen(function* () {
          const position = result.getComponent<PositionComponent>(entityId, "position")
          const velocity = result.getComponent<VelocityComponent>(entityId, "velocity")

          // 早期リターンでガード句
          if (!position || !velocity) return

          const newPosition: PositionComponent = {
            _tag: "PositionComponent",
            x: position.x + velocity.x * deltaTime,
            y: position.y + velocity.y * deltaTime,
            z: position.z + velocity.z * deltaTime
          }

          const componentRegistry = yield* ComponentRegistry
          yield* componentRegistry.setComponent(entityId, "position", newPosition)
        }),
        { concurrency: 'unbounded' }
      )
    })
}
```

### レンダリングシステム

```typescript
const RenderSystem: System = {
  name: "RenderSystem",
  phase: "rendering",

  update: (deltaTime: number) =>
    Effect.gen(function* () {
      const queryService = yield* QueryService
      const renderPort = yield* RenderPort
      
      // レンダリング可能なエンティティクエリ
      const query: Query = {
        with: ["position", "mesh"],
        without: ["hidden"]
      }
      
      const result = yield* queryService.executeQuery(query)
      
      // メッシュ更新
      yield* Effect.forEach(
        result.entities,
        entityId => Effect.gen(function* () {
          const position = result.getComponent<PositionComponent>(entityId, "position")
          const mesh = result.getComponent<MeshComponent>(entityId, "mesh")

          // 早期リターンでガード句
          if (!position || !mesh) return

          yield* renderPort.updateMeshPosition(mesh.handle, position)
        }),
        { concurrency: 'unbounded' }
      )
      
      // フレームレンダリング
      yield* renderPort.render()
    })
}
```

このECSシステムは、Archetypeベースの最適化により、大量のエンティティでも高いパフォーマンスを維持し、Effect-TSの型安全性により堅牢で保守性の高いゲームエンジンを実現している。クエリビルダーとパフォーマンス管理により、開発者は効率的にゲームシステムを構築できる。