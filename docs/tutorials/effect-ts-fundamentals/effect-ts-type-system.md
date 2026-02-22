# Effect-TS Type System Fundamentals

このドキュメントでは、Effect-TSの型システムの基本概念と、ts-minecraftプロジェクトでの実装パターンについて説明します。Effect-TSを初めて使用する開発者にとって、実用的なガイドとなることを目指しています。

## 目次

1. [Effect-TSとは](#what-is-effect-ts)
2. [ブランド型（Brand Types）](#brand-types)
3. [Schema による型安全性](#schema-type-safety)
4. [Immutable Collections](#immutable-collections)
5. [エラーハンドリング](#error-handling)
6. [実践的な使用例](#practical-examples)
7. [パフォーマンス考慮事項](#performance-considerations)

## What is Effect-TS?

Effect-TSは、関数型プログラミングの概念をTypeScriptで利用できるようにする強力なライブラリです。型安全性、エラーハンドリング、並行処理、依存性注入などを組み合わせて、堅牢でスケーラブルなアプリケーションを構築できます。

### なぜEffect-TSを使うのか？

1. **型安全性**: コンパイル時にエラーを検出
2. **関数型エラーハンドリング**: try-catchの代わりにEffect/Either/Optionを使用
3. **コンポーザビリティ**: 小さな関数を組み合わせて複雑な処理を構築
4. **テスタビリティ**: 依存性注入により簡単にテスト可能
5. **並行処理**: 型安全な非同期処理

```typescript
import { Effect, pipe } from 'effect'
import { Schema } from 'effect'

// 従来のコード
function processUserData(data: any) {
  try {
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Invalid name')
    }
    return { ...data, processed: true }
  } catch (error) {
    console.error(error)
    return null
  }
}

// Effect-TSでの実装
const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
})

const processUserDataEffect = (data: unknown) =>
  pipe(
    Schema.decodeUnknown(UserSchema)(data),
    Effect.map((user) => ({ ...user, processed: true }))
  )
```

## Brand Types

ブランド型は、同じ基底型（string、numberなど）でも意味的に異なる値を型レベルで区別する仕組みです。ts-minecraftでは、ID類や座標値などで広く使用されています。

### ブランド型の利点

1. **型安全性**: 異なる概念の値を混同することを防ぐ
2. **自己文書化**: 型名から用途が明確
3. **リファクタリング安全性**: 型変更が必要な箇所を確実に特定

### 基本的なブランド型の定義

```typescript
import { Schema } from 'effect'

// プレイヤーID用のブランド型
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

// ワールド座標用のブランド型
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

### 制約付きブランド型

より複雑な制約を持つブランド型も定義できます：

```typescript
// ブロックタイプID（正の整数のみ）
export const BlockTypeIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(10000), // 実用的上限
  Schema.brand('BlockTypeId'),
  Schema.annotations({
    title: 'BlockTypeId',
    description: 'Unique identifier for block types (positive integer)',
  })
)

// チャンクID（特定のパターンのみ）
export const ChunkIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Unique identifier for a chunk (format: chunk_x_z)',
  })
)

// UUID（正規表現での検証）
export const UUID = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand('UUID')
)
```

### 構造体のブランド型

複雑な構造体もブランド型として定義できます：

```typescript
// チャンク位置のブランド型
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('ChunkPosition'))

// ブロック位置のブランド型
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))

// ワールド位置（高精度座標）
export const WorldPosition = Schema.Struct({
  x: WorldCoordinateSchema,
  y: WorldCoordinateSchema,
  z: WorldCoordinateSchema,
})
```

### 安全なファクトリー関数

ブランド型を安全に作成するためのヘルパー関数：

```typescript
export const BrandedTypes = {
  /**
   * 安全なPlayerId作成
   */
  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),

  /**
   * 安全なWorldCoordinate作成
   */
  createWorldCoordinate: (value: number): WorldCoordinate => Schema.decodeSync(WorldCoordinateSchema)(value),

  /**
   * 安全なWorldPosition作成
   */
  createWorldPosition: (x: number, y: number, z: number): WorldPosition =>
    Schema.decodeSync(WorldPosition)({
      x: Schema.decodeSync(WorldCoordinateSchema)(x),
      y: Schema.decodeSync(WorldCoordinateSchema)(y),
      z: Schema.decodeSync(WorldCoordinateSchema)(z),
    }),
} as const

// 使用例
const playerId = BrandedTypes.createPlayerId('player-123')
const position = BrandedTypes.createWorldPosition(10.5, 64, -15.2)

// 型エラー: 異なるブランド型の混同を防ぐ
// const mixedUsage: PlayerId = BrandedTypes.createWorldCoordinate(123) // コンパイルエラー
```

## Schema による型安全性

Effect-TS Schemaは、ランタイム時の値検証とTypeScriptの型システムを統合します。これにより、外部データの取り込み時に型安全性を保証できます。

### 基本的なSchema定義

```typescript
import { Schema } from 'effect'

// プリミティブ型
const StringSchema = Schema.String
const NumberSchema = Schema.Number
const BooleanSchema = Schema.Boolean

// オブジェクト型
const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
  isActive: Schema.Boolean,
})

// オプショナルフィールド
const UserWithOptionalEmailSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.optionalWith(Schema.String, { exact: true }),
  age: Schema.Number,
})

// 配列
const StringArraySchema = Schema.Array(Schema.String)
const UserArraySchema = Schema.Array(UserSchema)
```

### 複雑なスキーマの組み合わせ

ts-minecraftのワールド生成システムで使用されている複雑なスキーマの例：

```typescript
// バイオームタイプ
export const BiomeType = Schema.Literal(
  'plains',
  'desert',
  'forest',
  'jungle',
  'swamp',
  'taiga',
  'snowy_tundra',
  'mountains',
  'ocean',
  'river',
  'beach',
  'mushroom_fields',
  'savanna',
  'badlands',
  'nether',
  'end',
  'void'
)

// バイオーム情報
export const BiomeInfoSchema = Schema.Struct({
  type: BiomeType,
  temperature: Schema.Number.pipe(
    Schema.filter((n) => Number.isFinite(n), {
      message: () => 'temperature must be a finite number',
    })
  ),
  humidity: Schema.Number.pipe(
    Schema.filter((n) => Number.isFinite(n), {
      message: () => 'humidity must be a finite number',
    })
  ),
  elevation: Schema.Number.pipe(
    Schema.filter((n) => Number.isFinite(n), {
      message: () => 'elevation must be a finite number',
    })
  ),
})

// 3次元座標
export const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
  y: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
  z: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
})

// 構造物の定義
export const StructureSchema = Schema.Struct({
  type: Schema.String,
  position: Vector3Schema,
  boundingBox: Schema.Struct({
    min: Vector3Schema,
    max: Vector3Schema,
  }),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
```

### Schemaの変換とフィルタリング

```typescript
// 変換を伴うスキーマ
const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.transform(Schema.Number.pipe(Schema.int()), {
      decode: Math.floor,
      encode: (n) => n,
    })
  ),
  z: Schema.Number.pipe(
    Schema.transform(Schema.Number.pipe(Schema.int()), {
      decode: Math.floor,
      encode: (n) => n,
    })
  ),
})

// カスタムフィルター
const PositiveIntegerSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.filter((n) => n > 0, {
    message: () => 'Must be a positive integer',
  })
)

// レンジ制限
const HeightSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 256))
```

### スキーマのデコード/エンコード

```typescript
import { Effect, Either } from 'effect'

// 同期デコード（例外をスロー）
const user = Schema.decodeSync(UserSchema)({
  id: '123',
  name: 'Alice',
  age: 25,
  isActive: true,
})

// 非同期デコード（Effectを返す）
const userEffect = Schema.decodeUnknown(UserSchema)({
  id: '123',
  name: 'Alice',
  age: 25,
  isActive: true,
})

// 安全なデコード（Eitherを返す）
const userEither = Schema.decodeUnknownEither(UserSchema)({
  id: '123',
  name: 'Alice',
  age: 25,
  isActive: true,
})

// Effectでの利用例
const processUser = (rawData: unknown) =>
  pipe(
    Schema.decodeUnknown(UserSchema)(rawData),
    Effect.map((user) => ({ ...user, processed: true })),
    Effect.mapError((error) => ({ type: 'VALIDATION_ERROR', error }))
  )
```

## Immutable Collections

Effect-TSは不変コレクションを提供し、データの安全な操作を可能にします。

### ReadonlyArray

```typescript
import { ReadonlyArray, pipe } from 'effect'

// 基本的な操作
const numbers = [1, 2, 3, 4, 5] as const

const doubled = pipe(
  numbers,
  ReadonlyArray.map((n) => n * 2)
) // readonly [2, 4, 6, 8, 10]

const evenNumbers = pipe(
  numbers,
  ReadonlyArray.filter((n) => n % 2 === 0)
) // readonly [2, 4]

const sum = pipe(
  numbers,
  ReadonlyArray.reduce(0, (acc, n) => acc + n)
) // 15

// チェインした操作
const result = pipe(
  numbers,
  ReadonlyArray.filter((n) => n > 2),
  ReadonlyArray.map((n) => n * 2),
  ReadonlyArray.sort((a, b) => b - a)
) // readonly [10, 8, 6]
```

### HashMap

```typescript
import { HashMap, pipe } from 'effect'

// HashMapの作成
const playerStats = HashMap.fromIterable([
  ['player1', { score: 100, level: 5 }],
  ['player2', { score: 200, level: 8 }],
  ['player3', { score: 150, level: 6 }],
])

// 値の取得
const player1Stats = HashMap.get('player1')(playerStats)
// Option<{ score: number, level: number }>

// 値の更新
const updatedStats = pipe(playerStats, HashMap.set('player1', { score: 120, level: 5 }))

// 変換操作
const scores = pipe(
  playerStats,
  HashMap.map((stats) => stats.score)
)

// フィルタリング
const highLevelPlayers = pipe(
  playerStats,
  HashMap.filter((stats) => stats.level > 6)
)
```

### ts-minecraftでの実用例

```typescript
// チャンクキャッシュの管理
import { HashMap, ReadonlyArray, pipe } from 'effect'
import type { ChunkId, ChunkData } from '../types'

class ChunkCache {
  private cache = HashMap.empty<ChunkId, ChunkData>()

  get(chunkId: ChunkId): Option<ChunkData> {
    return HashMap.get(chunkId)(this.cache)
  }

  set(chunkId: ChunkId, data: ChunkData): ChunkCache {
    return new ChunkCache().withCache(HashMap.set(chunkId, data)(this.cache))
  }

  getAllChunks(): ReadonlyArray<[ChunkId, ChunkData]> {
    return pipe(this.cache, HashMap.toEntries)
  }

  getLoadedChunkIds(): ReadonlyArray<ChunkId> {
    return pipe(this.cache, HashMap.keys, ReadonlyArray.fromIterable)
  }

  removeChunksNotInRange(centerChunk: ChunkPosition, maxDistance: number): ChunkCache {
    const filteredCache = pipe(
      this.cache,
      HashMap.filter((_, chunkId) => {
        const position = parseChunkId(chunkId)
        return Option.isSome(position) && chunkPositionDistance(centerChunk, position.value) <= maxDistance
      })
    )

    return new ChunkCache().withCache(filteredCache)
  }

  private withCache(cache: HashMap<ChunkId, ChunkData>): ChunkCache {
    const instance = new ChunkCache()
    instance.cache = cache
    return instance
  }
}
```

## エラーハンドリング

Effect-TSは関数型エラーハンドリングにより、型安全で予測可能なエラー処理を提供します。

### Option: 値が存在しない可能性

```typescript
import { Option, pipe } from 'effect'

// 値の検索
const findPlayerById = (id: PlayerId): Option.Option<Player> => {
  const player = playerDatabase.get(id)
  return player ? Option.some(player) : Option.none()
}

// Optionの操作
const playerName = pipe(
  findPlayerById(playerId),
  Option.map((player) => player.name),
  Option.getOrElse(() => 'Unknown Player')
)

// チェインした操作
const playerLevel = pipe(
  findPlayerById(playerId),
  Option.flatMap((player) => (player.stats ? Option.some(player.stats.level) : Option.none())),
  Option.filter((level) => level > 0),
  Option.getOrElse(() => 1)
)

// パターンマッチング
const displayPlayer = (maybePlayer: Option.Option<Player>) =>
  pipe(
    maybePlayer,
    Option.match({
      onNone: () => 'Player not found',
      onSome: (player) => `Player: ${player.name} (Level ${player.level})`,
    })
  )
```

### Either: 成功と失敗を表現

```typescript
import { Either, pipe } from 'effect'

// エラー型の定義
type ValidationError = {
  type: 'VALIDATION_ERROR'
  message: string
}

type NetworkError = {
  type: 'NETWORK_ERROR'
  code: number
}

type AppError = ValidationError | NetworkError

// Either を返す関数
const validatePlayerInput = (input: unknown): Either.Either<Player, ValidationError> => {
  const result = Schema.decodeUnknownEither(PlayerSchema)(input)
  return pipe(
    result,
    Either.mapLeft((error) => ({
      type: 'VALIDATION_ERROR' as const,
      message: error.message,
    }))
  )
}

// Eitherのチェイン
const processPlayerData = (input: unknown): Either.Either<ProcessedPlayer, AppError> =>
  pipe(
    validatePlayerInput(input),
    Either.flatMap((player) =>
      player.age >= 0
        ? Either.right({ ...player, processed: true })
        : Either.left({ type: 'VALIDATION_ERROR', message: 'Age must be non-negative' })
    )
  )

// エラーハンドリング
const handlePlayerResult = (result: Either.Either<ProcessedPlayer, AppError>) =>
  pipe(
    result,
    Either.match({
      onLeft: (error) => {
        switch (error.type) {
          case 'VALIDATION_ERROR':
            console.error('Validation failed:', error.message)
            break
          case 'NETWORK_ERROR':
            console.error('Network error:', error.code)
            break
        }
        return null
      },
      onRight: (player) => {
        console.log('Player processed successfully:', player.name)
        return player
      },
    })
  )
```

### Effect: 非同期処理とエラーハンドリング

```typescript
import { Effect, pipe } from 'effect'

// 非同期処理でのEffect使用
const loadChunkData = (chunkId: ChunkId): Effect.Effect<ChunkData, ChunkLoadError> =>
  Effect.tryPromise({
    try: () => chunkService.loadChunk(chunkId),
    catch: (error) => ({ type: 'CHUNK_LOAD_ERROR' as const, error }),
  })

// Effectのチェイン
const processChunk = (chunkId: ChunkId): Effect.Effect<ProcessedChunk, ChunkError> =>
  pipe(
    loadChunkData(chunkId),
    Effect.flatMap((chunk) => validateChunkData(chunk)),
    Effect.flatMap((chunk) => generateChunkMesh(chunk)),
    Effect.map((chunk) => ({ ...chunk, processed: true }))
  )

// エラーハンドリングとリトライ
const robustChunkProcessing = (chunkId: ChunkId) =>
  pipe(
    processChunk(chunkId),
    Effect.retry(Schedule.exponential(100).pipe(Schedule.jittered)),
    Effect.catchAll((error) => {
      console.error('Failed to process chunk:', error)
      return Effect.succeed(createEmptyChunk(chunkId))
    })
  )

// 並行処理
const loadMultipleChunks = (chunkIds: ReadonlyArray<ChunkId>) =>
  pipe(
    chunkIds,
    ReadonlyArray.map((id) => loadChunkData(id)),
    Effect.all({ concurrency: 4 })
  )

// 実行
const runChunkProcessing = async () => {
  const result = await Effect.runPromise(robustChunkProcessing(chunkId))
  console.log('Chunk processing completed:', result)
}
```

## 実践的な使用例

### チャンク座標の型安全な操作

```typescript
import { Option, pipe } from 'effect'

// チャンクIDから座標への変換（失敗の可能性を考慮）
export const chunkIdToPosition = (id: string): Option.Option<ChunkPosition> =>
  Option.fromNullable(id.match(/^chunk_(-?\d+)_(-?\d+)$/)).pipe(
    Option.flatMap((match) =>
      Option.all([Option.fromNullable(match[1]), Option.fromNullable(match[2])]).pipe(
        Option.map(([xStr, zStr]) => ({
          x: parseInt(xStr, 10),
          z: parseInt(zStr, 10),
        }))
      )
    )
  )

// 使用例
const maybePosition = chunkIdToPosition('chunk_10_-5')
pipe(
  maybePosition,
  Option.match({
    onNone: () => console.error('Invalid chunk ID format'),
    onSome: (position) => console.log(`Chunk at (${position.x}, ${position.z})`),
  })
)
```

### バイオーム生成での型安全性

```typescript
// バイオーム生成システム
export const generateBiomeInfo = (
  position: Vector3,
  temperature: number,
  humidity: number
): Effect.Effect<BiomeInfo, BiomeGenerationError> =>
  pipe(
    // 入力値の検証
    Effect.all([
      Schema.decodeUnknown(Vector3Schema)(position),
      Schema.decodeUnknown(Schema.Number)(temperature),
      Schema.decodeUnknown(Schema.Number)(humidity),
    ]),
    Effect.flatMap(([validPosition, validTemp, validHumidity]) => {
      const biomeType = determineBiomeType(validTemp, validHumidity)
      const elevation = calculateElevation(validPosition)

      return Schema.decodeUnknown(BiomeInfoSchema)({
        type: biomeType,
        temperature: validTemp,
        humidity: validHumidity,
        elevation,
      })
    }),
    Effect.mapError((error) => ({
      type: 'BIOME_GENERATION_ERROR' as const,
      error,
    }))
  )

// バイオーム決定ロジック
const determineBiomeType = (temperature: number, humidity: number): BiomeType => {
  if (temperature < -0.5) return 'snowy_tundra'
  if (temperature > 0.8 && humidity < 0.3) return 'desert'
  if (humidity > 0.8) return 'jungle'
  if (temperature > 0.5) return 'savanna'
  return 'plains'
}
```

### パフォーマンス最適化された検証

```typescript
// 開発環境でのみ検証を行う最適化
export const createOptimizedValidator = <A, I>(
  schema: Schema.Schema<A, I>,
  strategy: ValidationStrategy = 'development'
) => {
  const validator = (input: unknown): Effect.Effect<A, ParseResult.ParseError> => {
    switch (strategy) {
      case 'strict':
        return Schema.decodeUnknown(schema)(input)

      case 'development':
        return process.env['NODE_ENV'] === 'development'
          ? Schema.decodeUnknown(schema)(input)
          : Effect.succeed(input as A)

      case 'boundary':
        // 外部境界でのみ検証
        return Effect.succeed(input as A)

      case 'disabled':
        // TypeScript型のみに依存
        return Effect.succeed(input as A)

      default:
        return Schema.decodeUnknown(schema)(input)
    }
  }

  return {
    validate: validator,
    validateSync: (input: unknown): A => {
      if (strategy === 'development' && process.env['NODE_ENV'] !== 'development') {
        return input as A
      }
      return Schema.decodeSync(schema)(input)
    },
  }
}

// 使用例
const chunkValidator = createOptimizedValidator(ChunkDataSchema, 'development')

// ゲームループ内での高速検証
const processChunkInGameLoop = (rawChunkData: unknown) => {
  const chunkData = chunkValidator.validateSync(rawChunkData)
  // 60FPS を維持するため、開発環境以外では検証をスキップ
  return processChunk(chunkData)
}
```

## パフォーマンス考慮事項

### 検証戦略の使い分け

1. **strict**: 本番環境での重要な境界（API エンドポイント）
2. **development**: 開発時のみ検証、本番では型のみ依存
3. **boundary**: システム境界でのみ検証
4. **disabled**: TypeScript の型チェックのみに依存

```typescript
// 外部API境界では厳密に検証
const apiEndpointHandler = (request: unknown) =>
  pipe(Schema.decodeUnknown(RequestSchema)(request), Effect.flatMap(processRequest), Effect.mapError(handleApiError))

// ゲームループ内では最適化
const gameLoopProcessor = createOptimizedValidator(GameStateSchema, 'development')

// 内部モジュール間では型のみ依存
const internalProcessor = (data: ValidatedGameState) => {
  // TypeScriptの型チェックに依存
  return processInternalData(data)
}
```

### メモリ効率の改善

```typescript
// 大きなオブジェクトの部分的検証
const validateChunkHeader = Schema.Struct({
  id: ChunkIdSchema,
  position: ChunkPositionSchema,
  version: Schema.Number,
})

// 必要な部分のみを検証
const quickChunkValidation = (rawChunk: unknown) =>
  pipe(
    Schema.decodeUnknown(validateChunkHeader)(rawChunk),
    Effect.map((header) => ({ header, rawData: rawChunk }))
  )
```

## まとめ

Effect-TSの型システムは以下の利点を提供します：

1. **ブランド型**: 型安全性の向上と意図の明確化
2. **Schema**: ランタイム検証と型安全性の統合
3. **Immutable Collections**: 安全で効率的なデータ操作
4. **関数型エラーハンドリング**: 予測可能で合成可能なエラー処理
5. **パフォーマンス最適化**: 実行時コストと型安全性のバランス

ts-minecraftプロジェクトでは、これらの概念を組み合わせて堅牢でスケーラブルなゲームエンジンを構築しています。Effect-TSの型システムを理解することで、より安全で保守性の高いコードを書くことができます。

## 参考資料

- [Effect-TS 公式ドキュメント](https://effect.website)
- [ts-minecraft プロジェクトの実装例](../../reference/architecture/src-directory-structure.md)
- [Effect-TS パターン集](./effect-ts-patterns.md)
- [Effect-TS テスティング](./effect-ts-testing.md)
