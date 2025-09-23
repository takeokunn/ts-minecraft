---
title: 'Effect-TS Schema API リファレンス'
description: 'Schema.Struct、Brand型、バリデーションのAPIリファレンス'
category: 'reference'
difficulty: 'intermediate'
tags: ['effect-ts', 'schema', 'validation', 'api-reference', 'brand-types']
prerequisites: ['effect-ts-basics', 'typescript-types']
estimated_reading_time: '20分'
---

# Effect-TS Schema API リファレンス

> 📚 **最新Schema APIドキュメント**: Schemaの最新APIドキュメントとバリデーションパターンはContext7で確認できます。
>
> ```bash
> # Context7で最新のSchema APIドキュメントを参照
> # Library ID: /effect/schema
> # Topic: "Schema.Struct", "Brand types", "Validation patterns"
> ```

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [リファレンス](./README.md) → **Schema API**
>
> **🎯 学習目標**: Schema APIの完全な仕様と使用方法
>
> **⏱️ 所要時間**: 20分
>
> **📚 前提知識**: Effect-TS基礎、TypeScript型システム

### 📋 関連ドキュメント

- **基礎学習**: [Effect-TS 基礎チュートリアル](../../tutorials/effect-ts-fundamentals/effect-ts-basics.md) - 実践的な学習パス
- **設計哲学**: [関数型プログラミング哲学](../../explanations/design-patterns/functional-programming-philosophy.md) - 概念的理解
- **移行ガイド**: [Effect-TS移行ガイド](../../how-to/development/effect-ts-migration-guide.md) - 実務での適用方法
- **Context API**: [Context API](./effect-ts-context-api.md) - サービス定義パターン
- **データモデリング**: [データモデリングパターン](../../explanations/design-patterns/data-modeling-patterns.md) - Schema活用戦略

---

## 1. Schema.Struct API

### 1.1 基本定義

```typescript
import { Schema } from 'effect'

// 基本的な構造体定義
const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
  email: Schema.String,
})

// 型の自動導出
type User = typeof UserSchema.Type
// { readonly id: string; readonly name: string; readonly age: number; readonly email: string }
```

### 1.2 ネストした構造体

```typescript
// Minecraft固有の構造体
const PositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

const BlockSchema = Schema.Struct({
  type: Schema.Literal('stone', 'dirt', 'grass', 'air'),
  position: PositionSchema,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

const ChunkSchema = Schema.Struct({
  x: Schema.Int,
  z: Schema.Int,
  blocks: Schema.Array(BlockSchema),
  entities: Schema.Array(EntitySchema),
  lastModified: Schema.DateTimeUtc,
})
```

## 2. バリデーションAPI

### 2.1 基本的なバリデーター

```typescript
// 数値バリデーション
const HealthSchema = Schema.Number.pipe(Schema.between(0, 100), Schema.int())

const ExperienceSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.finite())

// 文字列バリデーション
const PlayerNameSchema = Schema.String.pipe(
  Schema.minLength(3),
  Schema.maxLength(16),
  Schema.pattern(/^[a-zA-Z0-9_]+$/)
)

// 配列バリデーション
const InventorySchema = Schema.Array(ItemSchema).pipe(Schema.maxItems(36))

// Email バリデーション (最新パターン)
export const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand('Email'),
  Schema.annotations({
    identifier: 'Email',
    title: 'Email Address',
    description: 'Valid email address format',
  })
)

// Positive Integer Brand (改良版)
export const PositiveIntSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('PositiveInt'),
  Schema.annotations({
    identifier: 'PositiveInt',
    title: 'Positive Integer',
    description: 'A positive integer value',
  })
)
```

### 2.2 カスタムバリデーション

```typescript
// カスタム述語による検証
const ValidPositionSchema = PositionSchema.pipe(
  Schema.filter((pos) => pos.y >= 0 && pos.y < 384, {
    message: () => 'Y座標は0-383の範囲内である必要があります',
  })
)

// 複雑な検証ロジック
const ValidChunkSchema = ChunkSchema.pipe(
  Schema.filter((chunk) => chunk.blocks.length === 16 * 16 * 384, {
    message: () => 'チャンクは正確に16x16x384ブロックを含む必要があります',
  })
)

// Transform付きスキーマ (最新パターン)
export const DateSchema = Schema.transformOrFail(Schema.String, Schema.DateFromSelf, {
  decode: (str) => {
    const date = new Date(str)
    return isNaN(date.getTime())
      ? ParseResult.fail(new ParseResult.Type(Schema.String.ast, str))
      : ParseResult.succeed(date)
  },
  encode: (date) => ParseResult.succeed(date.toISOString()),
})

// Refinement Brand (高度なパターン)
export const UserId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[a-z0-9_-]+$/),
  Schema.brand('UserId'),
  Schema.annotations({
    identifier: 'UserId',
    title: 'User ID',
    description: 'Unique user identifier',
  })
)
```

## 3. Brand型

### 3.1 Brand型の定義

```typescript
// Brand型でプリミティブ型を区別
const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
type PlayerId = typeof PlayerIdSchema.Type

const EntityIdSchema = Schema.String.pipe(Schema.brand('EntityId'))
type EntityId = typeof EntityIdSchema.Type

const ChunkCoordinateSchema = Schema.Int.pipe(Schema.brand('ChunkCoordinate'))
type ChunkCoordinate = typeof ChunkCoordinateSchema.Type

// 使用例
function getPlayer(id: PlayerId): Effect.Effect<Player> {
  // PlayerIdとEntityIdは型レベルで区別される
  return loadPlayer(id)
}
```

### 3.2 複合Brand型

```typescript
// 複数の制約を持つBrand型
const PositiveIntSchema = Schema.Int.pipe(Schema.positive(), Schema.brand('PositiveInt'))

const NonEmptyStringSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('NonEmptyString'))

const ValidEmailSchema = Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/), Schema.brand('Email'))
```

## 4. Union型とDiscriminated Union

### 4.1 基本的なUnion

```typescript
const ItemTypeSchema = Schema.Union(
  Schema.Literal('weapon'),
  Schema.Literal('armor'),
  Schema.Literal('food'),
  Schema.Literal('tool')
)

const NumberOrStringSchema = Schema.Union(Schema.Number, Schema.String)
```

### 4.2 Discriminated Union

```typescript
// タグ付きUnion（推奨パターン）
const WeaponSchema = Schema.Struct({
  _tag: Schema.Literal('weapon'),
  damage: Schema.Number,
  durability: Schema.Number,
  enchantments: Schema.Array(EnchantmentSchema),
})

const ArmorSchema = Schema.Struct({
  _tag: Schema.Literal('armor'),
  defense: Schema.Number,
  durability: Schema.Number,
  slot: Schema.Literal('helmet', 'chestplate', 'leggings', 'boots'),
})

const ItemSchema = Schema.Union(WeaponSchema, ArmorSchema, FoodSchema)

// 型安全なパターンマッチング - Effect-TS Match.valueによる網羅的Tagged Union処理
const getItemValue = (item: typeof ItemSchema.Type): number => {
  import { Match } from 'effect'

  return Match.value(item).pipe(
    Match.tag('weapon', ({ damage }) => damage * 10),
    Match.tag('armor', ({ defense }) => defense * 15),
    Match.tag('food', ({ nutrition }) => nutrition * 5),
    Match.exhaustive // コンパイル時に全ケースの処理を保証
  )
}
```

## 5. エンコード・デコード

### 5.1 基本的な変換

```typescript
// デコード（unknown → 型）
const decodeUser = Schema.decodeUnknown(UserSchema)

// 使用例
const result = decodeUser({
  id: '123',
  name: 'Steve',
  age: 25,
  email: 'steve@minecraft.com',
})
// Either.right(user) または Either.left(ParseError)

// Effect内でのデコード
const decodeUserEffect = (data: unknown) =>
  pipe(
    Schema.decodeUnknown(UserSchema)(data),
    Effect.mapError((error) => new ValidationError({ details: error }))
  )
```

### 5.2 カスタム変換

```typescript
// 文字列 ↔ Date変換
const DateSchema = Schema.transform(Schema.String, Schema.DateFromSelf, {
  decode: (str) => new Date(str),
  encode: (date) => date.toISOString(),
})

// Base64エンコード/デコード
const Base64Schema = Schema.transform(Schema.String, Schema.String.pipe(Schema.brand('Base64')), {
  decode: (str) => Buffer.from(str).toString('base64'),
  encode: (base64) => Buffer.from(base64, 'base64').toString(),
})
```

## 6. Schema.TaggedError

### 6.1 エラー定義

```typescript
// タグ付きエラーの定義 (関数型パターン)
const InvalidBlockError = Schema.TaggedError('InvalidBlockError')({
  position: PositionSchema,
  blockType: Schema.String,
  reason: Schema.String,
})

const ChunkNotLoadedError = Schema.TaggedError('ChunkNotLoadedError')({
  chunkX: Schema.Int,
  chunkZ: Schema.Int,
})

// エラーのUnion型
type WorldError = InvalidBlockError | ChunkNotLoadedError
```

## 7. オプショナルとデフォルト値

### 7.1 オプショナルフィールド

```typescript
const ConfigSchema = Schema.Struct({
  // 必須フィールド
  serverName: Schema.String,
  port: Schema.Number,

  // オプショナル（undefined可能）
  description: Schema.optional(Schema.String),

  // オプショナルまたはnull
  maxPlayers: Schema.NullishOr(Schema.Number),

  // デフォルト値付き
  difficulty: Schema.optional(Schema.Literal('easy', 'normal', 'hard')).pipe(
    Schema.withDefault(() => 'normal' as const)
  ),
})
```

## 8. アノテーション

### 8.1 メタデータ付与

```typescript
const AnnotatedSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Player Name',
    description: 'The name of the player character',
    examples: ['Steve', 'Alex', 'Herobrine'],
    deprecated: false,
    documentation: 'https://docs.example.com/player-name',
  })
)

// アノテーションの取得
const annotations = Schema.annotations(AnnotatedSchema)
```

## 9. パフォーマンス最適化

### 9.1 遅延評価

```typescript
// 循環参照の解決 (改良版)
interface TreeNode {
  value: number
  children: ReadonlyArray<TreeNode>
}

// 再帰的スキーマの最新パターン
export const TreeNodeSchema: Schema.Schema<TreeNode> = Schema.Struct({
  value: Schema.Number,
  children: Schema.Array(Schema.suspend(() => TreeNodeSchema)),
})

// Minecraft特有の循環参照例
interface NestedContainer {
  name: string
  items: ReadonlyArray<Item>
  childContainers: ReadonlyArray<NestedContainer>
}

export const NestedContainerSchema: Schema.Schema<NestedContainer> = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(ItemSchema),
  childContainers: Schema.Array(Schema.suspend(() => NestedContainerSchema)),
})
```

### 9.2 メモ化とOpaqueパターン

```typescript
// 高コストなバリデーションのメモ化
const memoizedValidator = Schema.memoize(
  ComplexValidationSchema,
  (input) => JSON.stringify(input) // キー生成関数
)

// Opaque型パターン (最新機能)
declare const OpaqueSymbol: unique symbol
export interface OpaqueString<Tag> {
  readonly [OpaqueSymbol]: Tag
  readonly value: string
}

export const opaqueString = <Tag extends string>(tag: Tag) =>
  Schema.transform(
    Schema.String,
    Schema.Struct({
      [OpaqueSymbol]: Schema.Literal(tag),
      value: Schema.String,
    }),
    {
      decode: (str) => ({ [OpaqueSymbol]: tag, value: str }),
      encode: (opaque) => opaque.value,
    }
  )

// 使用例
export const SecretTokenSchema = opaqueString('SecretToken')
export type SecretToken = Schema.Schema.Type<typeof SecretTokenSchema>
```

## 10. 高度な型パターン

### 10.1 Newtype パターン

```typescript
// Newtype実装パターン
export const UserId = Schema.String.pipe(Schema.brand('UserId'))
export type UserId = Schema.Schema.Type<typeof UserId>

export const PlayerId = Schema.String.pipe(Schema.uuid(), Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

// ファクトリー関数
export const createUserId = (value: string): UserId => Schema.encodeSync(UserId)(value)

export const createPlayerId = (): PlayerId => Schema.encodeSync(PlayerId)(crypto.randomUUID())
```

### 10.2 高度なTransformパターン

```typescript
// 複雑なTransformロジック
export const CoordinateTransformSchema = Schema.transformOrFail(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  Schema.Struct({
    chunkX: Schema.Int,
    chunkZ: Schema.Int,
    localX: Schema.Int.pipe(Schema.between(0, 15)),
    localY: Schema.Int.pipe(Schema.between(0, 15)),
    localZ: Schema.Int.pipe(Schema.between(0, 15)),
  }),
  {
    decode: (worldPos) => {
      const chunkX = Math.floor(worldPos.x / 16)
      const chunkZ = Math.floor(worldPos.z / 16)
      const localX = worldPos.x - chunkX * 16
      const localY = worldPos.y
      const localZ = worldPos.z - chunkZ * 16

      if (localX < 0 || localX >= 16 || localZ < 0 || localZ >= 16) {
        return ParseResult.fail(new ParseResult.Type(Schema.String.ast, 'Invalid local coordinates'))
      }

      return ParseResult.succeed({
        chunkX,
        chunkZ,
        localX,
        localY,
        localZ,
      })
    },
    encode: (chunkPos) =>
      ParseResult.succeed({
        x: chunkPos.chunkX * 16 + chunkPos.localX,
        y: chunkPos.localY,
        z: chunkPos.chunkZ * 16 + chunkPos.localZ,
      }),
  }
)
```

## 11. 実践的な使用例

### 11.1 完全なエンティティスキーマ

```typescript
// Minecraftエンティティの完全定義
const EntitySchema = Schema.Struct({
  id: EntityIdSchema,
  type: Schema.Literal('player', 'zombie', 'skeleton', 'creeper'),
  position: ValidPositionSchema,
  velocity: VelocitySchema,
  health: HealthSchema,
  metadata: Schema.Record(Schema.String, Schema.Unknown),

  // 条件付きフィールド
  equipment: Schema.optional(
    Schema.Struct({
      mainHand: Schema.NullOr(ItemSchema),
      offHand: Schema.NullOr(ItemSchema),
      armor: Schema.Record(Schema.Literal('helmet', 'chestplate', 'leggings', 'boots'), Schema.NullOr(ArmorSchema)),
    })
  ),
}).pipe(Schema.brand('Entity'))

// バリデーションと型推論
type Entity = typeof EntitySchema.Type

const validateEntity = (data: unknown): Effect.Effect<Entity, ValidationError> =>
  pipe(
    Schema.decodeUnknown(EntitySchema)(data),
    Effect.mapError(
      (error) =>
        new ValidationError({
          message: 'Invalid entity data',
          details: TreeFormatter.formatErrorSync(error),
        })
    )
  )
```

## 11. 統合パターンライブラリ

> 📖 **使用箇所**: このセクションの各パターンは、プロジェクト全体で標準的に使用される定義集です。

### 11.1 基本Effect.genパターン

```typescript
// ✅ 標準的なEffect.gen合成パターン
const standardEffectPattern = Effect.gen(function* () {
  // 1. 依存関係の注入
  const service = yield* ServiceContext

  // 2. データ取得と検証
  const rawData = yield* fetchRawData()
  const validatedData = yield* Schema.decodeUnknown(DataSchema)(rawData)

  // 3. ビジネスロジック実行
  const result = yield* processData(validatedData)

  // 4. 副作用実行（ログ、保存等）
  yield* logOperation(result)
  yield* saveResult(result)

  return result
})

// ✅ エラーハンドリング統合パターン
const errorHandlingPattern = Effect.gen(function* () {
  const result = yield* riskyOperation().pipe(
    Effect.catchTags({
      NetworkError: (error) => Effect.succeed(defaultValue),
      ValidationError: (error) => Effect.fail(new ProcessingError({ cause: error })),
    })
  )
  return result
})
```

### 11.2 標準Schema定義パターン

```typescript
// ✅ プロジェクト全体で使用する基本エンティティSchema
export const StandardPlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.uuid(), Schema.brand('PlayerId')),
  name: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/),
    Schema.brand('PlayerName')
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int(), Schema.between(-30_000_000, 30_000_000)),
    y: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)),
    z: Schema.Number.pipe(Schema.int(), Schema.between(-30_000_000, 30_000_000)),
  }),
  health: Schema.Number.pipe(Schema.between(0, 20), Schema.brand('Health')),
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
})

// ✅ 標準的なエラー定義パターン
export const StandardErrors = {
  PlayerNotFoundError: Schema.TaggedError('PlayerNotFoundError')({
    playerId: Schema.String.pipe(Schema.brand('PlayerId')),
    message: Schema.String,
  }),
  ValidationError: Schema.TaggedError('ValidationError')({
    field: Schema.String,
    value: Schema.Unknown,
    message: Schema.String,
  }),
  NetworkError: Schema.TaggedError('NetworkError')({
    status: Schema.Number,
    url: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }),
}
```

### 11.3 Context.GenericTag標準パターン

```typescript
// ✅ サービス定義の標準パターン
export interface StandardPlayerService {
  readonly findById: (id: PlayerId) => Effect.Effect<Player, PlayerNotFoundError>
  readonly create: (data: CreatePlayerData) => Effect.Effect<Player, ValidationError>
  readonly update: (
    id: PlayerId,
    data: UpdatePlayerData
  ) => Effect.Effect<Player, PlayerNotFoundError | ValidationError>
}
export const StandardPlayerService = Context.GenericTag<StandardPlayerService>('@minecraft/PlayerService')

// ✅ Layer構築の標準パターン
export const StandardPlayerServiceLive = Layer.effect(
  StandardPlayerService,
  Effect.gen(function* () {
    const database = yield* DatabaseService
    const logger = yield* LoggerService

    return StandardPlayerService.of({
      findById: (id) => database.findPlayer(id),
      create: (data) =>
        Effect.gen(function* () {
          const validatedData = yield* Schema.decodeUnknown(CreatePlayerDataSchema)(data)
          const player = yield* database.createPlayer(validatedData)
          yield* logger.log(`Created player: ${player.name}`)
          return player
        }),
      update: (id, data) =>
        Effect.gen(function* () {
          const validatedData = yield* Schema.decodeUnknown(UpdatePlayerDataSchema)(data)
          const player = yield* database.updatePlayer(id, validatedData)
          yield* logger.log(`Updated player: ${id}`)
          return player
        }),
    })
  })
)
```

## 12. Opaque型パターンとセキュリティ強化

### 12.1 セキュリティ関連のOpaque型

```typescript
// Secret management with type safety
declare const SecretTokenSymbol: unique symbol
export interface SecretToken {
  readonly [SecretTokenSymbol]: true
  readonly value: string
  readonly expiresAt: Date
}

export const SecretTokenSchema = Schema.transform(
  Schema.Struct({
    token: Schema.String.pipe(
      Schema.minLength(32),
      Schema.maxLength(512),
      Schema.pattern(/^[A-Za-z0-9+/]+=*$/) // Base64 pattern
    ),
    expiresAt: Schema.DateFromSelf,
  }),
  Schema.Struct({
    [SecretTokenSymbol]: Schema.Literal(true),
    value: Schema.String,
    expiresAt: Schema.DateFromSelf,
  }),
  {
    decode: ({ token, expiresAt }) => ({
      [SecretTokenSymbol]: true as const,
      value: token,
      expiresAt,
    }),
    encode: (secret) => ({
      token: secret.value,
      expiresAt: secret.expiresAt,
    }),
  }
).pipe(
  Schema.annotations({
    identifier: 'SecretToken',
    title: 'Secret Token',
    description: 'Opaque wrapper for sensitive authentication tokens',
    security: 'Contains sensitive data - handle with care',
  })
)
export type SecretToken = Schema.Schema.Type<typeof SecretTokenSchema>

// Game currency with anti-tampering
declare const CurrencySymbol: unique symbol
export interface GameCurrency {
  readonly [CurrencySymbol]: true
  readonly amount: number
  readonly type: 'emerald' | 'diamond' | 'gold' | 'iron'
  readonly checksum: string
}

export const GameCurrencySchema = Schema.transformOrFail(
  Schema.Struct({
    amount: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    type: Schema.Union(
      Schema.Literal('emerald'),
      Schema.Literal('diamond'),
      Schema.Literal('gold'),
      Schema.Literal('iron')
    ),
  }),
  Schema.Struct({
    [CurrencySymbol]: Schema.Literal(true),
    amount: Schema.Number,
    type: Schema.String,
    checksum: Schema.String,
  }),
  {
    decode: ({ amount, type }, options, ast) => {
      const checksum = generateCurrencyChecksum(amount, type)
      return ParseResult.succeed({
        [CurrencySymbol]: true as const,
        amount,
        type,
        checksum,
      })
    },
    encode: (currency) => {
      const expectedChecksum = generateCurrencyChecksum(currency.amount, currency.type)
      if (currency.checksum !== expectedChecksum) {
        return ParseResult.fail(new ParseResult.Type(ast, currency))
      }
      return ParseResult.succeed({
        amount: currency.amount,
        type: currency.type as any,
      })
    },
  }
).pipe(
  Schema.annotations({
    identifier: 'GameCurrency',
    title: 'Game Currency',
    description: 'Tamper-resistant currency with integrity validation',
  })
)
export type GameCurrency = Schema.Schema.Type<typeof GameCurrencySchema>

// Checksum generation helper (実装例)
function generateCurrencyChecksum(amount: number, type: string): string {
  const data = `${amount}-${type}-${process.env.CURRENCY_SECRET || 'default-secret'}`
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)
}
```

### 12.2 Transform付きスキーマの高度な活用

```typescript
// Compressed world save data
export const CompressedSaveDataSchema = Schema.transformOrFail(
  Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Base64 encoded compressed save data',
    })
  ),
  Schema.Struct({
    world: WorldDataSchema,
    player: PlayerDataSchema,
    gameRules: GameRulesSchema,
    timestamp: Schema.DateFromSelf,
    version: Schema.String,
  }),
  {
    decode: (compressedData, options, ast) =>
      Effect.gen(function* () {
        try {
          // Base64 decode
          const binaryData = Buffer.from(compressedData, 'base64')

          // Decompress (using zlib or similar)
          const decompressed = yield* Effect.tryPromise({
            try: () => decompressData(binaryData),
            catch: (error) => new ParseResult.Type(ast, compressedData),
          })

          // Parse JSON
          const parsed = yield* Effect.try({
            try: () => JSON.parse(decompressed.toString('utf8')),
            catch: (error) => new ParseResult.Type(ast, compressedData),
          })

          return parsed
        } catch (error) {
          return yield* Effect.fail(new ParseResult.Type(ast, compressedData))
        }
      }),
    encode: (saveData) =>
      Effect.gen(function* () {
        try {
          // Serialize to JSON
          const jsonString = JSON.stringify(saveData)

          // Compress
          const compressed = yield* Effect.tryPromise({
            try: () => compressData(Buffer.from(jsonString, 'utf8')),
            catch: (error) => new ParseResult.Type(ast, saveData),
          })

          // Base64 encode
          return compressed.toString('base64')
        } catch (error) {
          return yield* Effect.fail(new ParseResult.Type(ast, saveData))
        }
      }),
  }
).pipe(
  Schema.annotations({
    identifier: 'CompressedSaveData',
    title: 'Compressed Save Data',
    description: 'World save data with automatic compression and decompression',
  })
)
export type CompressedSaveData = Schema.Schema.Type<typeof CompressedSaveDataSchema>

// Helper functions for compression (実装例)
async function compressData(data: Buffer): Promise<Buffer> {
  const zlib = await import('zlib')
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

async function decompressData(data: Buffer): Promise<Buffer> {
  const zlib = await import('zlib')
  return new Promise((resolve, reject) => {
    zlib.gunzip(data, (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}
```

### 12.3 パフォーマンス最適化Transform

```typescript
// Memoized expensive validation
export const createMemoizedSchema = <A, I, R>(
  baseSchema: Schema.Schema<A, I, R>,
  keyExtractor: (input: I) => string,
  cacheSize: number = 1000
) => {
  const cache = new Map<string, Either.Either<ParseResult.ParseError, A>>()

  return Schema.transformOrFail(
    baseSchema.pipe(Schema.annotations({ identifier: 'Input' })),
    baseSchema.pipe(Schema.annotations({ identifier: 'Output' })),
    {
      decode: (input, options, ast) => {
        const key = keyExtractor(input)

        if (cache.has(key)) {
          const cached = cache.get(key)!
          return cached._tag === 'Right' ? ParseResult.succeed(cached.right) : ParseResult.fail(cached.left)
        }

        const result = baseSchema.decode(input, options)

        // Cache management
        if (cache.size >= cacheSize) {
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }

        cache.set(key, result)
        return result
      },
      encode: (output) => baseSchema.encode(output),
    }
  ).pipe(
    Schema.annotations({
      identifier: 'MemoizedSchema',
      title: 'Memoized Schema',
      description: 'Schema with caching for expensive validation operations',
    })
  )
}

// Batch validation for arrays
export const createBatchSchema = <A, I, R>(itemSchema: Schema.Schema<A, I, R>, batchSize: number = 100) => {
  return Schema.transformOrFail(Schema.Array(itemSchema), Schema.Array(itemSchema), {
    decode: (items, options, ast) =>
      Effect.gen(function* () {
        const results: A[] = []

        // Process in batches to avoid stack overflow
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize)
          const batchResults = yield* Effect.forEach(batch, (item) => itemSchema.decode(item, options), {
            concurrency: 'unbounded',
          })
          results.push(...batchResults)
        }

        return results
      }),
    encode: (items) => Effect.forEach(items, (item) => itemSchema.encode(item), { concurrency: 'unbounded' }),
  }).pipe(
    Schema.annotations({
      identifier: 'BatchSchema',
      title: 'Batch Processing Schema',
      description: 'Array schema optimized for large datasets with batch processing',
    })
  )
}
```

### 12.4 実用例とベストプラクティス

```typescript
// Real-world usage examples
export const UserProfileSchema = Schema.Struct({
  id: PlayerIdSchema,
  credentials: SecretTokenSchema,
  currency: GameCurrencySchema,
  preferences: Schema.Struct({
    language: Schema.String.pipe(Schema.pattern(/^[a-z]{2}$/)),
    theme: Schema.Union(Schema.Literal('dark'), Schema.Literal('light')),
    notifications: Schema.Boolean,
  }),
  lastLoginAt: EventTimestampSchema,
  gameData: CompressedSaveDataSchema,
}).pipe(
  Schema.annotations({
    identifier: 'UserProfile',
    title: 'User Profile',
    description: 'Complete user profile with opaque security tokens and compressed data',
  })
)
export type UserProfile = Schema.Schema.Type<typeof UserProfileSchema>

// Performance monitoring
export const createInstrumentedSchema = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  metricsCollector: (operation: string, duration: number) => void
) => {
  return Schema.transformOrFail(schema, schema, {
    decode: (input, options, ast) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* schema.decode(input, options)
        const duration = performance.now() - start
        metricsCollector('decode', duration)
        return result
      }),
    encode: (output) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* schema.encode(output)
        const duration = performance.now() - start
        metricsCollector('encode', duration)
        return result
      }),
  })
}

// Enhanced Error handling with context
export const ValidationWithContextSchema = <A, I, R>(schema: Schema.Schema<A, I, R>, context: string) =>
  Schema.transformOrFail(schema, schema, {
    decode: (input, options, ast) =>
      schema
        .decode(input, options)
        .pipe(Effect.mapError((error) => new ParseResult.Type(ast, input, `[${context}] ${error.message}`))),
    encode: (output) => schema.encode(output),
  }).pipe(
    Schema.annotations({
      identifier: `${schema.ast.annotations?.identifier || 'Unknown'}WithContext`,
      description: `${schema.ast.annotations?.description || ''} (Enhanced with context: ${context})`,
    })
  )
```

## 13. 最新Schema機能とパフォーマンス

### 13.1 Schema Composition パターン

```typescript
// 基本Schemaの合成
const BaseEntitySchema = Schema.Struct({
  id: Schema.String.pipe(Schema.uuid(), Schema.brand('EntityId')),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

// 継承的合成
const PlayerBaseSchema = Schema.Struct({
  ...BaseEntitySchema.fields,
  name: PlayerNameSchema,
  position: PositionSchema,
})

const FullPlayerSchema = Schema.Struct({
  ...PlayerBaseSchema.fields,
  inventory: InventorySchema,
  stats: PlayerStatsSchema,
  permissions: PermissionsSchema,
})
```

### 13.2 効率的なValidationパターン

```typescript
// 段階的バリデーション（パフォーマンス重視）
const efficientPlayerValidation = (data: unknown) =>
  Effect.gen(function* () {
    // 第1段階: 基本構造チェック
    const basicData = yield* Schema.decodeUnknown(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        position: Schema.Unknown, // 詳細チェックは後で
      })
    )(data)

    // 第2段階: 詳細バリデーション（必要な場合のみ）
    if (basicData.name.length > 16) {
      return yield* Effect.fail(
        new ValidationError({
          field: 'name',
          message: 'Name too long',
          value: basicData.name,
        })
      )
    }

    // 第3段階: 完全バリデーション
    return yield* Schema.decodeUnknown(FullPlayerSchema)(data)
  })

// バッチバリデーション
const validatePlayerBatch = (players: readonly unknown[]) =>
  Effect.forEach(players, (playerData) => Schema.decodeUnknown(PlayerSchema)(playerData), { concurrency: 'unbounded' })
```

## APIリファレンス仕様

### 主要な型定義

```typescript
// Schema型の基本構造
interface Schema<Type, Encoded = Type, Context = never> {
  readonly Type: Type
  readonly Encoded: Encoded
  readonly Context: Context
}

// デコード関数の型
type DecodeUnknown<A> = (u: unknown) => Either<ParseError, A>
type DecodeUnknownSync<A> = (u: unknown) => A // エラー時は例外
```

## 次のステップ

- **Context API**: [Context API リファレンス](./effect-ts-context-api.md)
- **データモデリング**: [データモデリングパターン](../explanations/design-patterns/03-data-modeling-patterns.md)
- **エラー処理**: [エラーハンドリング](../explanations/architecture/06c-effect-ts-error-handling.md)
