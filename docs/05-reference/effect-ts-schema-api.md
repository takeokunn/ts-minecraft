---
title: "Effect-TS 3.17+ Schema API完全リファレンス - Schema.Struct + タイプセーフティ"
description: "Effect-TS 3.17+ Schemaの完全APIリファレンス。Schema.Struct、Context.GenericTag統合、Match.value活用、早期リターンパターン対応データバリデーション。"
category: "reference"
difficulty: "advanced"
tags: ["effect-ts", "schema", "validation", "type-safety", "data-transformation", "schema-struct", "context-generic-tag", "match-patterns", "branded-types"]
prerequisites: ["effect-ts-basics", "schema-patterns", "context-patterns"]
estimated_reading_time: "45分"
dependencies: ["@effect/schema", "@effect/match"]
status: "complete"
---

# Effect-TS Schema API リファレンス

## 概要

Effect-TS Schemaは、TypeScriptアプリケーションにおけるデータバリデーション、変換、型安全性を提供する強力なライブラリです。関数型プログラミングの原則に基づき、宣言的で合成可能なスキーマ定義を通じて、ランタイムでのデータ整合性を保証します。

### 主な利点

- **型安全性**: コンパイル時とランタイムの両方で型チェックを提供
- **宣言的**: スキーマを直感的で読みやすい形で定義
- **合成可能**: 複雑なスキーマを小さなスキーマから構築
- **エラーハンドリング**: 詳細で理解しやすいエラーメッセージ
- **非同期対応**: 外部サービスとの統合やAsync/Awaitパターンに対応
- **標準準拠**: Standard Schema V1仕様に準拠

## 基本API

### 基本的なSchema.Struct定義パターン

```typescript
import { Schema } from "effect"

// プリミティブ型（Effect-TS 3.17+推奨）
const StringSchema = Schema.String
const NumberSchema = Schema.Number
const BooleanSchema = Schema.Boolean

// Schema.Structによる構造化データ定義
const Person = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PersonId")),
  name: Schema.String.pipe(Schema.minLength(1)),
  age: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  isActive: Schema.Boolean,
  createdAt: Schema.Date,
  profile: Schema.optional(Schema.Struct({
    bio: Schema.String,
    avatar: Schema.String.pipe(Schema.startsWith("https://"))
  }))
})

// 型の抽出
type PersonType = typeof Person.Type

// ブランド化されたIDの活用
const UserId = Schema.String.pipe(Schema.brand("UserId"))
const PostId = Schema.String.pipe(Schema.brand("PostId"))

// 階層化された構造
const Address = Schema.Struct({
  street: Schema.String,
  city: Schema.String,
  country: Schema.String,
  zipCode: Schema.String.pipe(Schema.pattern(/^\d{5}(-\d{4})?$/))
})

const UserProfile = Schema.Struct({
  user: Person,
  address: Address,
  preferences: Schema.Struct({
    theme: Schema.Literal("light", "dark"),
    language: Schema.Literal("en", "ja", "es", "fr"),
    notifications: Schema.Boolean
  })
})
```

### バリデーション付きスキーマ

```typescript
import { Schema } from "effect"

// 文字列の長さ制限
const NonEmptyString = Schema.String.pipe(Schema.nonEmptyString())
const MaxLengthString = Schema.String.pipe(Schema.maxLength(10))

// 数値の範囲制限
const PositiveNumber = Schema.Number.pipe(Schema.positive())
const IntegerSchema = Schema.Number.pipe(Schema.int())

// 複合バリデーション
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
)
```

### データ変換スキーマ

```typescript
import { Schema } from "effect"

// 文字列から数値への変換
const NumberFromString = Schema.NumberFromString

// 日付の変換
const DateFromString = Schema.DateFromString

// カスタム変換
const TrimmedString = Schema.String.pipe(Schema.trimmed())
```

## 実装例

### 1. 基本的なオブジェクト検証

```typescript
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.NonEmptyString,
  age: Schema.Number.pipe(Schema.positive()),
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  )
})

// 使用例
const validatePerson = Schema.decodeUnknownSync(Person)

try {
  const validPerson = validatePerson({
    name: "John Doe",
    age: 30,
    email: "john@example.com"
  })
  console.log(validPerson)
} catch (error) {
  console.error("バリデーションエラー:", error)
}
```

### 2. KeyValueStoreでの型安全なデータ管理

```typescript
import {
  KeyValueStore,
  layerMemory
} from "@effect/platform/KeyValueStore"
import { Effect, Schema } from "effect"

// スキーマ定義
const Player = Schema.Struct({
  id: Schema.String,
  name: Schema.NonEmptyString,
  level: Schema.Number.pipe(Schema.positive()),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
})

const program = Effect.gen(function* () {
  // スキーマベースのストア作成
  const kv = (yield* KeyValueStore).forSchema(Player)

  // データの保存（自動バリデーション）
  const playerData = {
    id: "player1",
    name: "Steve",
    level: 5,
    position: { x: 100, y: 64, z: 200 }
  }

  yield* kv.set("player1", playerData)

  // データの取得
  const retrievedPlayer = yield* kv.get("player1")
  console.log(retrievedPlayer)
})

Effect.runPromise(program.pipe(Effect.provide(layerMemory)))
```

### 3. 非同期バリデーション - Context.GenericTag + Match.value

```typescript
import { Context, Effect, Schema, ParseResult, Layer, Match } from "effect"

// Schema.Structを使用したエラー定義
class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String,
  reason: Schema.Literal("invalid-format", "not-found", "access-denied"),
  value: Schema.String
}) {}

// Context.GenericTagによる外部バリデーションサービス
class ValidationService extends Context.GenericTag("ValidationService")<{
  validateBlockId: (id: string) => Effect.Effect<void, ValidationError>
  validateUserId: (id: string) => Effect.Effect<void, ValidationError>
  validateBatchIds: (ids: string[]) => Effect.Effect<void, ValidationError>
}>() {}

// ブランド化されたスキーマ
const BlockId = Schema.String.pipe(Schema.brand("BlockId"))
const UserId = Schema.String.pipe(Schema.brand("UserId"))

// Match.valueによる型別バリデーション
const validateIdByType = (id: string, type: "block" | "user") =>
  Effect.gen(function* () {
    const validator = yield* ValidationService

    yield* Match.value(type).pipe(
      Match.when("block", () => validator.validateBlockId(id)),
      Match.when("user", () => validator.validateUserId(id)),
      Match.exhaustive
    )

    return id
  })

// 非同期変換スキーマ（早期リターンパターン）
const BlockIdFromString = Schema.transformOrFail(
  Schema.String,
  BlockId,
  {
    strict: true,
    decode: (s, _, ast) =>
      Effect.gen(function* () {
        // 早期リターン：基本フォーマットチェック
        if (!s.startsWith("block_") || s.length < 7) {
          return yield* Effect.fail(new ValidationError({
            field: "blockId",
            reason: "invalid-format",
            value: s
          }))
        }

        // 詳細バリデーション
        const validator = yield* ValidationService
        yield* validator.validateBlockId(s)

        return s as typeof BlockId.Type
      }).pipe(
        Effect.mapError((e) => new ParseResult.Type(ast, s, e.message))
      ),
    encode: ParseResult.succeed
  }
)

// バッチバリデーション用スキーマ
const BatchValidationRequest = Schema.Struct({
  ids: Schema.Array(Schema.String).pipe(Schema.minItems(1), Schema.maxItems(100)),
  type: Schema.Literal("block", "user"),
  skipInvalid: Schema.Boolean.pipe(Schema.optional())
})

// Context.GenericTagサービス実装
const ValidationServiceLive = Layer.succeed(
  ValidationService,
  ValidationService.of({
    validateBlockId: (id) =>
      Match.value({ id, valid: id.startsWith("block_") && id.length >= 7 }).pipe(
        Match.when({ valid: true }, () => Effect.void),
        Match.orElse(() =>
          Effect.fail(new ValidationError({
            field: "blockId",
            reason: "invalid-format",
            value: id
          }))
        )
      ),

    validateUserId: (id) =>
      Match.value({ id, valid: /^user_[a-zA-Z0-9]{8,}$/.test(id) }).pipe(
        Match.when({ valid: true }, () => Effect.void),
        Match.orElse(() =>
          Effect.fail(new ValidationError({
            field: "userId",
            reason: "invalid-format",
            value: id
          }))
        )
      ),

    validateBatchIds: (ids) =>
      Effect.forEach(
        ids,
        id => validateIdByType(id, id.startsWith("block_") ? "block" : "user"),
        { concurrency: 5 }
      ).pipe(Effect.void)
  })
)

// 使用例
const validateBlockIdExample = Effect.gen(function* () {
  const result = yield* Schema.decodeUnknown(BlockIdFromString)("block_001")
  console.log("Valid block ID:", result)
  return result
}).pipe(
  Effect.provide(ValidationServiceLive),
  Effect.catchAll(error =>
    Effect.sync(() => console.error("Validation failed:", error))
  )
)

// バッチ処理の使用例
const batchValidationExample = Effect.gen(function* () {
  const request = {
    ids: ["block_001", "block_002", "user_12345678"],
    type: "block" as const,
    skipInvalid: false
  }

  const validatedRequest = yield* Schema.decodeUnknown(BatchValidationRequest)(request)
  const validator = yield* ValidationService

  yield* validator.validateBatchIds(validatedRequest.ids)
  console.log("All IDs validated successfully")
}).pipe(Effect.provide(ValidationServiceLive))
```

### 4. スキーマクラスによる型安全なエンティティ

```typescript
import { Schema } from "effect"

class InventoryItem extends Schema.Class<InventoryItem>("InventoryItem")({
  id: Schema.String,
  type: Schema.Literal("block", "item", "tool"),
  quantity: Schema.Number.pipe(Schema.positive()),
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
}) {}

// 使用例
try {
  const item = new InventoryItem({
    id: "diamond_sword",
    type: "tool",
    quantity: 1,
    metadata: { durability: 100, enchantments: ["sharpness"] }
  })

  console.log(item)
} catch (error) {
  console.error("インスタンス作成エラー:", error)
}
```

### 5. ワールドデータ構造の検証

```typescript
import { Schema } from "effect"

const ChunkData = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  blocks: Schema.Array(Schema.Struct({
    x: Schema.Number.pipe(Schema.between(0, 15)),
    y: Schema.Number.pipe(Schema.between(0, 255)),
    z: Schema.Number.pipe(Schema.between(0, 15)),
    type: Schema.String,
    metadata: Schema.optional(Schema.Unknown)
  })),
  biome: Schema.String,
  generated: Schema.Boolean
})

const WorldData = Schema.Struct({
  name: Schema.NonEmptyString,
  seed: Schema.String,
  chunks: Schema.Array(ChunkData),
  spawnPoint: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator"),
  difficulty: Schema.Literal("peaceful", "easy", "normal", "hard")
})

// 使用例
const validateWorldData = Schema.decodeUnknownSync(WorldData)
```

## バリデーション

### エラーハンドリングパターン - Match.value + 早期リターン

```typescript
import { Schema, ParseResult, Match, Exit, Effect } from "effect"

// Schema.Structを使用した型安全なプレイヤー定義
const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(Schema.minLength(1)),
  level: Schema.Number.pipe(Schema.int(), Schema.positive()),
  status: Schema.Literal("online", "offline", "away"),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

class PlayerValidationError extends Schema.TaggedError<PlayerValidationError>()("PlayerValidationError", {
  field: Schema.String,
  received: Schema.Unknown,
  expected: Schema.String
}) {}

// Match.valueを使用した型安全なデコード
const decodePlayer = (input: unknown) =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(Schema.decodeUnknown(Player)(input))

    return yield* Match.value(result).pipe(
      Match.when(Exit.isSuccess, exit => Effect.succeed(exit.value)),
      Match.when(Exit.isFailure, exit =>
        Effect.gen(function* () {
          console.error("Validation failed:", exit.cause)
          return yield* Effect.fail(new PlayerValidationError({
            field: "root",
            received: input,
            expected: "Valid Player object"
          }))
        })
      ),
      Match.exhaustive
    )
  })

// Either を使用した同期的バリデーション（早期リターンパターン）
const decodePlayerSync = (input: unknown): Player.Type | null => {
  const result = Schema.decodeUnknownEither(Player)(input)

  return Match.value(result).pipe(
    Match.when({ _tag: "Right" }, result => result.right),
    Match.when({ _tag: "Left" }, result => {
      console.error("Synchronous validation error:", result.left.message)
      return null
    }),
    Match.exhaustive
  )
}

// 段階的バリデーション（複数レベルのエラーハンドリング）
const validatePlayerWithDetails = (input: unknown) =>
  Effect.gen(function* () {
    // 基本構造のチェック
    const basicStructure = yield* Effect.exit(
      Schema.decodeUnknown(Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        level: Schema.Number
      }))(input)
    )

    if (Exit.isFailure(basicStructure)) {
      return yield* Effect.fail(new PlayerValidationError({
        field: "structure",
        received: input,
        expected: "Object with id, name, level fields"
      }))
    }

    // 詳細バリデーション
    const fullValidation = yield* Effect.exit(Schema.decodeUnknown(Player)(input))

    return yield* Match.value(fullValidation).pipe(
      Match.when(Exit.isSuccess, exit => Effect.succeed(exit.value)),
      Match.when(Exit.isFailure, exit => {
        // 特定フィールドのエラー詳細を抽出
        const cause = exit.cause
        const fieldErrors = extractFieldErrors(cause)

        return Effect.fail(new PlayerValidationError({
          field: fieldErrors.field || "unknown",
          received: fieldErrors.received,
          expected: fieldErrors.expected
        }))
      }),
      Match.exhaustive
    )
  })

// エラー詳細抽出ヘルパー
const extractFieldErrors = (cause: any) => ({
  field: cause.errors?.[0]?.path?.join('.') || "unknown",
  received: cause.errors?.[0]?.actual,
  expected: cause.errors?.[0]?.message || "Valid value"
})

// バッチバリデーション（部分的成功対応）
const validatePlayerBatch = (inputs: unknown[]) =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(
      inputs,
      (input, index) =>
        Effect.exit(Schema.decodeUnknown(Player)(input)).pipe(
          Effect.map(exit => ({ index, exit, input }))
        ),
      { concurrency: 5 }
    )

    const { successes, failures } = results.reduce(
      (acc, { index, exit, input }) => {
        if (Exit.isSuccess(exit)) {
          acc.successes.push({ index, data: exit.value })
        } else {
          acc.failures.push({ index, input, error: exit.cause })
        }
        return acc
      },
      { successes: [] as any[], failures: [] as any[] }
    )

    return {
      successes,
      failures,
      totalProcessed: results.length,
      successRate: successes.length / results.length
    }
  })
```

### カスタムエラーメッセージ

```typescript
import { Schema } from "effect"

const CustomValidatedSchema = Schema.String
  .pipe(
    Schema.nonEmptyString({
      message: () => "名前は必須です"
    })
  )
  .pipe(
    Schema.maxLength(50, {
      message: (issue) => `名前は50文字以下にしてください（現在: ${String(issue.actual).length}文字）`
    })
  )
```

## ベストプラクティス

### 1. スキーマの合成と再利用

```typescript
import { Schema } from "effect"

// 基本スキーマの定義
const PositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const IdentifiableSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EntityId"))
})

// スキーマの合成
const EntitySchema = Schema.extend(IdentifiableSchema, Schema.Struct({
  position: PositionSchema,
  health: Schema.Number.pipe(Schema.between(0, 100))
}))

const PlayerEntitySchema = Schema.extend(EntitySchema, Schema.Struct({
  name: Schema.NonEmptyString,
  inventory: Schema.Array(Schema.Unknown)
}))
```

### 2. 段階的バリデーション

```typescript
import { Schema, Effect } from "effect"

// 段階的にバリデーションを適用
const validateInventoryItem = (input: unknown) =>
  Effect.gen(function* () {
    // 基本構造の検証
    const basicItem = yield* Schema.decodeUnknown(Schema.Struct({
      type: Schema.String,
      quantity: Schema.Number
    }))(input)

    // 型固有のバリデーション
    if (basicItem.type === "tool") {
      return yield* Schema.decodeUnknown(Schema.Struct({
        type: Schema.Literal("tool"),
        quantity: Schema.Literal(1), // ツールは1個のみ
        durability: Schema.Number.pipe(Schema.between(0, 100))
      }))(input)
    }

    // デフォルトバリデーション
    return yield* Schema.decodeUnknown(Schema.Struct({
      type: Schema.String,
      quantity: Schema.Number.pipe(Schema.positive())
    }))(input)
  })
```

### 3. パフォーマンス最適化

```typescript
import { Schema } from "effect"

// 同期的なバリデーションを優先
const syncSchema = Schema.Struct({
  name: Schema.String,
  level: Schema.Number
})

// 非同期が必要な場合のみ使用
const asyncSchema = Schema.transformOrFail(
  syncSchema,
  Schema.Struct({
    name: Schema.NonEmptyString,
    level: Schema.Number.pipe(Schema.positive())
  }),
  {
    decode: (input) => Effect.succeed(input), // 可能な限り同期的に
    encode: Effect.succeed
  }
)

// 並行実行の活用
const concurrentSchema = Schema.Tuple(
  Schema.String,
  Schema.Number,
  Schema.Boolean
).annotations({
  concurrency: "unbounded" // 並行バリデーション
})
```

### 4. テスト可能な設計

```typescript
import { Schema, Effect } from "effect"

// テスト用のモックサービス
const createMockValidationService = (shouldSucceed: boolean) =>
  Layer.succeed(ValidationService, {
    validateBlockId: (_) =>
      shouldSucceed ? Effect.void : Effect.fail(new Error("Mock error"))
  })

// テストでの使用
const testValidation = (input: string, shouldSucceed: boolean) =>
  Schema.decodeUnknown(BlockIdFromString)(input).pipe(
    Effect.provide(createMockValidationService(shouldSucceed))
  )
```

### 5. 型安全な設定管理

```typescript
import { Schema, Config, Effect } from "effect"

// 設定スキーマの定義
const ServerConfigSchema = Schema.Struct({
  host: Schema.String.pipe(Schema.nonEmptyString()),
  port: Schema.Number.pipe(Schema.between(1, 65535)),
  maxPlayers: Schema.Number.pipe(Schema.positive()),
  worldName: Schema.String.pipe(Schema.minLength(1))
})

// 環境変数からの設定読み込み
const serverConfig = Config.all({
  host: Config.string("HOST").pipe(Config.withDefault("localhost")),
  port: Config.integer("PORT").pipe(Config.withDefault(25565)),
  maxPlayers: Config.integer("MAX_PLAYERS").pipe(Config.withDefault(20)),
  worldName: Config.string("WORLD_NAME").pipe(Config.withDefault("world"))
}).pipe(
  Config.validate(ServerConfigSchema)
)
```

このリファレンスは、Minecraft TypeScriptプロジェクトにおけるEffect-TS Schemaの効果的な使用方法を示しています。型安全性、エラーハンドリング、パフォーマンス、テスタビリティを重視した実装パターンを採用することで、堅牢で保守性の高いコードベースを構築できます。