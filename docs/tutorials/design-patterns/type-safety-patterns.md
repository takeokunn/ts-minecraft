# Type Safety Design Patterns

## 概要

このドキュメントでは、TypeScript Minecraft Clone プロジェクトにおけるType Safety（型安全性）の設計パターンと実装ガイドラインを説明します。Effect-TSを活用した堅牢な型システムの構築方法、実行時バリデーション、エラーハンドリングのベストプラクティスを提供します。

> 🔗 **実践的なチュートリアル**: このドキュメントで説明するパターンの具体的な実装例は以下を参照してください：
> - **[基本コンポーネント作成](../basic-game-development/basic-components.md)** - Brand型を使ったMinecraftドメインモデルの実装
> - **[Effect-TS パターン集](../effect-ts-fundamentals/effect-ts-patterns.md)** - Layer構成とサービス設計パターン
> - **[Effect-TS 型システム](../effect-ts-fundamentals/effect-ts-type-system.md)** - Brand型とSchemaの詳細な解説

## 目次

1. [TypeScriptの限界とEffect-TSの解決策](#typescript-limitations)
2. [型安全性の設計原則](#design-principles)
3. [ブランド型とドメインモデリング](#branded-types)
4. [Effect-TSの高度な型安全パターン](#advanced-patterns)
5. [依存性注入とLayer パターン](#dependency-injection)
6. [エラーハンドリングとパターンマッチング](#error-handling)
7. [合成パターンと Type Class](#composition-patterns)
8. [ベストプラクティス](#best-practices)
9. [アンチパターンとトラブルシューティング](#anti-patterns)

---

## TypeScriptの限界とEffect-TSの解決策 {#typescript-limitations}

### TypeScriptの型システムの限界

TypeScriptは優れた型システムを提供しますが、いくつかの制約があります：

```typescript
// 問題1: プリミティブ型の混同
type PlayerId = string
type ChunkId = string

function movePlayer(playerId: PlayerId, to: ChunkId) {
  // コンパイル時に以下のエラーを検出できない
  movePlayer("chunk_1_2", "player_123") // 引数が逆！
}

// 問題2: 実行時バリデーションの欠如
interface Config {
  fps: number // 0以下やInfinityも受け入れてしまう
  memoryLimit: number // 負の値も可能
}

// 問題3: null/undefinedの安全でない取り扱い
function getUser(id: string): User | null {
  // 戻り値のnullチェックを忘れやすい
  return null
}
```

### Effect-TSによる解決策

Effect-TSは以下の機能でこれらの問題を解決します：

```typescript
import { Schema } from '@effect/schema'
import { Brand, Effect, Option } from 'effect'

// 解決策1: Brand型による型レベルでの区別
export type PlayerId = string & Brand.Brand<'PlayerId'>
export const PlayerId = Brand.nominal<PlayerId>()

export type ChunkId = string & Brand.Brand<'ChunkId'>
export const ChunkId = Brand.nominal<ChunkId>()

// これはコンパイルエラーになる
function movePlayer(playerId: PlayerId, to: ChunkId) { /* ... */ }
// movePlayer(ChunkId("chunk_1_2"), PlayerId("player_123")) // Type Error!

// 解決策2: スキーマによる実行時バリデーション
export const ConfigSchema = Schema.Struct({
  fps: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.lessThanOrEqualTo(120)
  ),
  memoryLimit: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.lessThanOrEqualTo(2048)
  ),
})

// 解決策3: Optionによる安全なnull処理
function getUser(id: string): Effect.Effect<Option.Option<User>, never, UserRepository> {
  return Effect.gen(function* () {
    const repo = yield* UserRepository
    return yield* repo.findById(id) // Option<User>を返す
  })
}
```

---

## 型安全性の設計原則 {#design-principles}

### 1. コンパイル時保証の最大化

型システムを活用して、実行時エラーを可能な限りコンパイル時に検出します。

```typescript
// ❌ 危険: 実行時エラーの可能性
interface BlockPosition {
  x: number
  y: number
  z: number
}

function getBlock(pos: BlockPosition): Block {
  if (pos.y < 0 || pos.y > 255) {
    throw new Error("Invalid Y coordinate") // 実行時エラー
  }
  // ...
}

// ✅ 安全: コンパイル時保証
export const HeightSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 255),
  Schema.brand('Height')
)
export type Height = Schema.Schema.Type<typeof HeightSchema>

export const BlockPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: HeightSchema, // 型レベルで0-255が保証される
  z: Schema.Number.pipe(Schema.int()),
})
```

### 2. 実行時バリデーションの統合

スキーマを使用して、外部データの実行時バリデーションを型安全に実行します。

```typescript
// 設定ファイルの安全な読み込み
export const loadConfig = (configData: unknown): Effect.Effect<Config, ValidationError> =>
  Effect.gen(function* () {
    // Schema.decodeで実行時バリデーション
    return yield* Schema.decode(ConfigSchema)(configData)
  })

// ネットワークデータの安全な処理
export const PlayerPositionSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  position: WorldPositionSchema,
  timestamp: TimestampSchema,
})

export const handlePlayerMove = (rawData: unknown) =>
  Effect.gen(function* () {
    const moveData = yield* Schema.decode(PlayerPositionSchema)(rawData)
    // moveDataは型安全が保証されている
    yield* updatePlayerPosition(moveData.playerId, moveData.position)
  })
```

### 3. 明示的なエラーハンドリング

すべてのエラーケースを型レベルで表現し、処理を強制します。

```typescript
// エラーをEffect型で表現
export const loadChunk = (
  chunkId: ChunkId
): Effect.Effect<Chunk, ChunkNotFoundError | WorldGenerationError, ChunkLoader> =>
  Effect.gen(function* () {
    const loader = yield* ChunkLoader
    const chunkData = yield* loader.load(chunkId)

    return yield* chunkData.pipe(
      Option.match({
        onNone: () => Effect.fail(new ChunkNotFoundError({ chunkId })),
        onSome: (chunk) => Effect.succeed(chunk)
      })
    )
  })

// エラーハンドリングを強制
export const useChunk = (chunkId: ChunkId) =>
  loadChunk(chunkId).pipe(
    Effect.catchTags({
      ChunkNotFoundError: (error) => generateNewChunk(error.chunkId),
      WorldGenerationError: (error) => Effect.logError("Generation failed", error)
    })
  )
```

---

## ブランド型とドメインモデリング {#branded-types}

### ブランド型の基本概念

ブランド型は、同じプリミティブ型でも異なるドメイン概念を型レベルで区別する手法です。

```typescript
// プロジェクトの主要なブランド型定義
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

export const WorldCoordinateSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    title: 'WorldCoordinate',
    description: 'World coordinate value (finite number)',
  })
)
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>
```

### 階層的なブランド型設計

関連する概念をグループ化して管理します。

```typescript
// 位置関連のブランド型
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('ChunkPosition'))

export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))

export const WorldPosition = Schema.Struct({
  x: WorldCoordinateSchema,
  y: WorldCoordinateSchema,
  z: WorldCoordinateSchema,
})

// 変換関数の型安全な実装
export const chunkToBlockCoords = (
  chunkPos: ChunkPosition
): { startX: WorldCoordinate; startZ: WorldCoordinate } => ({
  startX: BrandedTypes.createWorldCoordinate(chunkPos.x * 16),
  startZ: BrandedTypes.createWorldCoordinate(chunkPos.z * 16),
})
```

### パターン検証とブランド型

正規表現パターンを組み合わせた検証：

```typescript
export const ChunkIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Unique identifier for a chunk (format: chunk_x_z)',
  })
)

export const ItemIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z_]+$/), // 小文字とアンダースコアのみ
  Schema.brand('ItemId'),
)
```

---

## Effect-TSの高度な型安全パターン {#advanced-patterns}

### Option型による安全なnull処理

```typescript
import { Option, Effect } from 'effect'

// チャンクIDから座標を復元（失敗の可能性がある）
export const chunkIdToPosition = (id: string): Option.Option<ChunkPosition> =>
  Option.fromNullable(id.match(/^chunk_(-?\d+)_(-?\d+)$/)).pipe(
    Option.flatMap((match) =>
      Option.all([
        Option.fromNullable(match[1]),
        Option.fromNullable(match[2])
      ]).pipe(
        Option.map(([xStr, zStr]) => ({
          x: parseInt(xStr, 10),
          z: parseInt(zStr, 10),
        }))
      )
    )
  )

// 使用例
const maybePosition = chunkIdToPosition("chunk_10_20")
Option.match(maybePosition, {
  onNone: () => console.log("Invalid chunk ID"),
  onSome: (pos) => console.log(`Position: ${pos.x}, ${pos.z}`)
})
```

### Either型による成功/失敗の表現

```typescript
import { Either, Effect } from 'effect'

// バリデーション結果をEitherで表現
export const validateBlockType = (data: unknown): Either.Either<BlockType, ValidationError> =>
  Schema.decodeEither(BlockTypeSchema)(data)

// 複数のバリデーションを組み合わせ
export const validateGameState = (data: unknown) =>
  Effect.gen(function* () {
    const playerData = yield* Schema.decode(PlayerSchema)(data.player)
    const worldData = yield* Schema.decode(WorldSchema)(data.world)
    const configData = yield* Schema.decode(ConfigSchema)(data.config)

    return { player: playerData, world: worldData, config: configData }
  })
```

### Match式による型安全なパターンマッチング

```typescript
import { Match } from 'effect'

// エラータイプによる分岐処理
export const handleGameError = (error: AnyGameError) =>
  Match.value(error).pipe(
    Match.when({ _tag: 'ResourceNotFoundError' }, (err) =>
      Effect.logWarning(`Resource not found: ${err.resourceId}`)
    ),
    Match.when({ _tag: 'ValidationError' }, (err) =>
      Effect.logError(`Validation failed: ${err.field}`)
    ),
    Match.when({ _tag: 'PerformanceError' }, (err) =>
      err.severity === 'critical'
        ? Effect.logError(`Critical performance issue: ${err.message}`)
        : Effect.logWarning(`Performance warning: ${err.message}`)
    ),
    Match.exhaustive
  )
```

---

## 依存性注入とLayer パターン {#dependency-injection}

### Serviceパターンの実装

```typescript
import { Context, Effect, Layer } from 'effect'

// サービスの定義
export class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    readonly debug: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
    readonly info: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
    readonly warn: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
    readonly error: (message: string, error?: Error) => Effect.Effect<void>
    readonly measurePerformance: <A>(
      functionName: string,
      operation: Effect.Effect<A>
    ) => Effect.Effect<A>
  }
>() {}

// Live実装
export const LoggerServiceLive = Layer.sync(LoggerService, () => ({
  debug: (message, context) => Effect.sync(() => console.debug(message, context)),
  info: (message, context) => Effect.sync(() => console.info(message, context)),
  warn: (message, context) => Effect.sync(() => console.warn(message, context)),
  error: (message, error) => Effect.sync(() => console.error(message, error)),

  measurePerformance: <A>(functionName: string, operation: Effect.Effect<A>) =>
    Effect.gen(function* () {
      const startTime = performance.now()
      yield* Effect.log(`Starting: ${functionName}`)

      const result = yield* operation

      const endTime = performance.now()
      yield* Effect.log(`Completed: ${functionName} (${endTime - startTime}ms)`)

      return result
    }),
}))
```

### レイヤー合成パターン

```typescript
// 複数のサービスを組み合わせ
export const InfrastructureLayer = Layer.mergeAll(
  LoggerServiceLive,
  ConfigServiceLive,
  DatabaseServiceLive
)

// 条件付きレイヤー提供
export const createAppLayer = (config: AppConfig) =>
  config.environment === 'test'
    ? Layer.mergeAll(InfrastructureLayer, MockServicesLayer)
    : Layer.mergeAll(InfrastructureLayer, ProductionServicesLayer)

// アプリケーション実行
export const runApp = (config: AppConfig) =>
  mainProgram.pipe(
    Effect.provide(createAppLayer(config)),
    Effect.runPromise
  )
```

### 依存関係の型安全な管理

```typescript
// 依存関係を明示したサービス定義
export class ChunkLoaderService extends Context.Tag('ChunkLoaderService')<
  ChunkLoaderService,
  {
    readonly loadChunk: (id: ChunkId) => Effect.Effect<
      Option.Option<Chunk>,
      ChunkLoadError,
      LoggerService | DatabaseService
    >
  }
>() {}

// 実装で依存関係を使用
export const ChunkLoaderServiceLive = Layer.effect(
  ChunkLoaderService,
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const db = yield* DatabaseService

    return {
      loadChunk: (id: ChunkId) =>
        Effect.gen(function* () {
          yield* logger.debug(`Loading chunk: ${id}`)
          const result = yield* db.query(chunkQuery(id))
          return Option.fromNullable(result)
        })
    }
  })
)
```

---

## エラーハンドリングとパターンマッチング {#error-handling}

### 構造化エラー定義

```typescript
// ドメインエラーの階層的定義
export const GameErrorSchema = Schema.Struct({
  _tag: Schema.Literal('GameError'),
  message: Schema.String,
  code: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export const ResourceNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ResourceNotFoundError'),
  message: Schema.String,
  resourceType: Schema.String,
  resourceId: Schema.String,
  searchPath: Schema.optional(Schema.String),
})

// エラーユニオン型
export const GameErrorUnion = Schema.Union(
  GameErrorSchema,
  ResourceNotFoundErrorSchema,
  ValidationErrorSchema,
  PerformanceErrorSchema,
  // ... 他のエラータイプ
)

export type AnyGameError = Schema.Schema.Type<typeof GameErrorUnion>
```

### エラー回復とフォールバック

```typescript
// エラー回復戦略
export const loadChunkWithFallback = (chunkId: ChunkId) =>
  loadChunk(chunkId).pipe(
    Effect.catchTags({
      ChunkNotFoundError: (error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`Chunk not found: ${error.chunkId}, generating new`)
          return yield* generateChunk(error.chunkId)
        }),
      WorldGenerationError: (error) =>
        Effect.gen(function* () {
          yield* Effect.logError("World generation failed", error)
          return yield* getEmptyChunk(chunkId)
        }),
    }),
    Effect.retry(Schedule.exponential(100).pipe(Schedule.maxRecurs(3)))
  )
```

### エラーログとメトリクス

```typescript
// 構造化ログとメトリクス収集
export const withErrorMetrics = <A, E extends AnyGameError, R>(
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.tapError((error) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        const metrics = yield* MetricsService

        // 構造化ログ出力
        yield* logger.error("Operation failed", {
          errorType: error._tag,
          errorMessage: error.message,
          timestamp: Date.now(),
          context: extractErrorContext(error)
        })

        // メトリクス更新
        yield* metrics.incrementCounter(`errors.${error._tag}`)
      })
    )
  )
```

---

## 合成パターンと Type Class {#composition-patterns}

### Functor と Monad パターン

```typescript
// カスタムデータ構造でのFunctorパターン
export interface GameState<A> {
  readonly value: A
  readonly timestamp: Timestamp
  readonly playerId: PlayerId
}

export const GameState = {
  map: <A, B>(fa: GameState<A>, f: (a: A) => B): GameState<B> => ({
    value: f(fa.value),
    timestamp: fa.timestamp,
    playerId: fa.playerId,
  }),

  flatMap: <A, B>(fa: GameState<A>, f: (a: A) => GameState<B>): GameState<B> => {
    const fb = f(fa.value)
    return {
      value: fb.value,
      timestamp: fb.timestamp, // 新しいタイムスタンプを使用
      playerId: fa.playerId,   // 元のプレイヤーIDを保持
    }
  }
}

// 使用例
const playerPosition: GameState<WorldPosition> = {
  value: { x: 10, y: 64, z: 20 },
  timestamp: Timestamp.now(),
  playerId: PlayerId("player_123")
}

const chunkPosition = GameState.map(
  playerPosition,
  (pos) => blockToChunkCoords(pos.x, pos.z)
)
```

### 合成可能なバリデーション

```typescript
// 複数のバリデーションを合成
export const validateGameConfig = Schema.Struct({
  graphics: Schema.Struct({
    fps: Schema.Number.pipe(Schema.int(), Schema.between(1, 120)),
    resolution: Schema.Struct({
      width: Schema.Number.pipe(Schema.int(), Schema.positive()),
      height: Schema.Number.pipe(Schema.int(), Schema.positive()),
    }),
    vsync: Schema.Boolean,
  }),
  world: Schema.Struct({
    renderDistance: Schema.Number.pipe(Schema.int(), Schema.between(2, 32)),
    seed: Schema.optional(Schema.Number.pipe(Schema.int())),
  }),
  controls: Schema.Struct({
    mouseSensitivity: Schema.Number.pipe(Schema.positive()),
    keyBindings: Schema.Record({
      key: Schema.String,
      value: Schema.String
    }),
  })
})

// バリデーション合成の例
export const validateAndApplyConfig = (configData: unknown) =>
  Effect.gen(function* () {
    const config = yield* Schema.decode(validateGameConfig)(configData)

    // 各設定を適用
    yield* applyGraphicsConfig(config.graphics)
    yield* applyWorldConfig(config.world)
    yield* applyControlsConfig(config.controls)

    return config
  })
```

---

## ベストプラクティス {#best-practices}

### 1. スキーマファーストアプローチ

```typescript
// ✅ 良い例: スキーマを先に定義
export const UserSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('UserId')),
  name: Schema.String.pipe(Schema.nonEmptyString()),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  createdAt: Schema.DateTimeUtc,
})

export type User = Schema.Schema.Type<typeof UserSchema>

// ❌ 悪い例: 型を先に定義してバリデーションが後回し
interface BadUser {
  id: string // バリデーションなし
  name: string // 空文字も許可してしまう
  email: string // 形式チェックなし
}
```

### 2. 意味のあるエラーメッセージ

```typescript
// ✅ 詳細なエラー情報
export const ChunkNotFoundError = (params: {
  chunkId: ChunkId
  searchPaths?: string[]
  cause?: unknown
}) => ({
  _tag: 'ChunkNotFoundError' as const,
  message: `Chunk not found: ${params.chunkId}`,
  chunkId: params.chunkId,
  searchPaths: params.searchPaths,
  cause: params.cause,
})

// ❌ 不十分なエラー情報
const badError = new Error("Chunk not found") // どのチャンクかわからない
```

### 3. レイヤー境界での型変換

```typescript
// ✅ 境界での明示的な変換
export const parsePlayerInput = (rawInput: unknown) =>
  Effect.gen(function* () {
    // 外部境界でのパース
    const validInput = yield* Schema.decode(PlayerInputSchema)(rawInput)

    // ドメインオブジェクトへの変換
    return PlayerInput.fromParsedData(validInput)
  })

// ✅ 出力時の明示的なシリアライゼーション
export const serializeGameState = (state: GameState) =>
  Schema.encode(GameStateSchema)(state)
```

### 4. テスト可能な設計

```typescript
// ✅ 依存性注入によるテスト容易性
export const processGameTick = (deltaTime: DeltaTime) =>
  Effect.gen(function* () {
    const physics = yield* PhysicsService
    const renderer = yield* RendererService
    const world = yield* WorldService

    yield* physics.update(deltaTime)
    yield* world.updateEntities(deltaTime)
    yield* renderer.render()
  })

// テスト時は簡単にモックを注入可能
const testLayer = Layer.mergeAll(
  MockPhysicsServiceLive,
  MockRendererServiceLive,
  MockWorldServiceLive
)
```

---

## アンチパターンとトラブルシューティング {#anti-patterns}

### よくあるアンチパターン

#### 1. 過度なany使用

```typescript
// ❌ アンチパターン
function processData(data: any): any {
  return data.whatever.something // 型安全性ゼロ
}

// ✅ 改善案
export const processGameData = <A>(
  schema: Schema.Schema<A>,
  data: unknown
) =>
  Effect.gen(function* () {
    const validData = yield* Schema.decode(schema)(data)
    return processValidatedData(validData)
  })
```

#### 2. エラーの隠蔽

```typescript
// ❌ アンチパターン
function loadChunk(id: string): Chunk | null {
  try {
    return doLoad(id)
  } catch {
    return null // エラー情報が失われる
  }
}

// ✅ 改善案
export const loadChunk = (id: ChunkId): Effect.Effect<
  Option.Option<Chunk>,
  ChunkLoadError,
  ChunkLoader
> =>
  Effect.gen(function* () {
    const loader = yield* ChunkLoader
    return yield* loader.load(id).pipe(
      Effect.mapError((cause) =>
        ChunkLoadError({ chunkId: id, cause })
      ),
      Effect.map(Option.fromNullable)
    )
  })
```

#### 3. 不適切な型アサーション

```typescript
// ❌ アンチパターン
const position = data as BlockPosition // 検証なし

// ✅ 改善案
const parsePosition = (data: unknown) =>
  Schema.decode(BlockPositionSchema)(data)
```

### トラブルシューティングガイド

#### 問題: 「Type instantiation is excessively deep」エラー

```typescript
// 原因: 過度に複雑な型定義
type DeepNested<T> = {
  level1: {
    level2: {
      level3: {
        // 10階層以上のネスト
      }
    }
  }
}

// 解決策: 型を分割
type Level3Data = { /* ... */ }
type Level2Data = { level3: Level3Data }
type Level1Data = { level2: Level2Data }
type GameData = { level1: Level1Data }
```

#### 問題: スキーマバリデーションのパフォーマンス

```typescript
// 問題: 毎回新しいスキーマを作成
const validateData = (data: unknown) => {
  const schema = Schema.Struct({ /* 複雑な定義 */ }) // 毎回作成
  return Schema.decode(schema)(data)
}

// 解決策: スキーマをキャッシュ
const DataSchema = Schema.Struct({ /* 定義 */ }) // 一度だけ作成

const validateData = (data: unknown) =>
  Schema.decode(DataSchema)(data)
```

#### 問題: 循環依存エラー

```typescript
// 問題: 相互依存するサービス
class ServiceA extends Context.Tag('ServiceA')<ServiceA, {
  useB: Effect.Effect<void, never, ServiceB>
}>() {}

class ServiceB extends Context.Tag('ServiceB')<ServiceB, {
  useA: Effect.Effect<void, never, ServiceA>
}>() {}

// 解決策: 間接参照またはイベント駆動アーキテクチャ
class EventBus extends Context.Tag('EventBus')<EventBus, {
  publish: (event: GameEvent) => Effect.Effect<void>
  subscribe: (handler: (event: GameEvent) => Effect.Effect<void>) => Effect.Effect<void>
}>() {}
```

### デバッグのベストプラクティス

```typescript
// デバッグ情報を含むEffect
export const debugEffect = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.tap((result) => Effect.log(`${name} succeeded`, result)),
    Effect.tapError((error) => Effect.log(`${name} failed`, error)),
    Effect.withSpan(name)
  )

// 使用例
const loadChunkDebug = (chunkId: ChunkId) =>
  debugEffect(
    `loadChunk(${chunkId})`,
    loadChunk(chunkId)
  )
```

---

## まとめ

このドキュメントで紹介したパターンを活用することで：

1. **コンパイル時安全性**: ブランド型とスキーマにより、多くのエラーをコンパイル時に検出
2. **実行時検証**: 外部データの安全な取り扱い
3. **明示的エラー処理**: すべてのエラーケースが型レベルで表現される
4. **合成可能性**: 小さな部品を組み合わせて複雑なロジックを構築
5. **テスト容易性**: 依存性注入により、単体テストが容易

これらのパターンは段階的に導入可能です。まずは重要な部分からブランド型を導入し、徐々にEffect-TSのより高度な機能を活用していくことをお勧めします。

---

## 参考リンク

- [Effect-TS 公式ドキュメント](https://effect.website/)
- [Schema バリデーション](https://effect.website/docs/schema/introduction)
- [エラーハンドリング](https://effect.website/docs/error-management)
- [依存性注入](https://effect.website/docs/context-management/layers)
- [プロジェクトのError定義](../../shared/errors/README.md)
- [ブランド型の実装例](../../shared/types/branded.ts)