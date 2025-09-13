# TypeScript Error Resolution Guide

## 概要

このドキュメントは、TypeScript MinecraftプロジェクトにおけるTypeScriptコンパイルエラーの解決ガイドです。最新のEffect-TSパターン（2024年版）とSchema-baseエラー定義によるDDDアーキテクチャ移行に伴う型エラーとその解決方法を記載しています。

## 現在のエラー状況

### エラー分類

プロジェクトにおける主要なTypeScriptエラーは以下のカテゴリに分類されます：

1. **Schema検証エラー** - Schema.Structとバリデーション関連の不整合
2. **Context.GenericTag型エラー** - "@app/ServiceName"パターンの型不一致
3. **Match式の網羅性エラー** - Match.exhaustiveの型安全性
4. **早期リターンパターンエラー** - 条件分岐での型推論問題
5. **純粋関数の副作用エラー** - Effect分離での型不整合

## 一般的なエラーパターンと解決方法

### 1. Schema検証エラーの解決

#### エラーパターン
```typescript
// ❌ エラー: Schema.Structの型不一致
const UserData = Data.struct<{ name: string; age: number }>({
  name: "",
  age: 0
})

const validateUser = (input: unknown): Effect.Effect<UserData, ValidationError> =>
  Effect.succeed(input as UserData) // 危険な型キャスト
```

#### 解決方法
```typescript
// ✅ 正しい: Schema.Structによる安全なバリデーション
const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number.pipe(Schema.int(), Schema.positive())
})

type User = Schema.Schema.Type<typeof UserSchema>

const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  message: Schema.String,
  field: Schema.optional(Schema.String)
})

type ValidationError = Schema.Schema.Type<typeof ValidationError>

const validateUser = (input: unknown): Effect.Effect<User, ValidationError> =>
  Schema.decodeUnknownEither(UserSchema)(input).pipe(
    Effect.mapError(error => ({
      _tag: "ValidationError" as const,
      message: "User validation failed",
      field: error.path?.toString()
    }))
  )
```

### 2. Context.GenericTagパターンの型エラー

#### エラーパターン
```typescript
// ❌ エラー: 古いContext.Tag使用パターン
const ServiceTag = Context.Tag<ServiceInterface>()

export const ServiceLive: Layer.Layer<ServiceInterface> = Layer.effect(
  ServiceTag,
  Effect.succeed({
    // プロパティが不足
  })
)
```

#### 解決方法
```typescript
// ✅ 正しい: "@app/ServiceName"パターンで型安全なService定義
interface GameServiceInterface {
  readonly startGame: (config: GameConfig) => Effect.Effect<void, GameError>
  readonly stopGame: () => Effect.Effect<void, never>
  readonly getState: () => Effect.Effect<GameState, never>
}

const GameService = Context.GenericTag<GameServiceInterface>("@app/GameService")

const makeGameServiceLive = Effect.gen(function* () {
  const worldService = yield* WorldService
  const playerService = yield* PlayerService

  return GameService.of({
    startGame: (config) => Effect.gen(function* () {
      // 早期リターン: 設定検証
      if (!config.worldConfig) {
        return yield* Effect.fail({
          _tag: "GameError" as const,
          message: "World config is required"
        })
      }

      yield* worldService.initialize(config.worldConfig)
      yield* playerService.spawn(config.playerConfig)
    }),

    stopGame: () => Effect.gen(function* () {
      yield* worldService.cleanup()
      yield* playerService.despawn()
    }),

    getState: () => Effect.gen(function* () {
      const worldState = yield* worldService.getState()
      const playerState = yield* playerService.getState()
      return { world: worldState, player: playerState }
    })
  })
})

const GameServiceLive = Layer.effect(GameService, makeGameServiceLive)
```

### 3. Match式の網羅性エラー

#### エラーパターン
```typescript
// ❌ エラー: switch文での型安全性不足
const handleAction = (action: GameAction): Effect.Effect<void> => {
  switch (action.type) {
    case "MOVE":
      return handleMove(action)
    case "ATTACK":
      return handleAttack(action)
    // 他のケースが漏れている
  }
}
```

#### 解決方法
```typescript
// ✅ 正しい: Match.exhaustiveによる網羅性保証
import { Match } from "effect"

type GameAction =
  | { readonly _tag: "Move"; readonly direction: Direction; readonly playerId: string }
  | { readonly _tag: "Attack"; readonly target: EntityId; readonly playerId: string }
  | { readonly _tag: "UseItem"; readonly item: ItemId; readonly playerId: string }

const handleAction = (action: GameAction): Effect.Effect<void, GameError> =>
  Match.value(action).pipe(
    Match.tag("Move", ({ direction, playerId }) =>
      Effect.gen(function* () {
        // 早期リターン: プレイヤー検証
        const player = yield* findPlayer(playerId)
        if (!player) {
          return yield* Effect.fail({
            _tag: "GameError" as const,
            message: "Player not found"
          })
        }
        yield* movePlayer(player, direction)
      })
    ),
    Match.tag("Attack", ({ target, playerId }) => handleAttack(target, playerId)),
    Match.tag("UseItem", ({ item, playerId }) => handleUseItem(item, playerId)),
    Match.exhaustive // コンパイル時に全ケース網羅を保証
  )
```

### 4. 早期リターンパターンの型推論エラー

#### エラーパターン
```typescript
// ❌ エラー: 条件分岐での型推論が失敗
const processData = (input: unknown): Effect.Effect<ProcessedData, ValidationError> => {
  if (!input) {
    return Effect.fail(new ValidationError({ message: "Input is required" })) // 型エラー
  }

  // 処理続行
  return Effect.succeed(processInput(input))
}
```

#### 解決方法
```typescript
// ✅ 正しい: 早期リターンでのyield*使用
const processData = (input: unknown): Effect.Effect<ProcessedData, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 入力検証
    if (!input) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "Input is required"
      })
    }

    // 型ガードでの安全な処理
    if (typeof input !== "object" || input === null) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "Input must be an object"
      })
    }

    // バリデーション済みデータでの処理続行
    return yield* processValidInput(input)
  })
```

### 5. 純粋関数の副作用分離エラー

#### エラーパターン
```typescript
// ❌ エラー: 純粋関数内での副作用
const calculateDistance = (from: Position, to: Position): number => {
  console.log("Calculating distance") // 副作用が混入
  return Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
}
```

#### 解決方法
```typescript
// ✅ 正しい: 純粋関数とEffect操作の分離
const calculateDistance = (from: Position, to: Position): number =>
  Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)

const calculateDistanceWithLogging = (
  from: Position,
  to: Position
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    yield* Effect.log("Calculating distance")
    const distance = calculateDistance(from, to)
    yield* Effect.log(`Distance calculated: ${distance}`)
    return distance
  })
```

## レイヤー別エラー解決戦略

### Application Layer

Application層では、ユースケースとハンドラーのエラー型を適切に管理する必要があります：

```typescript
// Command Handler の正しい実装パターン
export const CommandHandlersLive = Layer.effect(
  CommandHandlersTag,
  Effect.gen(function* () {
    const playerMoveUseCase = yield* PlayerMoveUseCase
    const blockPlaceUseCase = yield* BlockPlaceUseCase

    return CommandHandlersTag.of({
      handlePlayerMovement: (command) =>
        playerMoveUseCase.execute(command).pipe(
          Effect.catchTags({
            EntityNotFoundError: () => Effect.logWarning("Entity not found"),
            ChunkNotLoadedError: () => Effect.logWarning("Chunk not loaded"),
          }),
          Effect.catchAll(() => Effect.unit)
        ),

      handleBlockInteraction: (command) =>
        blockPlaceUseCase.execute(command).pipe(
          Effect.catchAll(() => Effect.unit)
        ),
    })
  })
)
```

### Domain Layer

Domain層では純粋な関数とEffect型を使用：

```typescript
// Domain Service の正しい実装パターン
export interface WorldDomainService {
  readonly getEntity: (id: EntityId) => Effect.Effect<Entity, EntityNotFoundError>
  readonly updateEntity: (entity: Entity) => Effect.Effect<void, ValidationError>
}

export const WorldDomainServiceLive = Layer.succeed(
  WorldDomainServiceTag,
  WorldDomainServiceTag.of({
    getEntity: (id) =>
      Effect.gen(function* () {
        const entity = yield* findEntity(id)
        if (!entity) {
          return yield* Effect.fail(new EntityNotFoundError({ entityId: id }))
        }
        return entity
      }),

    updateEntity: (entity) =>
      Effect.gen(function* () {
        const isValid = yield* validateEntity(entity)
        if (!isValid) {
          return yield* Effect.fail(new ValidationError({ entity }))
        }
        yield* saveEntity(entity)
      })
  })
)
```

### Infrastructure Layer

Infrastructure層ではアダプターパターンでエラーを変換：

```typescript
// Adapter の正しい実装パターン
export const RepositoryAdapterLive = Layer.effect(
  RepositoryPortTag,
  Effect.gen(function* () {
    const storage = yield* StorageService

    return RepositoryPortTag.of({
      save: (data) =>
        storage.persist(data).pipe(
          Effect.mapError((error) =>
            new RepositoryError({ cause: error, operation: 'save' })
          )
        ),

      load: (id) =>
        storage.retrieve(id).pipe(
          Effect.mapError((error) =>
            new RepositoryError({ cause: error, operation: 'load' })
          )
        )
    })
  })
)
```

## 型チェックコマンド

### 基本的な型チェック
```bash
# 全体の型チェック
pnpm type-check

# 特定のレイヤーのみチェック
pnpm type-check:domain
pnpm type-check:application
pnpm type-check:infrastructure
```

### エラーの詳細表示
```bash
# エラーの詳細を表示
pnpm type-check --verbose

# 特定ファイルのエラーのみ表示
pnpm type-check | grep "command.handler"
```

## トラブルシューティング

### 1. Effect型の推論が効かない場合

型アノテーションを明示的に追加：

```typescript
// 型推論が効かない場合
const result = Effect.gen(function* () {
  // ...
})

// 明示的に型を指定
const result: Effect.Effect<ReturnType, ErrorType, Requirements> =
  Effect.gen(function* () {
    // ...
  })
```

### 2. Layerの依存関係が複雑な場合

依存関係を段階的に構築：

```typescript
// 複雑な依存関係を段階的に構築
const baseLayers = Layer.mergeAll(
  ConfigLive,
  LoggerLive
)

const domainLayers = Layer.mergeAll(
  WorldDomainServiceLive,
  EntityDomainServiceLive
).pipe(Layer.provide(baseLayers))

const applicationLayers = Layer.mergeAll(
  UseCasesLive,
  HandlersLive
).pipe(Layer.provide(domainLayers))
```

### 3. 循環依存の解決

ポートパターンを使用して循環を防ぐ：

```typescript
// ポートを定義して循環を防ぐ
export interface ServiceAPort {
  operationA: () => Effect.Effect<void>
}

export interface ServiceBPort {
  operationB: () => Effect.Effect<void>
}

// 各サービスはポートに依存
export const ServiceALive = Layer.effect(
  ServiceATag,
  Effect.gen(function* () {
    const serviceB = yield* ServiceBPort
    // 実装
  })
)
```

## ベストプラクティス

### 1. エラー型の明示

すべてのEffect操作でエラー型を明示的に定義：

```typescript
// ✅ 良い例：エラー型が明確
export const operation = (): Effect.Effect<
  Result,
  ValidationError | NetworkError,
  Dependencies
> => {
  // 実装
}
```

### 2. タグ付きエラーの活用

エラーをタグ付きクラスとして定義し、パターンマッチングで処理：

```typescript
// エラー定義
export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly url: string
  readonly statusCode: number
}> {}

// エラー処理
Effect.catchTag('NetworkError', (error) => {
  console.log(`Network error at ${error.url}: ${error.statusCode}`)
  return Effect.succeed(defaultValue)
})
```

### 3. Layer構成の整理

Layerは責務ごとに分割し、明確な依存関係を維持：

```typescript
// 責務ごとにLayerを分割
export const CoreLayer = Layer.mergeAll(
  ConfigLive,
  LoggerLive
)

export const DomainLayer = Layer.mergeAll(
  EntityServiceLive,
  WorldServiceLive
)

export const AppLayer = DomainLayer.pipe(
  Layer.provideMerge(CoreLayer)
)
```

## 参考リソース

- [Effect-TS公式ドキュメント](https://effect.website/)
- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/tsconfig#strict)
- [Effect-TS Error Handling](https://effect.website/docs/guides/error-handling)
- [Effect-TS Layer System](https://effect.website/docs/guides/dependency-injection)