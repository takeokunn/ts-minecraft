# Effect-TSリファクタリング 実行計画書

## 📊 要求概要

**目的**: TypeScript Minecraft Clone全体を完全関数型プログラミングにリファクタリングし、Effect-TSの高度機能を活用した高速・堅牢なシステムを構築する。

**スコープ**:

- 876 TypeScriptファイル（約182,000行）の全面改修
- 型安全性優先（`as`/`any`/`unknown`/`!` 撲滅）
- 完全関数型化（`class`/`Data.Class`廃止、`if`/`else`/`try`/`catch`/`for`のEffect-TS化）
- 高度なEffect-TS機能導入（Fiber, STM, Queue, Resource等）

**戦略**:

- **質問1回答**: D (型安全性優先型) - `as`/`any`/`unknown`撲滅最優先
- **質問2回答**: C (アグレッシブアプローチ) - Fiber, STM, Queue等を積極活用
- **質問3回答**: C (完全関数型) - `Data.Class`も廃止、`Schema.Struct` + pure function

---

## 🔍 現状分析

### コードベース統計

| 項目                               | 現状        | リファクタリング対象 |
| ---------------------------------- | ----------- | -------------------- |
| **TypeScriptファイル数**           | 876         | 全ファイル           |
| **総コード行数**                   | ~182,000行  | 全コード             |
| **`any`/`unknown`使用**            | 958箇所     | 完全削除             |
| **`as`型アサーション**             | 2,581箇所   | 完全削除             |
| **`class`使用**                    | 172箇所     | `Schema.Struct`化    |
| **`Data.Class`使用**               | 3箇所       | `Schema.Struct`化    |
| **`for`ループ**                    | 4ファイル   | `Effect.forEach`化   |
| **`try-catch`**                    | 5ファイル   | `Effect.try`化       |
| **`Promise`/`async`/`await`**      | 131箇所     | `Effect.promise`化   |
| **`new Date()`**                   | 10+ファイル | `DateTime`化         |
| **非バレルエクスポート`index.ts`** | 複数        | バレルエクスポート化 |

### 既存Effect-TS活用状況

✅ **既に実装済み**:

- Effect v3.18.2, @effect/schema v0.75.5採用
- Layer/Service/Schema/Brand型の部分的使用
- 一部でFiber, Schedule, Queue使用（20ファイル）
- `src/domain/shared/effect/control.ts`にカスタムEffect-TSヘルパー実装

❌ **未実装・不統一**:

- STM（Software Transactional Memory）未使用
- Resource Pool管理が一部のみ
- 型アサーション多用による型安全性の弱体化
- 命令型構文の残存

---

## 🎯 機能要件

### FR-1: 完全型安全化

**優先度**: 🔴 最高優先

#### FR-1.1: 全`as`型アサーション（2,581箇所）を削除

- Brand型、ADT（Algebraic Data Types）、Schema.Structで置き換え
- 型推論で解決できない箇所はSchemaによるランタイム検証追加

#### FR-1.2: 全`any`/`unknown`/`!`（958箇所）を具体的な型に置き換え

- `unknown`は`Schema.decodeUnknown`でバリデーション
- Non-null assertion (`!`) は`Option`型で表現

#### FR-1.3: Brand型の徹底活用

- プリミティブ型の混同防止（`EntityId`, `WorldId`, `ChunkId`等）
- 既存の50+ Brand型定義を全コードベースで統一使用

### FR-2: 完全関数型化

**優先度**: 🔴 最高優先

#### FR-2.1: 全`class`（172箇所）を`Schema.Struct` + pure functionに変換

- Aggregate Root → `Schema.Struct` + 操作関数群
- Value Object → `Schema.Struct` + Brand型
- Entity → `Schema.Struct` + `_tag`によるADT

#### FR-2.2: `Data.Class`（3箇所）を`Schema.Struct`に変換

- `PlayerCamera`, `Sensitivity`等を`Schema.Struct`化
- 構造的等価性は`Equal.equals`で明示的実装

#### FR-2.3: 全制御構文のEffect-TS化

- `if`/`else` → `Match.value` / `pipe`
- `switch` → `Match.tag` / `Match.type`
- `for` → `Effect.forEach` / `ReadonlyArray.map`
- `while` → `Effect.repeat` / `Effect.iterate`
- `try`/`catch` → `Effect.try` / `Effect.catchAll`

#### FR-2.4: 全`Promise`/`async`/`await`（131箇所）をEffect化

- `async function` → `Effect.gen`
- `await promise` → `Effect.promise`
- `Promise.all` → `Effect.all`

### FR-3: 高度Effect-TS機能導入

**優先度**: 🟡 高優先

#### FR-3.1: Fiber活用による並行処理最適化

- チャンク生成の並列化（`Fiber.fork` / `Fiber.await`）
- バックグラウンドタスク管理（`Fiber.interruptible`）

#### FR-3.2: STM（Software Transactional Memory）導入

- 共有状態管理（ワールド状態、プレイヤー状態）
- 競合検出と自動リトライ

#### FR-3.3: Queue活用によるイベント駆動アーキテクチャ強化

- ゲームイベントキュー（`Queue.bounded` / `Queue.unbounded`）
- バックプレッシャー制御

#### FR-3.4: Resource Pool管理

- チャンクプール（`Pool.make`）
- テクスチャ・メッシュのリソース管理（`Scope` + `acquireRelease`）

#### FR-3.5: Stream処理

- 大量データのストリーミング処理（チャンクデータ、イベントログ）
- バックプレッシャー付き非同期処理

### FR-4: DateTime型への統一

**優先度**: 🟢 中優先

#### FR-4.1: 全`new Date()`（10+箇所）を`DateTime`に変更

- `@effect/platform/DateTime`使用
- タイムスタンプ型をBrand化（`Timestamp`, `Milliseconds`）

### FR-5: バレルエクスポート統一

**優先度**: 🟢 中優先

#### FR-5.1: 全`index.ts`をバレルエクスポート専用化

- ロジック実装を排除
- `export * from './xxx'` / `export { ... } from './xxx'` のみ

#### FR-5.2: ディレクトリ構造最適化

- 1ファイル1責任原則の徹底
- 深すぎるネストの解消

---

## ⚙️ 非機能要件

### NFR-1: パフォーマンス

**目標**: 60FPS維持、メモリ使用量<2GB（既存プロジェクト要件）

#### NFR-1.1: Effect-TSのオーバーヘッド最小化

- ホットパス（ゲームループ、レンダリング）では軽量なEffect操作のみ
- Fiber/STMの過剰使用を避ける

#### NFR-1.2: 遅延評価とメモ化

- `Effect.suspend`による遅延実行
- `Cache.make`によるメモ化

#### NFR-1.3: ストリーミング処理によるメモリ効率化

- `Stream.grouped`でバッチ処理
- `Stream.mapEffect`で段階的処理

### NFR-2: 型安全性

**目標**: 100%型安全（`any`/`unknown`/`as`完全撲滅）

#### NFR-2.1: strictモード強化

- `strict: true`維持
- `noUncheckedIndexedAccess: true`維持

#### NFR-2.2: Schemaによるランタイム検証

- 外部入力（API、ファイル、IndexedDB）を全てSchema検証
- `Schema.decodeUnknown`で型安全保証

### NFR-3: テスタビリティ

**目標**: 80%+ カバレッジ維持（既存プロジェクト要件）

#### NFR-3.1: 純粋関数による単体テスト容易性

- 全ロジックを純粋関数化
- Effect-TSの`@effect/vitest`活用

#### NFR-3.2: Layer/Serviceによるモック容易性

- 全依存をLayerで注入
- テスト用MockLayer作成

---

## 🏗️ 技術仕様

### TS-1: 型システム設計

#### TS-1.1: Brand型パターン

```typescript
// ✅ 推奨パターン
import { Schema } from '@effect/schema'

export const EntityId = Schema.String.pipe(Schema.uuid(), Schema.brand('EntityId'))
export type EntityId = Schema.Schema.Type<typeof EntityId>

export const WorldId = Schema.String.pipe(Schema.pattern(/^world_[a-z0-9_]+$/), Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldId>
```

#### TS-1.2: ADT（Algebraic Data Types）パターン

```typescript
// ✅ 推奨: Schema.Union + _tag
export const GameEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerJoined'),
    playerId: PlayerIdSchema,
    timestamp: TimestampSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('BlockPlaced'),
    position: Position3DSchema,
    blockType: BlockTypeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ChunkLoaded'),
    chunkId: ChunkIdSchema,
  })
)
export type GameEvent = Schema.Schema.Type<typeof GameEvent>

// ✅ パターンマッチング
const handleEvent = (event: GameEvent): Effect.Effect<void, never> =>
  Match.value(event).pipe(
    Match.tag('PlayerJoined', (e) => Effect.log(`Player joined: ${e.playerId}`)),
    Match.tag('BlockPlaced', (e) => placeBlock(e.position, e.blockType)),
    Match.tag('ChunkLoaded', (e) => Effect.log(`Chunk loaded: ${e.chunkId}`)),
    Match.exhaustive
  )
```

#### TS-1.3: Aggregate Root変換パターン

```typescript
// ❌ 現在のData.Class実装
export class PlayerCamera extends Data.Class<{
  readonly camera: Camera
  readonly playerId: PlayerId
  // ...
}> {}

// ✅ リファクタリング後: Schema.Struct + pure functions
export const PlayerCameraSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerCamera'),
  camera: CameraSchema,
  playerId: PlayerIdSchema,
  settings: PlayerCameraSettingsSchema,
  inputAccumulator: MouseDeltaSchema,
  lastPlayerPosition: Schema.OptionFromSelf(Position3DSchema),
  isFollowing: Schema.Boolean,
  collisionEnabled: Schema.Boolean,
})
export type PlayerCamera = Schema.Schema.Type<typeof PlayerCameraSchema>

// ✅ 操作関数（純粋関数）
export const handleMouseInput = (
  playerCamera: PlayerCamera,
  deltaX: number,
  deltaY: number
): Effect.Effect<PlayerCamera, CameraError> =>
  Effect.gen(function* () {
    const sensitivityX = playerCamera.settings.sensitivity.mouse.x
    const sensitivityY = playerCamera.settings.sensitivity.mouse.y

    const adjustedDeltaY = playerCamera.settings.invertY ? -deltaY : deltaY
    const rotationDeltaX = deltaX * sensitivityX
    const rotationDeltaY = adjustedDeltaY * sensitivityY

    const currentRotation = playerCamera.camera.rotation
    const newPitch = Math.max(-90, Math.min(90, currentRotation.pitch + rotationDeltaY))
    const newYaw = (currentRotation.yaw + rotationDeltaX) % 360

    const newRotation = yield* createCameraRotationSafe(newPitch, newYaw, currentRotation.roll)
    const smoothedRotation = applyRotationSmoothing(
      currentRotation,
      newRotation,
      playerCamera.settings.smoothing.rotation
    )

    const updatedCamera = yield* updateCameraRotation(playerCamera.camera, smoothedRotation)

    return {
      ...playerCamera,
      camera: updatedCamera,
      inputAccumulator: accumulateMouseInput(playerCamera.inputAccumulator, deltaX, deltaY),
    }
  })
```

### TS-2: 制御構文変換パターン

#### TS-2.1: if/else → Match/pipe

```typescript
// ❌ Before
if (playerCamera.isFollowing) {
  return updatePosition(playerCamera, playerPosition)
} else {
  return Effect.succeed(playerCamera)
}

// ✅ After: Match.value
Match.value(playerCamera.isFollowing).pipe(
  Match.when(true, () => updatePosition(playerCamera, playerPosition)),
  Match.when(false, () => Effect.succeed(playerCamera)),
  Match.exhaustive
)

// ✅ Alternative: pipe + Effect.if
pipe(
  playerCamera.isFollowing,
  Effect.if({
    onTrue: () => updatePosition(playerCamera, playerPosition),
    onFalse: () => Effect.succeed(playerCamera),
  })
)
```

#### TS-2.2: for → Effect.forEach

```typescript
// ❌ Before
for (const chunk of chunks) {
  await processChunk(chunk)
}

// ✅ After: 逐次処理
yield *
  Effect.forEach(chunks, (chunk) => processChunk(chunk), {
    concurrency: 1,
  })

// ✅ Alternative: 並列処理
yield *
  Effect.forEach(chunks, processChunk, {
    concurrency: 10,
  })
```

#### TS-2.3: try/catch → Effect.try

```typescript
// ❌ Before
try {
  const data = JSON.parse(rawData)
  return processData(data)
} catch (error) {
  return handleError(error)
}

// ✅ After
pipe(
  Effect.try({
    try: () => JSON.parse(rawData),
    catch: (error) => new ParseError({ cause: error }),
  }),
  Effect.flatMap(processData),
  Effect.catchAll(handleError)
)
```

### TS-3: 高度Effect-TS機能パターン

#### TS-3.1: Fiber並行処理

```typescript
// ✅ バックグラウンドチャンク生成
export const generateChunksInBackground = (
  chunkIds: ReadonlyArray<ChunkId>
): Effect.Effect<Fiber.RuntimeFiber<ReadonlyArray<Chunk>, ChunkGenerationError>> =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.forEach(chunkIds, generateChunk, { concurrency: 4 }))
    return fiber
  })

// ✅ Fiber待機と結果取得
const chunks = yield * Fiber.await(fiber)
```

#### TS-3.2: STM（並行トランザクション）

```typescript
import { STM, TRef } from 'effect'

// ✅ 共有状態管理
export const createWorldState = Effect.gen(function* () {
  const loadedChunks = yield* TRef.make<ReadonlyMap<ChunkId, Chunk>>(new Map())
  const activePlayers = yield* TRef.make<ReadonlySet<PlayerId>>(new Set())

  return { loadedChunks, activePlayers }
})

// ✅ トランザクショナルな更新
export const addPlayerToWorld = (state: WorldState, playerId: PlayerId): Effect.Effect<void, never> =>
  STM.commit(
    STM.gen(function* () {
      const current = yield* TRef.get(state.activePlayers)
      yield* TRef.set(state.activePlayers, new Set([...current, playerId]))
    })
  )
```

#### TS-3.3: Queue活用

```typescript
import { Queue } from 'effect'

// ✅ イベントキュー
export const createGameEventQueue = Effect.gen(function* () {
  const queue = yield* Queue.bounded<GameEvent>(1000)
  return queue
})

// ✅ イベント発行
yield *
  Queue.offer(eventQueue, {
    _tag: 'PlayerJoined',
    playerId,
    timestamp,
  })

// ✅ イベント処理
yield * Queue.take(eventQueue).pipe(Effect.flatMap(handleEvent), Effect.forever)
```

#### TS-3.4: Resource Pool

```typescript
import { Pool } from 'effect'

// ✅ チャンクプール
export const ChunkPoolLive = Layer.effect(
  ChunkPool,
  Effect.gen(function* () {
    const pool = yield* Pool.make({
      acquire: createChunk(),
      size: 100,
    })

    return ChunkPool.of({
      acquire: Pool.get(pool),
      release: (chunk) => Pool.invalidate(pool, chunk),
    })
  })
)
```

#### TS-3.5: Stream処理

```typescript
import { Stream } from 'effect'

// ✅ 大量チャンクデータのストリーミング処理
export const processChunkStream = (chunkIds: Stream.Stream<ChunkId>): Effect.Effect<void, ChunkError> =>
  pipe(
    chunkIds,
    Stream.mapEffect(loadChunk),
    Stream.grouped(10), // 10個ずつバッチ処理
    Stream.mapEffect(processBatch),
    Stream.runDrain
  )
```

### TS-4: DateTime統一

```typescript
import { DateTime } from '@effect/platform'

// ❌ Before
const now = new Date()
const timestamp = Date.now()

// ✅ After
const now = yield * DateTime.now
const timestamp = DateTime.toEpochMillis(now)

// ✅ Brand型統合
export const Timestamp = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('Timestamp'))
export type Timestamp = Schema.Schema.Type<typeof Timestamp>
```

---

## 📊 実現可能性評価

### 技術的実現可能性: **45/100** ⚠️

**根拠**:

- ✅ Effect-TSは技術的に成熟（v3系安定版）
- ✅ 既存コードベースで部分的に実装済み
- ❌ **規模が極めて大**（876ファイル、182,000行）
- ❌ **既存の正常動作コードを大量破壊**（`Data.Class`等）
- ❌ 3Dゲームのリアルタイム性能要件とEffect-TSのオーバーヘッドの両立困難

### 忖度回避度: **95/100** 🔴

**根拠**:

- ✅ 技術的妥当性を最優先
- ✅ ユーザー要望（完全関数型化）より現実的制約を重視
- ⚠️ **本要件定義は極めて高リスク**を明示

---

## 🚧 制約事項

### CO-1: プロジェクト規模による制約

#### CO-1.1: 全ファイル一括変更は**レビュー不可能**

- 推奨: 20-30ファイルずつに分割して段階的に実施

#### CO-1.2: 既存テストの大量破壊

- 現在19テスト → 全て書き直し必要
- カバレッジ80%維持は困難

#### CO-1.3: 開発期間の長期化

- 想定: 3-6ヶ月（フルタイム換算）

### CO-2: パフォーマンス制約

#### CO-2.1: ゲームループ（60FPS）への影響

- Effect-TSのオーバーヘッドがフレーム落ちを引き起こす可能性
- ホットパスでの最適化が必須

#### CO-2.2: メモリ使用量増加リスク

- Immutableデータ構造による一時オブジェクト増加
- Fiber/Queue/STMのメモリオーバーヘッド

### CO-3: 学習コスト制約

#### CO-3.1: Fiber/STMは高度な概念

- チーム全体の学習コスト
- メンテナンス性の低下リスク

#### CO-3.2: デバッグ困難性

- Effect-TSのスタックトレースは複雑
- 既存のデバッグツールが使いづらい

### CO-4: 既存資産の破壊

#### CO-4.1: 正常動作中の`Data.Class`実装削除

- `PlayerCamera`等の再実装コスト
- 構造的等価性の再実装

#### CO-4.2: 既存ドキュメントとの乖離

- `docs/`配下のドキュメント全面更新必要

---

## 🧪 テスト要件

### TR-1: 単体テスト

#### TR-1.1: 全pure functionに単体テスト

- `@effect/vitest`活用
- テストカバレッジ80%+維持

#### TR-1.2: Schema検証テスト

- 正常系・異常系の境界値テスト
- ランタイムバリデーションの網羅

### TR-2: 統合テスト

#### TR-2.1: Layer統合テスト

- Mock Layer / Live Layerの切り替えテスト

### TR-3: パフォーマンステスト

#### TR-3.1: フレームレート計測

- ゲームループ60FPS維持確認
- Effect-TSオーバーヘッド測定

#### TR-3.2: メモリプロファイリング

- メモリ使用量<2GB確認
- メモリリーク検出

---

## ⚠️ 重大な懸念事項

### 懸念1: 段階的リファクタリング戦略の欠如

**問題**: 本計画は**一括全面改修**を前提としていますが、876ファイル・182,000行の同時変更は現実的に不可能です。

**推奨**: 以下の段階的アプローチを検討すべき:

1. **Phase 1**: 型安全化のみ（`as`/`any`撲滅） → 他は現状維持
2. **Phase 2**: 制御構文のEffect-TS化 → `class`は維持
3. **Phase 3**: `class`の`Schema.Struct`化
4. **Phase 4**: 高度Effect-TS機能導入

### 懸念2: パフォーマンス計測の事前実施

**問題**: Effect-TSの高度機能（Fiber/STM/Queue）のオーバーヘッドが60FPS維持に影響するか不明。

**推奨**: 小規模プロトタイプで事前検証:

- ゲームループ（最ホットパス）でのEffect-TSオーバーヘッド測定
- Fiber/STMの実行時コスト測定

### 懸念3: `Data.Class`完全廃止の妥当性

**問題**: `Data.Class`はEffect-TS公式パターンであり、既存実装も優秀。完全廃止の必要性が不明確。

**推奨**: `Data.Class`を許容し、以下のルールで使い分け:

- Value Object → `Schema.Struct` + Brand型
- Aggregate Root（複雑なロジック） → `Data.Class`

---

## 📝 最終判定

本実行計画は**技術的に実現可能だが、極めて高リスク**です。

### リスク評価

| リスク項目               | 深刻度 | 発生確率 |
| ------------------------ | ------ | -------- |
| **プロジェクト遅延**     | 🔴 高  | 90%      |
| **パフォーマンス劣化**   | 🔴 高  | 70%      |
| **既存機能のデグレード** | 🟡 中  | 60%      |
| **テストカバレッジ低下** | 🟡 中  | 80%      |
| **チーム学習コスト**     | 🟢 低  | 100%     |

### 推奨事項

1. **段階的アプローチへの変更**を強く推奨
2. パフォーマンス計測の事前実施
3. `Data.Class`許容への方針変更検討

### 次のアクション

- [ ] 段階的リファクタリング計画への再設計
- [ ] Effect-TSパフォーマンス検証プロトタイプ作成
- [ ] `Data.Class`使用基準の再定義
- [ ] 実装開始（非推奨 - 高リスク）
