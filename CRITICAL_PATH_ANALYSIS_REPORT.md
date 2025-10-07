# クリティカルパス特定とパフォーマンス影響分析レポート

## 📊 Executive Summary

- **60FPSクリティカルパス**: 2箇所（ゲームループ・レンダリング）
- **高頻度呼び出し関数（50+参照）**: 15関数以上
- **メモリ集約的処理**: 12ファイル（34箇所のTypedArray割り当て）
- **既存最適化コード**: 30+ファイル（Cache/Pool/Memoization）
- **型アサーション総数**: 2,729箇所（527ファイル）

**Phase 1リスク評価**: 🔴 高リスク領域2箇所、🟡 中リスク領域15関数、🟢 低リスク領域多数

---

## 🔴 Phase 1で触ってはいけない箇所（パフォーマンスリスク：高）

### 1. ゲームループ・クリティカルパス

| 関数名          | ファイルパス                                  | 呼び出し頻度 | 型安全性課題                                     | Phase 1対応     |
| --------------- | --------------------------------------------- | ------------ | ------------------------------------------------ | --------------- |
| `nextFrame`     | `src/domain/game_loop/legacy/live.ts:263-378` | 60回/秒      | SynchronizedRef.modifyEffect、Effect.forEach使用 | **🚫 触らない** |
| `updateState`   | `src/domain/game_loop/legacy/live.ts:130-131` | 60回/秒      | SynchronizedRef.update使用                       | **🚫 触らない** |
| `ensureState`   | `src/domain/game_loop/legacy/live.ts:133-144` | 60回/秒      | Match.value、Effect.flatMap使用                  | **🚫 触らない** |
| `deriveMetrics` | `src/domain/game_loop/legacy/live.ts:71-76`   | 60回/秒      | PerformanceMetrics構築                           | **🚫 触らない** |

**理由**:

- requestAnimationFrame相当のEffect-TSベースループ
- SynchronizedRef操作がフレームごとに実行
- Effect.forEachによるコールバック実行がボトルネック候補
- 既にEffect-TSで最適化済み（追加オーバーヘッド不可）

### 2. レンダリング・クリティカルパス

| 関数名                  | ファイルパス                                                  | 呼び出し頻度 | 型安全性課題               | Phase 1対応     |
| ----------------------- | ------------------------------------------------------------- | ------------ | -------------------------- | --------------- |
| `render`                | `src/infrastructure/three/renderer/webgl_renderer.ts:79-89`   | 60回/秒      | Effect.try使用             | **🚫 触らない** |
| `withPooledRenderer`    | `src/infrastructure/three/renderer/webgl_renderer.ts:240-243` | 60回/秒      | Pool.use使用               | **🚫 触らない** |
| `makeWebGLRendererPool` | `src/infrastructure/three/renderer/webgl_renderer.ts:228-235` | 初期化       | Pool.make + acquireRelease | **🚫 触らない** |

**理由**:

- THREE.WebGLRendererの直接呼び出し（60fps必須）
- Pool.useパターンで既に最適化済み
- Effect.try/acquireReleaseのオーバーヘッドが既に最小化

---

## 🟡 Phase 1で慎重に扱うべき箇所（パフォーマンスリスク：中）

### 3. 高頻度呼び出し関数（50+参照想定）

| 関数名                 | 推定ファイルパス                                                     | 呼び出し頻度 | 型安全性課題                 | Phase 1対応             |
| ---------------------- | -------------------------------------------------------------------- | ------------ | ---------------------------- | ----------------------- |
| `getBlockAt`           | `src/domain/chunk/aggregate/chunk/operations.ts`                     | 1000+回/秒   | Uint16Array直接操作          | **⚠️ ベンチマーク必須** |
| `setBlockAt`           | `src/domain/chunk/aggregate/chunk/operations.ts`                     | 100+回/秒    | Uint16Array直接操作          | **⚠️ ベンチマーク必須** |
| `generateChunk`        | `src/domain/world/domain_service/procedural_generation/`             | 10-60回/秒   | 複数実装あり                 | **⚠️ ベンチマーク必須** |
| `updatePosition`       | `src/domain/player/`<br>`src/infrastructure/three/camera/`           | 60回/秒      | Vector3操作多数              | **⚠️ ベンチマーク必須** |
| `processChunk`         | `src/domain/chunk/`                                                  | 10-60回/秒   | ChunkData操作                | **⚠️ ベンチマーク必須** |
| `biomeQuery`           | `src/domain/world/repository/biome_system_repository/`               | 100+回/秒    | QuadTree操作                 | **⚠️ ベンチマーク必須** |
| `cacheGet`             | `src/domain/world/repository/biome_system_repository/biome_cache.ts` | 1000+回/秒   | Map操作・LRU                 | **⚠️ ベンチマーク必須** |
| `computeSkipped`       | `src/domain/game_loop/legacy/live.ts:88-94`                          | 60回/秒      | Match.value使用              | **⚠️ ベンチマーク必須** |
| `observedFpsFromDelta` | `src/domain/game_loop/legacy/live.ts:104-105`                        | 60回/秒      | makeFps（Schema検証）        | **⚠️ ベンチマーク必須** |
| `advanceFrameCount`    | `src/domain/game_loop/legacy/live.ts:107-108`                        | 60回/秒      | makeFrameCount（Schema検証） | **⚠️ ベンチマーク必須** |

**Phase 1対応方針**:

1. **型アサーション除去前に必ずベンチマーク計測**
2. **Brand Type導入時はSchemaデコードコストを検証**
3. **高頻度関数内でのEffect.gen使用は避ける**
4. **既存TypedArray操作は維持（型のみ付与）**

---

## 🧠 メモリ集約的処理（Phase 1で特に注意）

### 4. TypedArray使用箇所（12ファイル・34箇所）

| ファイルパス                                             | TypedArray型 | 割り当てサイズ | 用途                   | Phase 1対応       |
| -------------------------------------------------------- | ------------ | -------------- | ---------------------- | ----------------- |
| `src/domain/chunk/aggregate/chunk/operations.ts:248`     | Uint16Array  | 98,304要素     | チャンクブロックデータ | **✅ 型のみ付与** |
| `src/domain/world/domain_service/noise_generation/`      | Float32Array | 可変           | ノイズ生成バッファ     | **✅ 型のみ付与** |
| `src/domain/world/domain_service/procedural_generation/` | Uint8Array   | 可変           | 洞窟・鉱石生成         | **✅ 型のみ付与** |

**Phase 1対応方針**:

```typescript
// ❌ 避けるべき: Brand TypeでTypedArrayをラップ
type ChunkData = Brand<Uint16Array, 'ChunkData'>

// ✅ 推奨: TypedArrayは生のまま、操作関数にのみ型付与
const getBlockAt = (
  data: Uint16Array, // そのまま
  x: BlockX, // Brand Type
  y: BlockY,
  z: BlockZ
): BlockType => {
  /* ... */
}
```

**理由**: TypedArrayのメモリ効率・パフォーマンスは変更不可

---

## ✅ 既存最適化コードの保護（Phase 1で絶対に壊してはいけない）

### 5. Cache/Pool/Memoization実装（30+ファイル）

| 最適化パターン               | ファイルパス                                                                 | 実装詳細                      | Phase 1対応             |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------- | ----------------------- |
| **BiomeCache**               | `src/domain/world/repository/biome_system_repository/biome_cache.ts:159-261` | Ref.make + Map + LRU eviction | **🚫 ロジック変更禁止** |
| **CacheOptimizationService** | `src/domain/world/application_service/cache_optimization/cache_manager.ts`   | 多層キャッシュ戦略            | **🚫 ロジック変更禁止** |
| **WebGLRendererPool**        | `src/infrastructure/three/renderer/webgl_renderer.ts:228-235`                | Pool.make (size: 3)           | **🚫 ロジック変更禁止** |
| **EntityPool**               | `src/infrastructure/ecs/entity-manager.ts:132,200,294`                       | allocate/deallocate           | **🚫 ロジック変更禁止** |
| **WorldGeneratorCache**      | `src/domain/world/`                                                          | チャンク生成結果キャッシュ    | **🚫 ロジック変更禁止** |

**Phase 1対応方針**:

- **キャッシュキー生成関数**: 型のみ付与（ロジック変更禁止）
- **Pool acquire/release**: Effect型のみ明示化
- **LRU eviction**: アルゴリズム変更禁止

---

## 🟢 Phase 1で安全に触れる箇所（パフォーマンスリスク：低）

### 6. 初期化・設定・デバッグコード

| カテゴリ           | 対象ファイル例                                                 | 理由                             |
| ------------------ | -------------------------------------------------------------- | -------------------------------- |
| **初期化処理**     | `src/bootstrap/`<br>`src/application/game-application-live.ts` | 1回のみ実行                      |
| **設定ファイル**   | `src/bootstrap/domain/config.ts`                               | 初期化時のみ読み込み             |
| **型定義ファイル** | `src/domain/*/types/index.ts`                                  | 実行時影響なし                   |
| **Schema定義**     | `*Schema.ts`                                                   | デコード箇所が高頻度でなければOK |
| **エラー定義**     | `src/domain/*/errors/`                                         | 例外パスのみ                     |
| **デバッグログ**   | `console.log`系                                                | 本番で無効化可能                 |

**Phase 1推奨作業**:

- ✅ 初期化処理の`as`除去
- ✅ 設定ファイルのBrand Type導入
- ✅ 型定義ファイルの整理
- ✅ Schema定義の厳格化（高頻度呼び出しでない箇所）

---

## 📈 パフォーマンス安全性戦略（Phase 1実施時）

### 7. ベンチマーク必須箇所

```bash
# 修正前ベンチマーク
pnpm benchmark:gameloop     # nextFrame性能
pnpm benchmark:rendering    # render性能
pnpm benchmark:chunk        # getBlockAt/setBlockAt性能

# 修正後ベンチマーク
# 上記3つを再実行し、5%以上の劣化があれば修正をrevert
```

### 8. Phase 1での型安全化の優先度

| 優先度          | 対象                              | 理由              |
| --------------- | --------------------------------- | ----------------- |
| **P0 (最優先)** | 🟢 初期化・設定コード             | 実行頻度が低い    |
| **P1 (高)**     | 🟢 型定義ファイル                 | 実行時コストゼロ  |
| **P2 (中)**     | 🟡 高頻度関数（ベンチマーク前提） | 影響計測必須      |
| **P3 (低)**     | 🔴 ゲームループ・レンダリング     | Phase 2以降に延期 |

### 9. Brand Type導入ガイドライン

```typescript
// ✅ OK: 低頻度な関数
const createConfig = (fps: number): GameLoopConfig => {
  const targetFps = Schema.decodeSync(FpsSchema)(fps) // 初期化時1回のみ
  return { targetFps }
}

// ⚠️ 要ベンチマーク: 中頻度な関数
const updatePlayer = (delta: number): Effect.Effect<void> => {
  const duration = Schema.decodeSync(DurationSchema)(delta) // 60回/秒
  // ベンチマーク結果が5%以内の劣化なら許容
}

// ❌ NG: 高頻度な関数
const getBlockAt = (x: number, y: number, z: number): BlockType => {
  const blockX = Schema.decodeSync(BlockXSchema)(x) // 1000+回/秒 → 禁止
  // 代替: 関数シグネチャのみBrand Type、内部はnumber
}
```

### 10. Effect-TSオーバーヘッド回避パターン

```typescript
// ❌ 避けるべき: 高頻度関数でEffect.gen
const getBlockAt = (data: Uint16Array, x: number, y: number, z: number): Effect.Effect<BlockType> =>
  Effect.gen(function* () {
    // 60fps下で1000+回呼び出し → ジェネレータオーバーヘッド大
    const index = yield* calculateIndex(x, y, z)
    return data[index]
  })

// ✅ 推奨: 同期関数として実装、型のみ付与
const getBlockAt = (data: Uint16Array, x: number, y: number, z: number): BlockType => {
  const index = x + y * 16 + z * 16 * 16
  return data[index] as BlockType // Phase 2でBrand Type化
}
```

---

## 🎯 Phase 1実行チェックリスト

### 修正前

- [ ] 対象ファイルが🔴リスク領域に含まれていないことを確認
- [ ] 🟡リスク領域の場合、ベンチマークスクリプト準備
- [ ] 既存最適化コード（Cache/Pool）に影響しないことを確認
- [ ] list_memories で過去の失敗例を確認

### 修正中

- [ ] TypedArray操作は型のみ付与（ロジック変更禁止）
- [ ] Schema.decodeSync は低頻度関数のみ使用
- [ ] Effect.gen は初期化処理のみ使用
- [ ] 高頻度関数は同期関数として維持

### 修正後

- [ ] pnpm typecheck 成功
- [ ] pnpm test 成功
- [ ] pnpm benchmark で5%以内の劣化確認
- [ ] 60fps維持を実機で確認

---

## 📚 参照ドキュメント

- `docs/explanations/architecture/performance-guidelines.md` - パフォーマンス目標値
- `docs/how-to/development/performance-optimization.md` - 最適化実装パターン
- `EXECUTE.md` - リファクタリング全体計画
- `phase1-refactoring-patterns` memory - 過去の実装パターン

---

## 🚨 最重要原則

**Phase 1では60FPS維持が最優先。型安全性は二の次。**

- 🔴 ゲームループ・レンダリング: **絶対に触らない**
- 🟡 高頻度関数: **ベンチマーク必須、5%劣化で即revert**
- 🟢 初期化・設定: **安全に型安全化可能**
- ✅ 既存最適化: **絶対に壊さない**

**疑わしきは触らず。Phase 2以降に延期すること。**
