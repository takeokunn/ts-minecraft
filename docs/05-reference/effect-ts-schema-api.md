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

### 基本的なスキーマ定義

```typescript
import { Schema } from "effect"

// プリミティブ型
const StringSchema = Schema.String
const NumberSchema = Schema.Number
const BooleanSchema = Schema.Boolean

// 構造化されたデータ
const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
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

### 3. 非同期バリデーションの実装

```typescript
import { Context, Effect, Schema, ParseResult, Layer } from "effect"

// 外部バリデーションサービス
class ValidationService extends Context.Tag("ValidationService")<
  ValidationService,
  {
    readonly validateBlockId: (id: string) => Effect.Effect<void, Error>
  }
>() {}

// ブランド化されたスキーマ
const BlockId = Schema.String.pipe(Schema.brand("BlockId"))

// 非同期変換スキーマ
const BlockIdFromString = Schema.transformOrFail(
  Schema.String,
  BlockId,
  {
    strict: true,
    decode: (s, _, ast) =>
      Effect.gen(function* () {
        const validator = yield* ValidationService
        yield* validator.validateBlockId(s)
        return s
      }).pipe(
        Effect.mapError((e) => new ParseResult.Type(ast, s, e.message))
      ),
    encode: ParseResult.succeed
  }
)

// サービス実装
const ValidationServiceLive = Layer.succeed(ValidationService, {
  validateBlockId: (id) =>
    id.startsWith("block_")
      ? Effect.void
      : Effect.fail(new Error("Invalid block ID format"))
})

// 使用例
const validateBlockId = Effect.gen(function* () {
  const result = yield* Schema.decodeUnknown(BlockIdFromString)("block_001")
  return result
}).pipe(Effect.provide(ValidationServiceLive))

Effect.runPromise(validateBlockId).then(console.log)
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

### エラーハンドリングパターン

```typescript
import { Schema, ParseResult } from "effect"

const PlayerSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  level: Schema.Number.pipe(Schema.positive())
})

// Either を使用した安全なデコード
const decodePlayer = (input: unknown) => {
  const result = Schema.decodeUnknownEither(PlayerSchema)(input)

  if (result._tag === "Left") {
    console.error("バリデーションエラー:", result.left.message)
    return null
  }

  return result.right
}

// Effect を使用した非同期エラーハンドリング
const decodePlayerAsync = (input: unknown) =>
  Schema.decodeUnknown(PlayerSchema)(input).pipe(
    Effect.catchAll((error) => {
      console.error("デコードエラー:", error.message)
      return Effect.succeed(null)
    })
  )
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