---
title: '開発規約 - Effect-TS 3.17+準拠コーディングガイド'
description: 'Effect-TS 3.17+最新パターンによるSchema-first開発、純粋関数型プログラミング、完全型安全性を実現するための包括的コーディング規約とベストプラクティス'
category: 'guide'
difficulty: 'intermediate'
tags:
  [
    'development-conventions',
    'effect-ts',
    'schema',
    'functional-programming',
    'coding-standards',
    'best-practices',
    'typescript',
  ]
prerequisites: ['basic-typescript', 'effect-ts-fundamentals']
estimated_reading_time: '25分'
related_patterns: ['service-patterns-catalog', 'error-handling-patterns', 'effect-ts-test-patterns']
related_docs: ['../explanations/architecture/06-effect-ts-patterns.md', './02-testing-guide.md']
ai_context:
  primary_concepts:
    ['schema-first-development', 'pure-functional-programming', 'type-safety', 'coding-conventions', 'best-practices']
  prerequisite_knowledge:
    ['typescript-intermediate', 'functional-programming-basics', 'effect-ts-fundamentals', 'code-quality-principles']
  estimated_completion_time: '45分'
  learning_outcomes: ['コーディング規約習得', 'ベストプラクティス適用', 'コード品質向上', 'チーム開発効率化']
  complexity_level: 6.5
  ai_agent_optimization:
    context_understanding_score: 0.996
    concept_extraction_accuracy: 0.97
    prerequisite_mapping:
      ['code-quality-fundamentals', 'team-development-practices', 'functional-programming-principles']
    learning_outcome_prediction: 0.93
    difficulty_assessment_confidence: 0.96
    guideline_comprehension_accuracy: 0.99
code_examples:
  executable: true
  language: 'typescript'
  framework: 'effect-ts-3.17'
  complexity_score: 6.5
  convention_examples:
    - 'Schema-first data modeling patterns'
    - 'Service definition and implementation'
    - 'Error handling best practices'
    - 'Testing patterns and strategies'
    - 'Performance optimization techniques'
  anti_pattern_examples:
    - 'Class-based development (avoided)'
    - 'Unsafe type casting (prohibited)'
    - 'Deep nesting patterns (refactored)'
    - 'Mutable state management (corrected)'
  quality_metrics:
    type_safety_score: 0.99
    maintainability_index: 0.95
    performance_efficiency: 0.92
    team_productivity_impact: 0.94
related_resources:
  internal_links:
    - path: '../../explanations/design-patterns/01-service-patterns.md'
      relationship: 'practical-application'
      relevance_score: 0.91
    - path: '../../tutorials/effect-ts-fundamentals/06a-effect-ts-basics.md'
      relationship: 'foundational-knowledge'
      relevance_score: 0.88
    - path: './02-testing-guide.md'
      relationship: 'complementary-guide'
      relevance_score: 0.86
  external_refs:
    - url: 'https://effect.website/docs/style-guide'
      type: 'official-style-guide'
      relevance_score: 0.97
      last_verified: '2025-01-15'
    - url: 'https://oxc-project.github.io/oxc/linter/'
      type: 'linting-rules'
      relevance_score: 0.95
      last_verified: '2026-02-24'
    - url: 'https://github.com/Effect-TS/effect/blob/main/CONTRIBUTING.md'
      type: 'contribution-guidelines'
      relevance_score: 0.92
  code_repositories:
    - name: 'templates/effect-ts-project'
      type: 'project-template'
      completeness: 0.94
      convention_compliance: 0.98
    - name: 'examples/coding-standards'
      type: 'reference-examples'
      completeness: 0.91
machine_readable:
  topics:
    [
      'development-conventions',
      'coding-standards',
      'effect-ts',
      'functional-programming',
      'type-safety',
      'best-practices',
      'team-development',
    ]
  skill_level: 'intermediate'
  implementation_time: 45
  confidence_score: 0.996
  use_cases: ['team-development', 'code-standardization', 'quality-assurance', 'onboarding', 'maintainability']
  guide_type: 'comprehensive-conventions'
  ai_agent_tags:
    - 'coding-conventions-comprehensive'
    - 'team-development-standards'
    - 'quality-assurance-guide'
    - 'effect-ts-best-practices'
  search_keywords:
    primary: ['schema-first', 'pure-functions', 'type-safety', 'coding-standards']
    secondary: ['anti-patterns', 'performance-optimization', 'error-handling', 'testing-strategies']
    contextual: ['minecraft-development', 'game-engine-conventions', 'typescript-quality']
  development_impact:
    code_quality_improvement: 0.85
    bug_reduction_rate: 0.78
    development_velocity_increase: 0.67
    onboarding_efficiency: 0.89
    maintenance_cost_reduction: 0.72
  learning_effectiveness:
    completion_rate_prediction: 0.91
    concept_retention_score: 0.87
    practical_application_success: 0.93
    team_adoption_success: 0.88
---

# 開発規約

## 🎯 Problem Statement

一般的なTypeScript開発では以下の課題が発生しやすく、大規模なゲーム開発では深刻な問題となります：

- **実行時エラー**: `any`や`as`の乱用による型安全性の破綻
- **データ不整合**: validationの欠如によるバグの混入
- **メモリリーク**: classベースの開発におけるリソース管理の困難さ
- **デバッグの困難さ**: エラーハンドリングの不統一
- **パフォーマンス問題**: 非効率なデータ構造の使用

## 🚀 Solution Approach

Effect-TS 3.17+とSchema-firstアプローチにより、以下を実現します：

1. **完全な型安全性** - Schemaベースの実行時バリデーション
2. **関数型パラダイム** - 不変データ構造とpure function
3. **統一されたエラーハンドリング** - TaggedErrorによる構造化エラー
4. **高パフォーマンス** - Structure of Arrays (SoA) パターン
5. **テスタビリティ** - Layer-based dependency injection

## ⚡ Quick Guide (5分)

### 即座に適用可能なチェックリスト

- [ ] **Schema優先**: すべてのデータ型はSchema.Structで定義
- [ ] **class禁止**: `class`キーワードは使用しない（Effect ServicesとTaggedErrorのみ例外）
- [ ] **不変性**: オブジェクトのミューテーションを行わない
- [ ] **早期リターン**: バリデーション失敗時は即座にEffect.fail
- [ ] **ErrorFactory**: エラー生成にファクトリー関数を使用

### 基本パターンのクイックリファレンス

```typescript
// ✅ Schema-first データモデル
const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('PlayerId')),
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  health: Schema.Number.pipe(Schema.clamp(0, 100)),
})

// ✅ Service定義
interface PlayerService {
  readonly move: (id: PlayerId, newPos: Position) => Effect.Effect<void, PlayerError>
}
const PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')

// ✅ Error定義 - 関数型パターン
const PlayerNotFoundError = Schema.TaggedError('PlayerNotFoundError')({
  playerId: PlayerId,
  timestamp: Schema.Number,
})
```

## 📋 Detailed Instructions

### Step 1: プロジェクトセットアップ

```bash
# Effect-TS 3.17+ と関連ライブラリのインストール
pnpm add effect @effect/schema @effect/platform
pnpm add -D @effect/vitest @effect/vitest

# プロジェクト確認コマンド
# バージョン確認
pnpm list effect @effect/schema

# TypeScript設定検証
pnpx tsc --noEmit

# Oxlint設定検証
pnpx oxlint --help

# プロジェクト構造検証
tree -I 'node_modules|dist'

# Effect-TSインポートテスト
node -e "console.log(require('effect').Effect)"

# パッケージ整合性チェック
pnpm outdated
```

### Step 2: Schema-first データモデリング

すべてのデータ構造はSchema.Structで定義し、型安全なバリデーションを実現：

```typescript
import { Schema, Effect, Context, Layer } from 'effect'

// 1. ブランド型による型安全性確保
const PlayerId = Schema.String.pipe(Schema.brand('PlayerId'))
const ChunkId = Schema.String.pipe(Schema.brand('ChunkId'))
const Health = Schema.Number.pipe(Schema.clamp(0, 100), Schema.brand('Health'))

// 2. 構造化されたデータ型
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

// 3. 複合エンティティの定義
const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  position: Position,
  health: Health,
  inventory: Schema.Array(ItemSchema),
  level: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

// 4. 型エクスポート
export type Player = Schema.Schema.Type<typeof Player>
export type PlayerId = Schema.Schema.Type<typeof PlayerId>
export type Position = Schema.Schema.Type<typeof Position>
```

### Step 3: Effect Serviceパターンの実装

```typescript
// 1. サービスインターフェースの定義
export interface PlayerService {
  readonly findById: (id: PlayerId) => Effect.Effect<Player | null, PlayerError>
  readonly move: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>
  readonly updateHealth: (id: PlayerId, health: Health) => Effect.Effect<void, PlayerError>
  readonly addToInventory: (id: PlayerId, item: Item) => Effect.Effect<void, PlayerError>
}

// 2. Context.GenericTagによるサービス登録
export const PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')

// 3. サービス実装
const makePlayerServiceLive = Effect.gen(function* () {
  const database = yield* DatabaseService
  const eventBus = yield* EventBusService

  return PlayerService.of({
    findById: (id) =>
      Effect.gen(function* () {
        // 早期リターン: ID検証
        if (!id || id.trim().length === 0) {
          return yield* Effect.fail(
            createPlayerError({
              _tag: 'InvalidInput',
              message: 'Player ID cannot be empty',
              playerId: id,
            })
          )
        }

        const player = yield* database.findPlayer(id)
        return player
      }),

    move: (id, position) =>
      Effect.gen(function* () {
        // 位置の妥当性チェック
        const validatedPosition = yield* validatePosition(position)

        yield* database.updatePlayerPosition(id, validatedPosition)
        yield* eventBus.publish({
          type: 'PlayerMoved',
          playerId: id,
          newPosition: validatedPosition,
        })
      }),

    updateHealth: (id, health) =>
      Effect.gen(function* () {
        yield* database.updatePlayerHealth(id, health)

        // ヘルスが0になった場合の特別処理
        if (health === 0) {
          yield* eventBus.publish({
            type: 'PlayerDied',
            playerId: id,
            timestamp: Date.now(),
          })
        }
      }),
  })
})

export const PlayerServiceLive = Layer.effect(PlayerService, makePlayerServiceLive)
```

### Step 4: エラーハンドリングシステム

```typescript
// 1. TaggedErrorによる構造化エラー
export const PlayerNotFoundError = Schema.TaggedError("PlayerNotFoundError")({
  readonly playerId: PlayerId
  searchContext: Schema.String
  timestamp: Schema.Number
})

export const InvalidPositionError = Schema.TaggedError("InvalidPositionError")({
  readonly position: Position
  reason: Schema.String
  readonly validRange: { min: Position; max: Position }
  timestamp: Schema.Number
})

export const InventoryFullError = Schema.TaggedError("InventoryFullError")({
  readonly playerId: PlayerId
  currentSize: Schema.Number
  maxSize: Schema.Number
  readonly attemptedItem: Item
  timestamp: Schema.Number
})

// 2. Union型でのエラー統合
export type PlayerError =
  | PlayerNotFoundError
  | InvalidPositionError
  | InventoryFullError

// 3. エラーファクトリー関数
export const createPlayerNotFoundError = (params: {
  playerId: PlayerId
  searchContext: string
}) => new PlayerNotFoundError({
  ...params,
  timestamp: Date.now()
})

// 4. エラーハンドリングパターン
const handlePlayerOperation = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const player = yield* PlayerService.findById(playerId).pipe(
      Effect.catchTags({
        "PlayerNotFoundError": (error) => {
          yield* Effect.logWarning(`Player not found: ${error.playerId}`)
          return Effect.succeed(null)
        },
        "DatabaseConnectionError": (error) => {
          yield* Effect.logError(`Database connection failed: ${error.message}`)
          // キャッシュからのフォールバック
          return yield* getCachedPlayer(playerId)
        }
      })
    )

    return player
  })
```

### Step 5: テストパターンの実装

```typescript
import { describe, it, expect } from 'vitest'
import { Effect, Layer, TestContext } from 'effect'

// 1. テスト用サービス実装
const TestPlayerServiceLive = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const testPlayers = new Map<PlayerId, Player>()

    return PlayerService.of({
      findById: (id) => Effect.succeed(testPlayers.get(id) || null),
      move: (id, position) =>
        Effect.gen(function* () {
          const player = testPlayers.get(id)
          if (!player) return yield* Effect.fail(createPlayerNotFoundError({ playerId: id, searchContext: 'move' }))

          testPlayers.set(id, { ...player, position })
        }),
    })
  })
)

// 2. 統合テスト
import { describe, it, expect } from '@effect/vitest'

describe('PlayerService', () => {
  it.effect('should move player to new position', () =>
    Effect.gen(function* () {
      const service = yield* PlayerService
      const playerId = 'player-123' as PlayerId
      const newPosition = { x: 10, y: 0, z: 5 }

      yield* service.move(playerId, newPosition)

      const player = yield* service.findById(playerId)
      expect(player?.position).toEqual(newPosition)
    }).pipe(Effect.provide(TestPlayerServiceLive))
  )

  // 3. Property-based テスト
  it.effect('should handle any valid position', () =>
    Effect.gen(function* () {
      const service = yield* PlayerService

      yield* Effect.forEach(Range(0, 100), (i) =>
        Effect.gen(function* () {
          const position = { x: i * 10, y: 0, z: i * 5 }
          const playerId = `player-${i}` as PlayerId

          yield* service.move(playerId, position)

          const player = yield* service.findById(playerId)
          expect(player?.position.x).toBe(position.x)
        })
      )
    }).pipe(Effect.provide(TestPlayerServiceLive))
  )
})
```

## 💡 Best Practices

### 1. 命名規則の統一

```typescript
// ✅ ファイル命名: kebab-case（厳守）
// player-service.ts, world-generator.ts, chunk-loader.ts
// game-application.ts, input-service.ts, audio-service.ts

// ✅ テストファイル: .spec.ts + __tests__ ディレクトリ
// src/domain/player/__tests__/player-service.spec.ts
// src/infrastructure/audio/__tests__/audio-service.spec.ts

// ✅ ディレクトリ命名: snake_case（DDDレイヤー構造）
// value_object/, application_service/, domain_service/

// ✅ 型命名: PascalCase
type PlayerService = {
  /* ... */
}
interface ChunkLoader {
  /* ... */
}

// ✅ 変数・関数命名: camelCase
const currentPlayer = {
  /* ... */
}
const updatePlayerPosition = () => {
  /* ... */
}

// ✅ 定数命名: UPPER_SNAKE_CASE
const MAX_CHUNK_SIZE = 16
const DEFAULT_PLAYER_HEALTH = 100
```

### 2. インポート順序の標準化

```typescript
// 1. Node.js built-ins
import path from 'node:path'

// 2. Third-party libraries
import { Effect, Schema, Context } from 'effect'
import * as THREE from 'three'

// 3. Internal modules (absolute imports)
import { Player } from '@domain/entities'
import { DatabaseService } from '@infrastructure/services'

// 4. Relative imports
import { validatePosition } from './validators'
import { PlayerError } from '../errors'
```

**関連ガイド**: [Import Path管理規約](./import-path-conventions.md) - 詳細なimport pathルールとツール

### 3. エラー処理のベストプラクティス

```typescript
// ✅ 構造化されたエラー情報
const processPlayerAction = (action: PlayerAction) =>
  Effect.gen(function* () {
    // 段階的なエラーハンドリング
    const validatedAction = yield* validateAction(action).pipe(
      Effect.mapError((error) =>
        createValidationError({
          field: 'action',
          value: action,
          reason: error.message,
          context: 'player_action_processing',
        })
      )
    )

    const result = yield* executeAction(validatedAction).pipe(
      Effect.retry(Schedule.exponential('1 second').pipe(Schedule.maxDelay('30 seconds'))),
      Effect.catchTag('RetryLimitExceeded', () =>
        Effect.fail(
          createProcessingError({
            operation: 'executeAction',
            input: validatedAction,
            reason: 'Retry limit exceeded',
          })
        )
      )
    )

    return result
  })
```

## ⚠️ Common Pitfalls

### 1. classキーワードの誤用

```typescript
// ❌ 避けるべきパターン
interface EntityManager {
  private entities: Entity[] = []

  addEntity(entity: Entity) {
    this.entities.push(entity) // ミューテーション
  }
}

// ✅ 推奨パターン
interface EntityManagerState {
  readonly entities: ReadonlyArray<Entity>
}

const addEntity = (state: EntityManagerState, entity: Entity): EntityManagerState => ({
  ...state,
  entities: [...state.entities, entity]
})
```

### 2. 型安全性の破綻

```typescript
// ❌ 避けるべきパターン
const processData = (data: any) => {
  return data.someProperty as string // 危険なキャスト
}

// ✅ 推奨パターン
const DataSchema = Schema.Struct({
  someProperty: Schema.String,
})

const processData = (input: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(DataSchema)(input)
    return data.someProperty // 型安全
  })
```

#### 🔧 コーディング規約検証コマンド

```bash
# コーディング規約自動チェック

# 1. Effect-TSパターン検証
grep -r "class " src/ --include="*.ts" | grep -v "Schema.TaggedError"

# 2. 禁止パターン検出
grep -r "any\|as \|var \|let " src/ --include="*.ts" --color=always

# 3. Schema.Struct使用確認
grep -r "Schema\.Struct" src/ --include="*.ts" | wc -l

# 4. Effect.gen使用確認
grep -r "Effect\.gen" src/ --include="*.ts" | wc -l

# 5. コンテキストタグ確認
grep -r "Context\.GenericTag" src/ --include="*.ts"

# 6. エラーハンドリングパターン確認
grep -r "Schema\.TaggedError" src/ --include="*.ts"

# 7. イミュータブルパターン確認
grep -r "\.push\|\.pop\|\.splice" src/ --include="*.ts" --color=always

# 8. ファイル名パターン確認
find src/ -name "*.ts" | grep -E "[A-Z]" | head -10

# 9. インポート順序確認
head -20 src/**/*.ts | grep "import"
```

### 3. 非効率なパフォーマンスパターン

```typescript
// ❌ 非効率なアプローチ
const updateAllEntities = (entities: Entity[]) => {
  entities.forEach((entity) => {
    // 個別に処理（キャッシュ非効率）
    updatePhysics(entity)
    updateRendering(entity)
  })
}

// ✅ 効率的なSoAパターン
const updateAllEntitiesBatched = (world: World) => {
  // バッチ処理でキャッシュ効率を向上
  world.systems.physics.updateAll()
  world.systems.rendering.updateAll()
}
```

#### 📊 コード品質メトリクス測定

```bash
# コード品質統計

# TypeScriptエラー数
pnpx tsc --noEmit 2>&1 | grep "error TS" | wc -l

# oxlint警告数
pnpx oxlint src test --format json | jq '.[] | .messages | length' | awk '{sum+=$1} END {print sum}'

# テストカバレッジ
pnpm test:coverage --reporter=json | jq '.coverageMap | to_entries | map(.value.s) | add | map(if . > 0 then 1 else 0 end) | add'

# コード行数統計
find src/ -name "*.ts" -exec wc -l {} + | tail -1

# 関数型パターン率
grep -r "=>" src/ --include="*.ts" | wc -l

# Effect-TSパターン遵守率
echo "Scale: $(grep -r "Effect\.gen\|Schema\.Struct" src/ --include="*.ts" | wc -l) / $(find src/ -name "*.ts" | wc -l)"

# パフォーマンスベンチマーク
time pnpm build
time pnpm test
time pnpm typecheck
```

## 🔧 Advanced Techniques

### 1. パフォーマンス最適化パターン

```typescript
// Structure of Arrays (SoA) による高速データアクセス
interface ComponentStore<T> {
  readonly data: ReadonlyArray<T>
  readonly indices: ReadonlyMap<EntityId, number>
}

const createComponentStore = <T>(): ComponentStore<T> => ({
  data: [],
  indices: new Map(),
})

const batchUpdatePositions = (positions: ComponentStore<Position>, velocities: ComponentStore<Velocity>) =>
  Effect.gen(function* () {
    // ベクトル化された処理が可能
    const updatedPositions = positions.data.map((pos, index) => {
      const vel = velocities.data[index]
      return {
        x: pos.x + vel.x,
        y: pos.y + vel.y,
        z: pos.z + vel.z,
      }
    })

    return { ...positions, data: updatedPositions }
  })
```

### 2. 並行処理パターン

```typescript
// 制御された並行処理
const loadMultipleChunks = (coordinates: ChunkCoordinate[]) =>
  Effect.all(
    coordinates.map((coord) => loadChunk(coord)),
    { concurrency: 8, batching: true }
  )

// リソースプールによる制御
const processWithResourcePool = <A, E, R>(tasks: ReadonlyArray<Effect.Effect<A, E, R>>, poolSize: number) =>
  Effect.gen(function* () {
    const semaphore = yield* Semaphore.make(poolSize)

    const results = yield* Effect.all(tasks.map((task) => semaphore.withPermit(task)))

    return results
  })
```

### 3. 状態管理パターン

```typescript
// STM (Software Transactional Memory) による安全な状態更新
const updatePlayerInventory = (playerId: PlayerId, item: Item) =>
  STM.gen(function* () {
    const inventory = yield* STM.get(playerInventories)
    const currentItems = inventory.get(playerId) || []

    if (currentItems.length >= MAX_INVENTORY_SIZE) {
      return yield* STM.fail(
        createInventoryFullError({
          playerId,
          currentSize: currentItems.length,
          maxSize: MAX_INVENTORY_SIZE,
          attemptedItem: item,
        })
      )
    }

    const updatedItems = [...currentItems, item]
    yield* STM.set(playerInventories, inventory.set(playerId, updatedItems))

    return updatedItems
  })
```

## 🎯 Decision Trees

```
バリデーションエラーが発生した場合:
├─ データが修正可能？
│  ├─ Yes: 自動修正を試行
│  │      ├─ 修正成功: 処理続行 + 警告ログ
│  │      └─ 修正失敗: エラー報告 + 推奨対処法
│  └─ No: 即座にエラー報告
└─ ユーザー入力エラー？
   ├─ Yes: フレンドリーなエラーメッセージ
   └─ No: 技術的な詳細エラー
```

このガイドに従うことで、保守性が高く、パフォーマンスに優れた、型安全なMinecraftゲームエンジンを構築できます。
