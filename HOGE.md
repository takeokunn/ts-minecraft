# TypeScript Minecraft - 破壊的変更を前提とした並列実行可能改善計画

## ⚡ エグゼクティブサマリー

**方針**: 後方互換性を完全に無視し、理想的なアーキテクチャへの移行を最速で実現する並列実行可能な作業計画

### 主要な破壊的変更
1. 🔥 `src/domain` → `src/core` への完全移行
2. 🔥 全てのAPIインターフェースの刷新
3. 🔥 レガシーコードの完全削除
4. 🔥 新しい命名規則への統一

### 並列実行チーム数: 8チーム
- 各チームは独立して作業可能
- 依存関係を最小化した設計
- 日次マージによる継続的統合

---

## 🚀 並列実行可能タスク分割

### 📅 実行タイムライン
```
Day 1-2: Wave 1 (8チーム並列)
Day 3-4: Wave 2 (8チーム並列) 
Day 5-6: Wave 3 (8チーム並列)
Day 7: 統合とテスト
```

---

## 🌊 Wave 1: 完全独立タスク (Day 1-2)

### Team A: Domain → Core 移行（エンティティ）
```bash
# 作業内容
1. src/domain/entity.ts → src/core/entities/entity.ts
2. src/domain/block.ts → src/core/entities/block.ts  
3. src/domain/block-definitions.ts → src/core/entities/block-definitions.ts
4. 全インポートパスの機械的置換
```

```typescript
// 移行スクリプト
import { Project } from 'ts-morph'

const project = new Project()
project.addSourceFilesAtPaths('src/**/*.ts')

// 全ファイルのインポートを一括置換
project.getSourceFiles().forEach(file => {
  file.getImportDeclarations().forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue()
    if (moduleSpecifier.includes('@/domain')) {
      imp.setModuleSpecifier(
        moduleSpecifier.replace('@/domain', '@/core')
      )
    }
  })
})

await project.save()
```

### Team B: Domain → Core 移行（値オブジェクト）
```bash
# 作業内容  
1. src/domain/values/* → src/core/values/*
2. src/domain/types.ts → src/core/types.ts
3. src/domain/common.ts → src/core/common.ts
4. Data.Class への完全移行
```

```typescript
// 新しい値オブジェクト構造
// src/core/values/position.ts
export const Position = Data.struct<{
  readonly x: number
  readonly y: number
  readonly z: number
}>()

export const PositionSchema = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.clamp(-30000000, 30000000)),
  z: S.Number.pipe(S.finite())
})
```

### Team C: テストインフラ完全刷新
```bash
# 作業内容
1. test/ → src/test-utils/setup/
2. 新しいテストハーネス作成
3. モック完全自動生成システム
4. ビルダーパターンの全面適用
```

```typescript
// src/test-utils/harness.ts
export class TestHarness {
  static create() {
    return new TestHarness(
      Layer.mergeAll(
        TestClock.layer,
        TestRandom.layer,
        TestConsole.layer,
        MockWorldService.layer,
        MockRenderService.layer
      )
    )
  }
  
  async runEffect<A>(effect: Effect.Effect<A>) {
    return Effect.runPromise(
      effect.pipe(Effect.provide(this.layer))
    )
  }
}
```

### Team D: Worker基盤の完全再実装
```bash
# 作業内容
1. workers/ の完全書き換え
2. 型安全なメッセージングシステム
3. SharedArrayBuffer活用
4. Transferable Objects最適化
```

```typescript
// src/workers/base/typed-worker.ts
export const createTypedWorker = <TIn, TOut>(config: {
  schema: { input: S.Schema<TIn>; output: S.Schema<TOut> }
  handler: (input: TIn) => Effect.Effect<TOut>
  transferables?: (output: TOut) => Transferable[]
}) => {
  // 実装
}
```

### Team E: 新コンポーネントシステム
```bash
# 作業内容
1. src/core/components/ の完全再設計
2. コンポーネントレジストリ自動生成
3. アーキタイプ最適化
4. SoA/AoS自動変換
```

```typescript
// src/core/components/registry.ts
export const ComponentRegistry = (() => {
  const registry = new Map<string, ComponentDefinition>()
  
  return {
    register: <T>(name: string, schema: S.Schema<T>) => {
      registry.set(name, { name, schema })
    },
    getAll: () => Array.from(registry.values()),
    generateArchetypes: () => {
      // 自動アーキタイプ生成
    }
  }
})()
```

### Team F: クエリシステム刷新
```bash
# 作業内容
1. src/domain/query.ts → src/core/queries/
2. クエリビルダーDSL実装
3. クエリ最適化エンジン
4. インデックス自動構築
```

```typescript
// src/core/queries/builder.ts
export const query = () => ({
  with: <T extends ComponentType[]>(...components: T) => ({
    without: <U extends ComponentType[]>(...excluded: U) => ({
      where: (predicate: (entity: Entity) => boolean) => ({
        build: () => new OptimizedQuery(components, excluded, predicate)
      })
    })
  })
})

// 使用例
const movableEntities = query()
  .with('position', 'velocity')
  .without('frozen')
  .where(e => e.get('velocity').magnitude > 0)
  .build()
```

### Team G: エラーシステム全面刷新
```bash
# 作業内容
1. src/core/errors/ の完全再設計
2. エラー階層の自動生成
3. エラーリカバリー戦略
4. 構造化ログ連携
```

```typescript
// src/core/errors/generator.ts
export const defineError = <T extends Record<string, unknown>>(
  name: string,
  parent: typeof DomainError = DomainError
) => {
  return class extends Data.TaggedError(name)<T & {
    readonly timestamp: Date
    readonly stackTrace: string[]
    readonly context: Record<string, unknown>
  }> {
    static readonly _tag = name
  }
}

// 自動生成
export const EntityNotFoundError = defineError<{
  entityId: EntityId
}>('EntityNotFoundError', EntityError)
```

### Team H: パフォーマンス計測基盤
```bash
# 作業内容  
1. src/core/performance/ 新規作成
2. 自動計測システム
3. リアルタイムプロファイラー
4. メモリリーク検出
```

```typescript
// src/core/performance/profiler.ts
export const Profile = {
  measure: <A>(name: string) => 
    <R, E>(effect: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* effect
        const end = performance.now()
        
        yield* Metrics.record(name, end - start)
        return result
      }),
      
  memory: () => ({
    heap: performance.memory.usedJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit
  })
}
```

---

## 🌊 Wave 2: 依存タスク (Day 3-4)

### Team A: サービス層完全実装
```bash
# 依存: Wave 1のTeam A, B, E
# 作業内容
1. src/services/ の完全書き換え
2. 全サービスのContext.Tag化
3. Layer構成の自動化
4. 依存注入の最適化
```

### Team B: システム層の再構築
```bash
# 依存: Wave 1のTeam E, F
# 作業内容
1. src/systems/ の完全リファクタリング
2. システムスケジューラー実装
3. 並列実行最適化
4. システム間通信
```

### Team C: インフラ層の刷新
```bash
# 依存: Wave 1のTeam D
# 作業内容
1. src/infrastructure/ の再設計
2. Three.js統合の最適化
3. WebGPU対応準備
4. WASM統合
```

### Team D: 統合テスト基盤
```bash
# 依存: Wave 1のTeam C
# 作業内容
1. E2Eテストフレームワーク構築
2. ビジュアルレグレッションテスト
3. パフォーマンステスト自動化
4. カオステスト実装
```

### Team E: ランタイム最適化
```bash
# 依存: Wave 1のTeam H
# 作業内容
1. src/runtime/ の完全最適化
2. ゲームループの再設計
3. フレームレート安定化
4. メモリプール実装
```

### Team F: ビルドシステム刷新
```bash
# 依存: なし（独立実行可能）
# 作業内容
1. Viteコンフィグ最適化
2. コード分割戦略
3. Tree Shaking強化
4. バンドルサイズ最小化
```

### Team G: 開発ツール強化
```bash
# 依存: なし（独立実行可能）
# 作業内容
1. デバッグツール実装
2. ホットリロード改善
3. 開発用コマンド追加
4. プロファイリングUI
```

### Team H: CI/CD完全自動化
```bash
# 依存: なし（独立実行可能）
# 作業内容
1. GitHub Actions最適化
2. 並列ビルド・テスト
3. 自動デプロイ
4. 品質ゲート実装
```

---

## 🌊 Wave 3: 最終統合 (Day 5-6)

### Team A+B: コア機能統合
```bash
# 作業内容
1. 全コンポーネント統合テスト
2. システム間連携確認
3. パフォーマンスチューニング
```

### Team C+D: インフラ統合
```bash
# 作業内容
1. Worker統合テスト
2. レンダリング最適化
3. メモリ使用量最適化
```

### Team E+F: テスト完全実行
```bash
# 作業内容
1. 全テストスイート実行
2. カバレッジ100%達成
3. E2Eシナリオ検証
```

### Team G+H: 最終調整
```bash
# 作業内容
1. ドキュメント生成
2. リリースノート作成
3. 移行ガイド作成
```

---

## 🧪 ECS準拠テスト戦略

### テスト構造の統合
```
src/
├── core/              # ECSコア実装
│   └── __tests__/    # ユニットテスト
├── systems/
│   └── __tests__/    # システムテスト
├── test-utils/        # 共通テストユーティリティ（旧test/）
│   ├── arbitraries/  # PBT用Arbitrary
│   ├── builders/     # テストデータビルダー
│   ├── fixtures/     # テストフィクスチャ
│   ├── harness/      # テストハーネス
│   └── layers/       # Effect-TSテストレイヤー
└── e2e/              # E2Eテスト（統合済み）
    ├── ecs/          # ECSシステム統合テスト
    ├── performance/  # パフォーマンステスト
    └── scenarios/    # ゲームシナリオテスト
```

### ECS Component PBTテスト
```typescript
// src/core/components/__tests__/component.pbt.spec.ts
import { describe, it } from '@effect/vitest'
import { fc } from '@effect/vitest'
import { Effect, pipe } from 'effect'

describe('ECS Component Properties', () => {
  it.prop([
    fc.record({
      x: fc.float({ min: -1000, max: 1000 }),
      y: fc.float({ min: 0, max: 256 }),
      z: fc.float({ min: -1000, max: 1000 })
    })
  ])('Position component maintains immutability', (position) =>
    Effect.gen(function* () {
      const pos1 = Position(position)
      const pos2 = Position(position)
      
      // 同じデータから生成されたコンポーネントは等価
      expect(pos1).toEqual(pos2)
      
      // イミュータブル性の検証
      const modified = { ...pos1, x: pos1.x + 1 }
      expect(pos1.x).toBe(position.x) // 元のデータは変更されない
    })
  )

  // スキーマの可逆性テスト
  it.prop([ComponentArbitraries.anyComponent])(
    'Component schema encoding is reversible',
    (component) =>
      Effect.gen(function* () {
        const encoded = yield* S.encode(ComponentSchema)(component)
        const decoded = yield* S.decode(ComponentSchema)(encoded)
        expect(decoded).toEqual(component)
      })
  )
})
```

### ECS System統合テスト
```typescript
// src/systems/__tests__/physics.integration.spec.ts
describe('Physics System Integration', () => {
  it.effect('processes 10000 entities within 16ms', () =>
    Effect.gen(function* () {
      // Arrange: 大規模エンティティセット
      const world = yield* createWorldWith10000MovingEntities()
      
      // Act: 物理シミュレーション実行
      const startTime = yield* Clock.currentTimeMillis
      yield* physicsSystem.execute(world, 0.016) // 60FPS
      const endTime = yield* Clock.currentTimeMillis
      
      // Assert: パフォーマンス要件
      expect(endTime - startTime).toBeLessThan(16)
      
      // Assert: 物理法則の維持
      const totalEnergy = yield* calculateTotalEnergy(world)
      expect(totalEnergy).toBeCloseTo(initialEnergy, 2)
    }).pipe(
      Effect.provide(TestWorldLayer)
    )
  )
})
```

### Query最適化テスト
```typescript
// src/core/queries/__tests__/query.performance.spec.ts
describe('Query Performance', () => {
  it.effect('SoA query outperforms AoS by 5x', () =>
    Effect.gen(function* () {
      const world = yield* createLargeWorld()
      
      // SoA (Structure of Arrays) クエリ
      const soaStart = performance.now()
      const soaResult = yield* world.querySoA(complexQuery)
      const soaTime = performance.now() - soaStart
      
      // AoS (Array of Structures) クエリ
      const aosStart = performance.now()
      const aosResult = yield* world.queryAoS(complexQuery)
      const aosTime = performance.now() - aosStart
      
      expect(soaTime).toBeLessThan(aosTime / 5)
      expect(soaResult).toEqual(aosResult) // 同じ結果
    })
  )
})
```

---

## 📊 成功指標（破壊的変更版）

### 技術的指標
- 🎯 ビルド時間: 10秒以内（並列ビルド）
- 🎯 テスト実行時間: 30秒以内（並列実行）
- 🎯 バンドルサイズ: 50%削減
- 🎯 メモリ使用量: 300MB以下
- 🎯 初期ロード時間: 1秒以内

### コード品質指標
- 🎯 TypeScript strict: 100%準拠
- 🎯 テストカバレッジ: 95%以上
- 🎯 循環依存: 0
- 🎯 技術的負債: 0（完全書き換えによる）
- 🎯 any型使用: 0

---

## ⚡ 即座に実行可能なコマンド

```bash
# Wave 1 開始
npm run migrate:all

# 進捗確認
npm run status:migration

# Wave 1 検証
npm run validate:wave1

# Wave 1 マージ
npm run merge:wave1

# レガシーコード削除
npm run clean:legacy

# Wave 2 開始
npm run wave2:start
```

---

## 🚨 リスクと対策

### リスク
1. **完全な後方互換性の喪失** → 新バージョンとして完全切り替え
2. **大規模な変更による混乱** → 明確な役割分担と自動化
3. **マージコンフリクト** → 機械的な置換とAST操作で回避
4. **テスト失敗の連鎖** → 各Wave後の統合テスト

### 対策
- 完全自動化された移行スクリプト
- ASTベースのコード変換
- 並列実行による時間短縮
- 継続的な統合とテスト

---

作成日: 2025-09-10
バージョン: 2.0.0 (破壊的変更版)

### 2. Effect-TSパターンの最適化

#### 2.1 サービス定義の統一

```typescript
// 改善前
export class WorldService {
  getChunk(coords: ChunkCoordinates): Effect.Effect<Chunk> {
    // 実装
  }
}

// 改善後
export class WorldService extends Context.Tag('WorldService')<
  WorldService,
  {
    readonly getChunk: (coords: ChunkCoordinates) => Effect.Effect<Chunk, ChunkNotLoadedError>
    readonly setBlock: (pos: Position, block: BlockType) => Effect.Effect<void, InvalidPositionError>
    readonly queryEntities: (query: Query) => Effect.Effect<readonly EntityId[], never>
  }
>() {
  static readonly Live = Layer.effect(
    WorldService,
    Effect.gen(function* () {
      const chunkCache = yield* ChunkCache
      const spatialIndex = yield* SpatialIndex
      
      return WorldService.of({
        getChunk: (coords) => 
          pipe(
            chunkCache.get(coords),
            Effect.catchTag('ChunkNotFoundError', () =>
              generateChunk(coords).pipe(
                Effect.tap((chunk) => chunkCache.set(coords, chunk))
              )
            )
          ),
        // 他のメソッド実装
      })
    })
  )
}
```

#### 2.2 エラーハンドリングの階層化

```typescript
// エラー階層の定義
export abstract class GameError extends Data.TaggedError('GameError')<{
  readonly message: string
  readonly timestamp: Date
}> {}

export class DomainError extends Data.TaggedError('DomainError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EntityError extends DomainError {}
export class ComponentError extends DomainError {}
export class WorldError extends DomainError {}

// 具体的なエラー
export class EntityNotFoundError extends EntityError {
  readonly _tag = 'EntityNotFoundError'
  constructor(readonly entityId: EntityId) {
    super({ message: `Entity ${entityId} not found` })
  }
}
```

### 3. ECSアーキテクチャの改善

#### 3.1 コンポーネントの機能別分割

```typescript
// core/components/physics/index.ts
export const PhysicsComponents = {
  Position: Data.struct<Position>(),
  Velocity: Data.struct<Velocity>(),
  Acceleration: Data.struct<Acceleration>(),
  Mass: Data.struct<Mass>(),
  Collider: Data.struct<Collider>(),
} as const

// core/components/rendering/index.ts
export const RenderingComponents = {
  Mesh: Data.struct<Mesh>(),
  Material: Data.struct<Material>(),
  Light: Data.struct<Light>(),
  Camera: Data.struct<Camera>(),
} as const

// core/components/gameplay/index.ts
export const GameplayComponents = {
  Health: Data.struct<Health>(),
  Inventory: Data.struct<Inventory>(),
  PlayerControl: Data.struct<PlayerControl>(),
  AI: Data.struct<AI>(),
} as const
```

#### 3.2 クエリの最適化

```typescript
// アーキタイプベースのクエリ最適化
export class ArchetypeQuery {
  constructor(
    readonly required: ReadonlySet<ComponentType>,
    readonly excluded: ReadonlySet<ComponentType> = new Set(),
  ) {}

  matches(archetype: Archetype): boolean {
    return (
      Array.from(this.required).every(c => archetype.has(c)) &&
      Array.from(this.excluded).every(c => !archetype.has(c))
    )
  }
}

// SoA (Structure of Arrays) クエリの改善
export const querySoA = <T extends ComponentMap>(
  world: World,
  query: Query<T>
): Effect.Effect<SoAQueryResult<T>, never> =>
  Effect.gen(function* () {
    const archetypes = yield* world.getMatchingArchetypes(query)
    
    return yield* Effect.all(
      archetypes.map(archetype =>
        archetype.getComponentArrays(query.components)
      ),
      { concurrency: 'unbounded' }
    )
  })
```

### 4. Worker通信の型安全化

```typescript
// workers/shared/protocol.ts
export namespace WorkerProtocol {
  export const TerrainGeneration = {
    Request: S.Struct({
      type: S.Literal('generateTerrain'),
      chunkCoords: ChunkCoordinatesSchema,
      seed: S.Number,
    }),
    Response: S.Struct({
      type: S.Literal('terrainGenerated'),
      chunk: ChunkSchema,
    }),
    Error: S.Struct({
      type: S.Literal('error'),
      error: S.String,
    }),
  }

  export type TerrainGenerationRequest = S.Schema.Type<typeof TerrainGeneration.Request>
  export type TerrainGenerationResponse = S.Schema.Type<typeof TerrainGeneration.Response>
}

// workers/terrain-generation.worker.ts
const worker = createTypedWorker({
  input: WorkerProtocol.TerrainGeneration.Request,
  output: WorkerProtocol.TerrainGeneration.Response,
  handler: (request) =>
    Effect.gen(function* () {
      const chunk = yield* generateTerrain(request.chunkCoords, request.seed)
      return {
        type: 'terrainGenerated' as const,
        chunk,
      }
    })
})
```

---

## 🧪 Vitest関連の改善提案

### 1. テスト構造の標準化

#### 1.1 テストファイルの組織化

```typescript
// テストファイルの標準構造
src/
├── __tests__/         # 統合テスト
├── domain/
│   └── __tests__/    # ドメインユニットテスト
├── services/
│   └── __tests__/    # サービステスト
├── e2e/              # E2Eテスト
└── test-utils/       # テストユーティリティ
    ├── builders/     # テストデータビルダー
    ├── fixtures/     # テストフィクスチャ
    ├── mocks/       # モック定義
    └── layers/      # テスト用Layer
```

#### 1.2 Effect-TSテストパターンの確立

```typescript
// test-utils/effect-test.ts
import { describe, it, expect, beforeEach } from '@effect/vitest'
import { Effect, Layer, TestClock, TestContext } from 'effect'

export const describeEffect = (
  name: string,
  fn: (context: {
    readonly testLayer: Layer.Layer<TestServices>
    readonly runTest: <A, E>(
      effect: Effect.Effect<A, E, TestServices>
    ) => Promise<A>
  }) => void
) => {
  describe(name, () => {
    const testLayer = Layer.mergeAll(
      TestClock.layer,
      TestContext.layer,
      // 他のテスト用レイヤー
    )

    const runTest = <A, E>(effect: Effect.Effect<A, E, TestServices>) =>
      Effect.runPromise(effect.pipe(Effect.provide(testLayer)))

    fn({ testLayer, runTest })
  })
}
```

### 2. テストビルダーパターンの拡充

```typescript
// test-utils/builders/entity.builder.ts
export class EntityBuilder {
  private components = new Map<string, unknown>()
  private id = EntityId.make()

  withId(id: EntityId): this {
    this.id = id
    return this
  }

  withPosition(x: number, y: number, z: number): this {
    this.components.set('position', Position({ x, y, z }))
    return this
  }

  withVelocity(dx: number, dy: number, dz: number): this {
    this.components.set('velocity', Velocity({ dx, dy, dz }))
    return this
  }

  withHealth(current: number, max: number): this {
    this.components.set('health', Health({ current, max }))
    return this
  }

  build(): Entity {
    return Entity.of({
      id: this.id,
      components: this.components,
    })
  }
}

// 使用例
const player = new EntityBuilder()
  .withPosition(0, 64, 0)
  .withVelocity(0, 0, 0)
  .withHealth(20, 20)
  .build()
```

### 3. プロパティベーステスティングの強化

```typescript
// test-utils/arbitraries/domain.ts
import * as fc from 'fast-check'
import { Position, Velocity, EntityId } from '@/core/values'

export const Arbitraries = {
  position: fc.record({
    x: fc.float({ min: -1000, max: 1000, noNaN: true }),
    y: fc.float({ min: 0, max: 256, noNaN: true }),
    z: fc.float({ min: -1000, max: 1000, noNaN: true }),
  }).map(Position),

  velocity: fc.record({
    dx: fc.float({ min: -10, max: 10, noNaN: true }),
    dy: fc.float({ min: -10, max: 10, noNaN: true }),
    dz: fc.float({ min: -10, max: 10, noNaN: true }),
  }).map(Velocity),

  entityId: fc.uuid().map(EntityId.fromString),

  entity: fc.record({
    id: Arbitraries.entityId,
    components: fc.dictionary(
      fc.string(),
      fc.anything()
    ),
  }),
}

// プロパティベースのテスト例
describe('Physics System', () => {
  it.prop([Arbitraries.position, Arbitraries.velocity, fc.float()])(
    'position update preserves invariants',
    (position, velocity, deltaTime) =>
      Effect.gen(function* () {
        const newPosition = updatePosition(position, velocity, deltaTime)
        
        // 不変条件の検証
        expect(newPosition.y).toBeGreaterThanOrEqual(0)
        expect(newPosition.y).toBeLessThanOrEqual(256)
        
        // 物理法則の検証
        expect(newPosition.x).toBeCloseTo(
          position.x + velocity.dx * deltaTime,
          5
        )
      })
  )
})
```

### 4. カバレッジ戦略の改善

```typescript
// vitest.config.ts の最適化
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'src/@types/**',
        'src/**/*.spec.ts',
        'src/test-utils/**',
        'src/**/*.d.ts',
        'scripts/**',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        lines: [80, 95],
      },
    },
    setupFiles: ['./test/setup.ts'],
    globalSetup: './test/global-setup.ts',
    environment: 'jsdom',
    pool: 'threads',
    isolate: true,
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
```

### 5. E2Eテストの強化

```typescript
// e2e/game-loop.e2e.spec.ts
import { test, expect } from '@playwright/test'
import { GameTestHarness } from './harness'

test.describe('Game Loop E2E', () => {
  let harness: GameTestHarness

  test.beforeEach(async ({ page }) => {
    harness = await GameTestHarness.create(page)
    await harness.startGame()
  })

  test('should maintain stable FPS', async () => {
    const fps = await harness.measureFPS(5000) // 5秒間測定
    expect(fps.average).toBeGreaterThan(30)
    expect(fps.min).toBeGreaterThan(20)
    expect(fps.standardDeviation).toBeLessThan(10)
  })

  test('should handle player movement', async () => {
    const initialPosition = await harness.getPlayerPosition()
    
    await harness.movePlayer('forward', 1000) // 1秒前進
    const newPosition = await harness.getPlayerPosition()
    
    expect(newPosition.z).toBeLessThan(initialPosition.z)
  })

  test('should load chunks dynamically', async () => {
    const initialChunks = await harness.getLoadedChunks()
    
    await harness.teleportPlayer({ x: 1000, y: 64, z: 1000 })
    await harness.waitForChunksToLoad()
    
    const newChunks = await harness.getLoadedChunks()
    expect(newChunks.length).toBeGreaterThan(0)
    expect(newChunks).not.toEqual(initialChunks)
  })
})
```

---

## 📋 詳細な改善項目リスト

### 優先度: 高 🔴

1. **エラーハンドリングの統一**
   - [ ] 全エラークラスをData.TaggedErrorベースに移行
   - [ ] エラー階層の確立
   - [ ] エラーリカバリー戦略の実装
   - [ ] エラーログの構造化

2. **テストカバレッジの向上**
   - [ ] クリティカルパスのテスト100%カバレッジ
   - [ ] エッジケースのテスト追加
   - [ ] 失敗ケースのテスト強化
   - [ ] パフォーマンステストの追加

3. **型安全性の強化**
   - [ ] any型の完全排除
   - [ ] unknown型とバリデーションの組み合わせ
   - [ ] Branded Typesの全面採用
   - [ ] Schema定義の統一

### 優先度: 中 🟡

4. **パフォーマンス最適化**
   - [ ] メモリプールの実装
   - [ ] オブジェクトリサイクリング
   - [ ] レンダリング最適化
   - [ ] チャンク読み込みの最適化

5. **開発体験の向上**
   - [ ] ホットリロードの改善
   - [ ] デバッグツールの強化
   - [ ] 開発用コマンドの追加
   - [ ] ログシステムの改善

6. **ドキュメンテーション**
   - [ ] APIドキュメントの自動生成
   - [ ] アーキテクチャ決定記録(ADR)の作成
   - [ ] 開発ガイドラインの更新
   - [ ] トラブルシューティングガイドの作成

### 優先度: 低 🟢

7. **リファクタリング**
   - [ ] 重複コードの削除
   - [ ] 命名規則の統一
   - [ ] インポート文の整理
   - [ ] デッドコードの削除

8. **CI/CD改善**
   - [ ] ビルド時間の短縮
   - [ ] テスト並列化の改善
   - [ ] デプロイメントパイプラインの最適化
   - [ ] 品質ゲートの追加

---

## 🚀 実装ロードマップ

### Phase 1: 基盤整備 (Week 1-2)
- エラーハンドリングの統一
- テスト基盤の強化
- 型定義の整理

### Phase 2: アーキテクチャ改善 (Week 3-4)
- レイヤー構造の実装
- サービス層の完全実装
- Worker通信の型安全化

### Phase 3: テスト強化 (Week 5-6)
- テストカバレッジ向上
- E2Eテストの実装
- パフォーマンステストの追加

### Phase 4: 最適化 (Week 7-8)
- パフォーマンス最適化
- メモリ使用量の削減
- レンダリング最適化

### Phase 5: 仕上げ (Week 9-10)
- ドキュメンテーション整備
- CI/CD改善
- 最終テストと検証

---

## 📊 成功指標

### 技術的指標
- ✅ テストカバレッジ: 90%以上
- ✅ TypeScript strictモード: エラー0
- ✅ パフォーマンス: 60FPS安定
- ✅ メモリ使用量: 500MB以下
- ✅ ビルド時間: 30秒以内

### 品質指標
- ✅ バグ発生率: 月10件以下
- ✅ コードレビュー指摘事項: PR当たり5件以下
- ✅ 技術的負債: 減少傾向
- ✅ ドキュメントカバレッジ: 80%以上

---

## 🎯 次のアクション

### 即座に実行可能なタスク
1. エラークラスの統一実装
2. テストビルダーの作成
3. 型定義の整理
4. Vitestコンフィグの最適化

### 準備が必要なタスク
1. アーキテクチャ移行計画の詳細化
2. パフォーマンス測定基準の確立
3. E2Eテスト環境の構築
4. CI/CDパイプラインの設計

---

## 📝 参考資料

- [Effect-TS Documentation](https://effect.website/)
- [Vitest Documentation](https://vitest.dev/)
- [Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [Entity Component System](https://en.wikipedia.org/wiki/Entity_component_system)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

作成日: 2025-09-10
作成者: AI Assistant
バージョン: 1.0.0
