# Effect-TS Stream API パターンガイド

## 概要

このガイドでは、従来のforループをEffect-TS Stream APIに移行するパターンを解説します。Stream APIは遅延評価、メモリ効率、エラーハンドリングの改善を提供します。

## 基本概念

### Stream vs 従来のループ

| 従来のループ       | Stream API            | 利点                   |
| ------------------ | --------------------- | ---------------------- |
| `for...of`         | `Stream.fromIterable` | 遅延評価、メモリ効率   |
| `for(i=0;i<n;i++)` | `Stream.range`        | 不変性、組み合わせ可能 |
| ネストループ       | `Stream.flatMap`      | 可読性、並列処理可能   |
| `break`            | `Stream.takeWhile`    | 明示的な終了条件       |
| 累積               | `Stream.runFold`      | 関数型パラダイム       |

## 移行パターン

### パターン1: 単純な配列処理

```typescript
// 従来のforループ
for (const item of items) {
  processItem(item)
}

// Stream API
import { Stream, Effect, pipe } from 'effect'

yield *
  pipe(
    Stream.fromIterable(items),
    Stream.runForEach((item) => Effect.sync(() => processItem(item)))
  )
```

### パターン2: インデックスベースループ

```typescript
// 従来のforループ
for (let i = 0; i < 10; i++) {
  console.log(i)
}

// Stream API
yield *
  pipe(
    Stream.range(0, 9), // 0から9まで（10回）
    Stream.runForEach((i) => Effect.sync(() => console.log(i)))
  )
```

### パターン3: 2次元ネストループ

```typescript
// 従来のforループ
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    processPixel(x, y)
  }
}

// Stream API
yield *
  pipe(
    Stream.range(0, width - 1),
    Stream.flatMap((x) => Stream.range(0, height - 1).pipe(Stream.map((y) => ({ x, y })))),
    Stream.runForEach(({ x, y }) => Effect.sync(() => processPixel(x, y)))
  )
```

### パターン4: 3次元ネストループ（チャンク処理）

```typescript
// 従来のforループ
for (let x = 0; x < 16; x++) {
  for (let y = 0; y < 384; y++) {
    for (let z = 0; z < 16; z++) {
      if (isValidBlock(x, y, z)) {
        processBlock(x, y, z)
      }
    }
  }
}

// Stream API（最適化版）
yield *
  pipe(
    Stream.range(0, 15),
    Stream.flatMap((x) =>
      Stream.range(0, 383).pipe(Stream.flatMap((y) => Stream.range(0, 15).pipe(Stream.map((z) => ({ x, y, z })))))
    ),
    Stream.filter(({ x, y, z }) => isValidBlock(x, y, z)),
    Stream.chunks(1000), // パフォーマンス最適化
    Stream.mapEffect((chunk) =>
      Effect.forEach(chunk, ({ x, y, z }) => Effect.sync(() => processBlock(x, y, z)), { concurrency: 'unbounded' })
    ),
    Stream.runDrain
  )
```

### パターン5: フィルタと処理

```typescript
// 従来のforループ
for (const user of users) {
  if (user.isActive) {
    sendEmail(user)
  }
}

// Stream API
yield *
  pipe(
    Stream.fromIterable(users),
    Stream.filter((user) => user.isActive),
    Stream.runForEach((user) => Effect.sync(() => sendEmail(user)))
  )
```

### パターン6: 累積処理

```typescript
// 従来のforループ
let sum = 0
for (const value of values) {
  sum += value
}

// Stream API
const sum =
  yield *
  pipe(
    Stream.fromIterable(values),
    Stream.runFold(0, (acc, value) => Effect.succeed(acc + value))
  )
```

### パターン7: 早期終了

```typescript
// 従来のforループ
for (const item of items) {
  if (!isValid(item)) break
  process(item)
}

// Stream API
yield *
  pipe(
    Stream.fromIterable(items),
    Stream.takeWhile(isValid),
    Stream.runForEach((item) => Effect.sync(() => process(item)))
  )
```

### パターン8: インデックス付きマッピング

```typescript
// 従来のforループ
const results = []
for (let i = 0; i < items.length; i++) {
  results[i] = transform(items[i], i)
}

// Stream API
const results =
  yield *
  pipe(
    Stream.fromIterable(items),
    Stream.zipWithIndex,
    Stream.map(([item, index]) => transform(item, index)),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )
```

## ゲーム開発での実用例

### メッシュ生成

```typescript
import { Stream, Effect, pipe, Option } from 'effect'

const generateMesh = (chunkData: ChunkData) =>
  pipe(
    Stream.range(0, chunkData.size - 1),
    Stream.flatMap((x) =>
      Stream.range(0, chunkData.size - 1).pipe(
        Stream.flatMap((y) => Stream.range(0, chunkData.size - 1).pipe(Stream.map((z) => ({ x, y, z }))))
      )
    ),
    Stream.filter(({ x, y, z }) => {
      const blockType = pipe(
        Option.fromNullable(chunkData.blocks[x]?.[y]?.[z]),
        Option.getOrElse(() => 0)
      )
      return blockType !== 0 // 空気ブロックをスキップ
    }),
    Stream.map(({ x, y, z }) => generateCube(x, y, z)),
    Stream.runCollect,
    Effect.map(combineMeshData)
  )
```

### エンティティ更新

```typescript
const updateEntities = (entities: ReadonlyArray<Entity>) =>
  pipe(
    Stream.fromIterable(entities),
    Stream.filter((entity) => entity.isActive),
    Stream.mapConcurrently(4)((entity) => updateEntity(entity)),
    Stream.runDrain
  )
```

## パフォーマンス考慮事項

### いつStream APIを使うべきか

✅ **推奨される場合**:

- 大量データの処理
- 非同期操作の連鎖
- エラーハンドリングが必要
- 並列処理の可能性がある
- 関数型プログラミングパターンを活用したい

❌ **避けるべき場合**:

- 極めてパフォーマンスクリティカルなコード（物理演算など）
- 単純な小規模ループ（10回未満）
- 複雑な状態変更を伴う処理
- リアルタイムレンダリングの最内側ループ

### 最適化テクニック

```typescript
// チャンキングによるバッチ処理
pipe(
  stream,
  Stream.chunks(1000), // 1000要素ずつ処理
  Stream.mapConcurrently(4)(processChunk), // 4並列
  Stream.runDrain
)

// 遅延評価の活用
pipe(
  Stream.range(0, 1000000),
  Stream.take(10), // 最初の10要素のみ処理
  Stream.runCollect
)
```

## ヘルパーライブラリ

プロジェクトには`stream-migration-helpers.ts`が用意されています：

```typescript
import {
  streamForEach,
  streamRange,
  stream2D,
  streamMapWithIndex,
  streamFilterProcess,
  streamAccumulate,
  streamTakeWhile,
  streamCollectOptional,
} from '@shared/utils/stream-migration-helpers'

// 使用例
yield * streamForEach(items, (item) => Effect.sync(() => console.log(item)))

yield * stream2D({ start: 0, end: 10 }, { start: 0, end: 10 }, (x, y) => Effect.sync(() => processCell(x, y)))
```

## トラブルシューティング

### よくある問題と解決策

1. **型エラー**: StreamとEffectの戻り値型を確認
2. **パフォーマンス低下**: チャンクサイズを調整
3. **メモリ使用量増加**: `Stream.runDrain`で即座に消費
4. **デバッグ困難**: `Stream.tap`でログ出力

## まとめ

Stream APIへの移行は、コードの可読性、保守性、エラーハンドリングを改善します。パフォーマンスクリティカルな箇所では従来のループを維持しつつ、適切な場所でStream APIを活用することで、モダンで堅牢なコードベースを構築できます。
