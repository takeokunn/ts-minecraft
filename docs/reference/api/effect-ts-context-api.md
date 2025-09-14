---
title: "Effect-TS Context API リファレンス"
description: "Context.GenericTagとLayerを使用した依存性注入のAPIリファレンス"
category: "reference"
difficulty: "advanced"
tags: ["effect-ts", "context", "dependency-injection", "api-reference", "layer"]
prerequisites: ["effect-ts-patterns", "typescript-advanced"]
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Effect-TS Context API リファレンス

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [リファレンス](./README.md) → **Context API**
>
> **🎯 学習目標**: Context APIの完全な仕様と使用方法
>
> **⏱️ 所要時間**: 15分
>
> **📚 前提知識**: Effect-TSパターン、TypeScript型システム

### 📋 関連ドキュメント
- **概念説明**: [Effect-TSパターン](../01-architecture/06-effect-ts-patterns.md)
- **実装ガイド**: [サービス設計](../01-architecture/06b-effect-ts-services.md)
- **Schema API**: [Schema API](./effect-ts-schema-api.md)

---

## 1. Context.GenericTag API

### 1.1 基本定義

```typescript
import { Context } from "effect"

// TypeScript Minecraft標準: @app/ServiceNameネームスペース (関数型パターン)
const ServiceName = Context.GenericTag<ServiceInterface>("@app/ServiceName")

// サービスインターフェース定義
interface ServiceInterface {
  readonly method1: (param: Type1) => Effect.Effect<Result1, Error1>
  readonly method2: (param: Type2) => Result2
  readonly property: ReadonlyProperty
}
```

### 1.2 型パラメータ

| パラメータ | 説明 | 必須 |
|----------|------|------|
| `Self` | サービスタグ自身の型 | ✅ |
| `Service` | サービスが提供するインターフェース | ✅ |

### 1.3 使用例

```typescript
// Minecraftワールドサービス (関数型パターン)
interface WorldServiceInterface {
  readonly getChunk: (x: number, z: number) => Effect.Effect<Chunk, ChunkError>
  readonly setBlock: (pos: Position, block: Block) => Effect.Effect<void, BlockError>
  readonly save: () => Effect.Effect<void, SaveError>
}

const WorldService = Context.GenericTag<WorldServiceInterface>("@app/WorldService")

// インベントリサービス (関数型パターン)
interface InventoryServiceInterface {
  readonly addItem: (item: Item, count: number) => Effect.Effect<void, InventoryFullError>
  readonly removeItem: (slot: number) => Effect.Effect<Item, SlotEmptyError>
  readonly getItems: () => Effect.Effect<ReadonlyArray<Item>>
}

const InventoryService = Context.GenericTag<InventoryServiceInterface>("@app/InventoryService")
```

## 2. Layer API

### 2.1 Layer生成メソッド

```typescript
import { Layer, Effect } from "effect"

// Layer.succeed - 同期的な値でサービスを提供
const ServiceLive = Layer.succeed(
  ServiceTag,
  serviceImplementation
)

// Layer.effect - Effectから非同期にサービスを生成
const ServiceLive = Layer.effect(
  ServiceTag,
  Effect.gen(function* () {
    const dependency = yield* DependencyService
    return createService(dependency)
  })
)

// Layer.scoped - リソース管理を伴うサービス
const ServiceLive = Layer.scoped(
  ServiceTag,
  Effect.gen(function* () {
    const resource = yield* acquireResource()
    yield* Effect.addFinalizer(() => releaseResource(resource))
    return createServiceWithResource(resource)
  })
)

// Layer.fail - エラーを持つLayer
const ServiceFailed = Layer.fail(ServiceTag, new ServiceError())
```

### 2.2 Layer合成

```typescript
// 垂直合成 - 依存関係の解決
const AppLayer = Layer.provide(
  ServiceALayer,
  ServiceBLayer // ServiceAがServiceBに依存
)

// 水平合成 - 複数サービスの提供
const CombinedLayer = Layer.merge(
  ServiceALayer,
  ServiceBLayer
)

// 複数の依存関係
const AppLayer = Layer.provideMerge(
  MainServiceLayer,
  Layer.merge(
    DependencyALayer,
    DependencyBLayer
  )
)
```

### 2.3 実装例

```typescript
// Minecraftゲームサービスのレイヤー構成
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const connection = await connectDB(config.dbUrl)
    return {
      query: (sql) => Effect.tryPromise(() => connection.query(sql)),
      close: () => Effect.tryPromise(() => connection.close())
    }
  })
)

const WorldServiceLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    const db = yield* Database
    const cache = yield* CacheService

    return {
      getChunk: (x, z) =>
        pipe(
          cache.get(`chunk_${x}_${z}`),
          Effect.orElse(() =>
            pipe(
              db.query(`SELECT * FROM chunks WHERE x = ? AND z = ?`, [x, z]),
              Effect.tap(chunk => cache.set(`chunk_${x}_${z}`, chunk))
            )
          )
        ),
      setBlock: (pos, block) =>
        pipe(
          Effect.Do,
          Effect.bind("chunk", () => getChunk(pos.chunkX, pos.chunkZ)),
          Effect.tap(({ chunk }) => chunk.setBlock(pos, block)),
          Effect.tap(() => cache.invalidate(`chunk_${pos.chunkX}_${pos.chunkZ}`))
        ),
      save: () =>
        pipe(
          cache.flush(),
          Effect.flatMap(() => db.query("COMMIT"))
        )
    }
  })
)

// 完全なアプリケーションレイヤー
const AppLive = Layer.provide(
  WorldServiceLive,
  Layer.merge(DatabaseLive, CacheServiceLive)
)
```

## 3. サービスアクセスパターン

### 3.1 Effect.gen内でのアクセス

```typescript
const program = Effect.gen(function* () {
  // サービスの取得
  const world = yield* WorldService
  const inventory = yield* InventoryService

  // サービスメソッドの呼び出し
  const chunk = yield* world.getChunk(0, 0)
  yield* inventory.addItem(diamondSword, 1)
})
```

### 3.2 pipe演算子でのアクセス

```typescript
const program = pipe(
  WorldService,
  Effect.flatMap(world => world.getChunk(0, 0)),
  Effect.flatMap(chunk => processChunk(chunk))
)
```

### 3.3 サービスの部分適用

```typescript
// サービスメソッドの抽出
const getChunk = Effect.serviceFunctionEffect(
  WorldService,
  (service) => service.getChunk
)

// 使用
const program = pipe(
  getChunk(0, 0),
  Effect.map(processChunk)
)
```

## 4. 高度なパターン

### 4.1 サービスファクトリー

```typescript
// サービスファクトリー (関数型パターン)
interface ServiceFactoryInterface {
  readonly create: <T>(config: Config<T>) => Effect.Effect<T>
}

const ServiceFactory = Context.GenericTag<ServiceFactoryInterface>("@app/ServiceFactory")

const ServiceFactoryLive = Layer.succeed(
  ServiceFactory,
  {
    create: (config) =>
      Effect.gen(function* () {
        const dependencies = yield* resolveDependencies(config)
        return createServiceInstance(config, dependencies)
      })
  }
)
```

### 4.2 条件付きサービス提供

```typescript
const ConditionalServiceLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    if (config.useCache) {
      return CachedServiceLive
    } else {
      return DirectServiceLive
    }
  })
)
```

### 4.3 サービスデコレーター

```typescript
const withLogging = <R, E, A>(
  layer: Layer.Layer<A, E, R>
): Layer.Layer<A, E, R> =>
  Layer.tap(layer, (service) =>
    Effect.gen(function* () {
      yield* Effect.log(`Service ${service.constructor.name} initialized`)
      // メソッドをラップしてログを追加
      Object.keys(service).forEach(key => {
        const original = service[key]
        if (typeof original === 'function') {
          service[key] = (...args: any[]) =>
            pipe(
              Effect.log(`Calling ${key} with`, args),
              Effect.flatMap(() => original(...args)),
              Effect.tap((result) => Effect.log(`${key} returned`, result))
            )
        }
      })
    })
  )

// 使用例
const LoggedWorldServiceLive = withLogging(WorldServiceLive)
```

## 5. 型シグネチャ仕様

### 5.1 Context.GenericTag完全型定義

```typescript
// GenericTag型定義 (関数型インターフェース)
interface GenericTag<Identifier extends string, Service> {
  readonly _tag: Identifier
  readonly Type: Service
  readonly pipe: <B>(f: (a: this) => B) => B
}
```

### 5.2 Layer型定義

```typescript
interface Layer<ROut, E = never, RIn = never> {
  readonly _RIn: RIn   // 入力依存
  readonly _E: E       // エラー型
  readonly _ROut: ROut // 出力サービス
}
```

## 6. ベストプラクティス

### 命名規約

- サービスタグ: `@app/ServiceName` 形式
- Layer実装: `ServiceNameLive`、`ServiceNameTest`
- ファクトリー: `ServiceNameFactory`

### パフォーマンス考慮

- Layerは一度だけ評価される（メモ化）
- 重いリソースは`Layer.scoped`で管理
- 循環依存を避ける設計

### エラー処理

- サービス初期化エラーは`Layer.effect`内で処理
- 実行時エラーはサービスメソッドの戻り値で表現

## 次のステップ

- **Schema API**: [Schema API リファレンス](./effect-ts-schema-api.md)
- **実装例**: [サービスパターン](../07-pattern-catalog/01-service-patterns.md)
- **テスト**: [サービステスト](../03-guides/07-effect-ts-testing-patterns.md)