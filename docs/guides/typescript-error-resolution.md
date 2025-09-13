# TypeScript Error Resolution Guide

## 概要

このドキュメントは、TypeScript MinecraftプロジェクトにおけるTypeScriptコンパイルエラーの解決ガイドです。Effect-TSベースのDDDアーキテクチャ移行に伴う型エラーとその解決方法を記載しています。

## 現在のエラー状況

### エラー分類

プロジェクトにおける主要なTypeScriptエラーは以下のカテゴリに分類されます：

1. **Effect型の不一致** - Effect型のエラーパラメータの不整合
2. **Layerの構成エラー** - DI LayerとServiceの型不一致
3. **コンストラクタ呼び出しエラー** - `new`キーワードの欠落
4. **型パラメータの不一致** - ジェネリック型の不整合

## 一般的なエラーパターンと解決方法

### 1. Effect型のエラー伝播問題

#### エラーパターン
```typescript
// ❌ エラー: Effect<void, never, never> に Effect<void, SomeError, Service> を代入できない
const handler = Effect.gen(function* () {
  const service = yield* SomeService
  yield* service.operation() // この操作がエラーを返す可能性がある
})
```

#### 解決方法
```typescript
// ✅ 正しい: エラーを適切に処理
const handler = Effect.gen(function* () {
  const service = yield* SomeService
  yield* service.operation()
}).pipe(
  Effect.catchTag('SomeError', (error) =>
    Effect.logError(`Operation failed: ${error.message}`)
  ),
  Effect.catchAll(() => Effect.unit) // すべてのエラーを処理
)
```

### 2. Layer構成の型不一致

#### エラーパターン
```typescript
// ❌ エラー: Layer<Service, never, never> がプロパティを欠いている
export const ServiceLive: Layer.Layer<ServiceType> = Layer.effect(
  ServiceTag,
  Effect.succeed({
    // プロパティが不足
  })
)
```

#### 解決方法
```typescript
// ✅ 正しい: すべての必須プロパティを実装
export const ServiceLive = Layer.effect(
  ServiceTag,
  Effect.gen(function* () {
    const dependency = yield* DependencyService

    return ServiceTag.of({
      method1: (param) => Effect.succeed(result),
      method2: (param) => Effect.succeed(result),
      // すべての必須メソッドを実装
    })
  })
)
```

### 3. エラークラスのコンストラクタ問題

#### エラーパターン
```typescript
// ❌ エラー: Value is not callable. Did you mean to include 'new'?
Effect.fail(ValidationError({ message: "Invalid input" }))
```

#### 解決方法
```typescript
// ✅ 正しい: newキーワードを使用
Effect.fail(new ValidationError({ message: "Invalid input" }))
```

### 4. ジェネリック型パラメータの問題

#### エラーパターン
```typescript
// ❌ エラー: 型パラメータが一致しない
interface Service<T> {
  process: (input: T) => Effect.Effect<void, never>
}

const impl: Service<string> = {
  process: (input: number) => Effect.unit // 型が一致しない
}
```

#### 解決方法
```typescript
// ✅ 正しい: 型パラメータを一致させる
const impl: Service<string> = {
  process: (input: string) => Effect.unit
}
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