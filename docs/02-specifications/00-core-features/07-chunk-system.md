const compressBlockData = (blocks: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    // Run-Length Encoding
    const compressed: number[] = []
    let currentBlock = blocks[0]
    let count = 1

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] === currentBlock && count < 255) {
        count++
      } else {
        compressed.push(currentBlock, count)
        currentBlock = blocks[i]
        count = 1
      }
    }
    compressed.push(currentBlock, count)
    return new Uint8Array(compressed)
  })

## 🚨 Common Issues & Solutions

### Error 1: Context not provided
```
TypeError: Service not found: @minecraft/ChunkService
```

**原因**: Layer.provide忘れ
**解決**:
```typescript
// ❌ 間違い
Effect.runPromise(myProgram)

// ✅ 正解
Effect.runPromise(myProgram.pipe(
  Effect.provide(ChunkServiceLive),
  Effect.provide(ChunkGeneratorLive),
  Effect.provide(ChunkStorageLive)
))
```

### Error 2: Schema validation failed
```
ParseError: Expected object, received string
```

**原因**: データ形状の不一致
**解決**: デバッグ用デコーダー使用
```typescript
// デバッグ情報付きデコード
const result = Schema.decodeEither(ChunkCoordinate)(data)
if (Either.isLeft(result)) {
  console.log("Validation error details:", result.left.issues)
}
```

### Error 3: Chunk loading timeout
```
ChunkLoadError: Chunk loading timed out
```

**原因**: 大きなチャンクの生成に時間がかかる
**解決**: タイムアウト時間の調整
```typescript
const loadWithTimeout = (coord: ChunkCoordinate) =>
  chunkService.loadChunk(coord).pipe(
    Effect.timeout(Duration.seconds(30)), // タイムアウト延長
    Effect.retry(Schedule.exponential("1 seconds", 2.0).pipe(
      Schedule.recurs(3)
    ))
  )
```

### Error 4: Memory leak in chunk cache
```
Warning: High memory usage detected
```

**原因**: アンロードされていないチャンクの蓄積
**解決**: LRUキャッシュサイズ確認と強制クリーンアップ
```typescript
const forceCleanupCache = () => Effect.gen(function* () {
  const chunks = Array.from(chunkCache.entries())
    .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())

  // 古いチャンクを強制削除
  const toRemove = chunks.slice(0, chunks.length - MAX_LOADED_CHUNKS)
  for (const [key, chunk] of toRemove) {
    yield* chunkService.unloadChunk(chunk.coordinate)
  }
})
```

### Error 5: Race condition in chunk generation
```
ChunkGenerationError: Multiple generation attempts detected
```

**原因**: 同じチャンクの並行生成
**解決**: セマフォによる排他制御
```typescript
const chunkGenerationSemaphore = yield* Effect.makeSemaphore(1)

const safeGenerateChunk = (coord: ChunkCoordinate) =>
  chunkGenerationSemaphore.withPermits(1)(
    chunkService.generateChunk(coord)
  )
```