# Track A: try/catch残存箇所調査結果

## サマリー

- **総検出数**: 14箇所（テストコード・スクリプト含む）
- **テストコード除外後**: 14箇所
- **変換対象（実装コード）**: 7箇所
- **除外対象**: 7箇所
  - スクリプト（fix_factory_syntax.mjs）: 1箇所
  - コメント内サンプルコード: 1箇所
  - interface定義: 5箇所（誤検出）

## 変換対象詳細リスト

### 箇所1: persistent.ts:50 - localStorage読み込み処理

- **ファイル**: `src/domain/inventory/repository/inventory_repository/persistent.ts`
- **行番号**: 50-82
- **シンボル**: `loadFromStorage` (Effect.gen内のヘルパー関数)
- **現在のパターン**: try-catch with Effect.fail
- **エラーハンドリング**: `localStorage.getItem` + `JSON.parse`の例外を`StorageError`に変換
- **難易度**: 普通
- **変換案**:
  ```typescript
  const loadFromStorage = Effect.gen(function* () {
    yield* Effect.try({
      try: () => {
        const data = localStorage.getItem(config.storageKey)
        if (data) {
          const parsed = JSON.parse(data)
          const inventories = new Map<PlayerId, Inventory>()
          // ... 復元処理
        }
      },
      catch: (error) => createStorageError('localStorage', 'load', `Failed to load data: ${error}`),
    })
  })
  ```
- **必要なSchema**: `StorageError`は既存だが`Data.tagged`型 → `Schema.TaggedError`への変換が必要

---

### 箇所2: persistent.ts:86 - localStorage保存処理

- **ファイル**: `src/domain/inventory/repository/inventory_repository/persistent.ts`
- **行番号**: 86-120
- **シンボル**: `saveToStorage` (Effect.gen内のヘルパー関数)
- **現在のパターン**: try-catch with Effect.fail
- **エラーハンドリング**: `localStorage.setItem` + シリアライズ処理の例外を`StorageError`に変換
- **難易度**: 普通
- **変換案**:
  ```typescript
  const saveToStorage = Effect.gen(function* () {
    yield* Effect.try({
      try: () => {
        const inventories = yield * Ref.get(inventoryCache)
        // ... シリアライズ処理
        localStorage.setItem(config.storageKey, data)
        yield * Ref.set(isDirty, false)
      },
      catch: (error) => createStorageError('localStorage', 'save', `Failed to save data: ${error}`),
    })
  })
  ```
- **必要なSchema**: `StorageError`の`Schema.TaggedError`化

---

### 箇所3: json_file.ts:151 - バックアップ作成処理

- **ファイル**: `src/domain/inventory/repository/item_definition_repository/json_file.ts`
- **行番号**: 151-158
- **シンボル**: `updateItemDefinitions` (非同期ヘルパー関数内)
- **現在のパターン**: try-catch with console.warn（エラー無視パターン）
- **エラーハンドリング**: バックアップ失敗は警告のみ、メイン処理は継続
- **難易度**: 簡単
- **変換案**:
  ```typescript
  if (config.backupEnabled) {
    yield *
      Effect.tryPromise({
        try: async () => {
          const backupTimestamp = await Effect.runPromise(Clock.currentTimeMillis)
          const backupPath = `${config.filePath}.backup-${backupTimestamp}`
          await fs.copyFile(config.filePath, backupPath)
        },
        catch: (error) => new BackupFailedError({ reason: String(error) }),
      }).pipe(Effect.catchAll((error) => Effect.logWarning(`Failed to create backup: ${error}`)))
  }
  ```
- **必要なSchema**: 新規`BackupFailedError`クラス定義（または既存エラーを再利用）

---

### 箇所4: workflows.ts:253 - クラフティングワークフロー（try-finally的）

- **ファイル**: `src/domain/inventory/application_service/transaction_manager/workflows.ts`
- **行番号**: 253-298
- **シンボル**: `executeCraftingWorkflowImpl`
- **現在のパターン**: try-catch with rollback
- **エラーハンドリング**: エラー時に`rollbackCraftingMaterials`実行後、再スロー
- **難易度**: 普通
- **変換案**:

  ```typescript
  const reservedMaterials = yield* reserveCraftingMaterials(operation, inventoryService)

  yield* Effect.gen(function* () {
    // フェーズ3-7の処理
    const resultSlot = yield* ensureResultItemSpace(operation, inventoryService)
    // ...
    return { transactionId, success: true, ... }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError('Crafting workflow failed, rolling back', { transactionId, error: String(error) })
        yield* rollbackCraftingMaterials(reservedMaterials, inventoryService)
        return yield* Effect.fail(error)
      })
    )
  )
  ```

- **必要なSchema**: 既存エラー型を使用（新規定義不要）

---

### 箇所5: workflows.ts:341 - トレードワークフロー（try-finally的）

- **ファイル**: `src/domain/inventory/application_service/transaction_manager/workflows.ts`
- **行番号**: 341-398
- **シンボル**: `executeTradeWorkflowImpl`
- **現在のパターン**: try-catch with rollback
- **エラーハンドリング**: エラー時に`rollbackTradeItems`実行後、再スロー
- **難易度**: 普通
- **変換案**:

  ```typescript
  const player1Items = yield* reserveTradeItems(operation.player1Offers, inventoryService)
  const player2Items = yield* reserveTradeItems(operation.player2Offers, inventoryService)

  yield* Effect.gen(function* () {
    // フェーズ4-5の処理
    const player2Received = yield* EffectArray.forEach(...)
    // ...
    return { transactionId, tradeCompleted: true, ... }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError('Trade workflow failed, rolling back', { transactionId, error: String(error) })
        yield* rollbackTradeItems([...player1Items, ...player2Items], inventoryService)
        return yield* Effect.fail(error)
      })
    )
  )
  ```

- **必要なSchema**: 既存エラー型を使用（新規定義不要）

---

### 箇所6: live.ts:64 & 71 - アトミック転送（ネストtry-catch-finally）

- **ファイル**: `src/domain/inventory/application_service/transaction_manager/live.ts`
- **行番号**: 64-113（外側try-catch）、71-102（内側try-finally）
- **シンボル**: `executeAtomicTransfers`
- **現在のパターン**: try-catch-finally（2段ネスト、ロック管理付き）
- **エラーハンドリング**:
  - 外側catch: `updateFailureMetrics` + 再スロー
  - 内側finally: `releaseLocks`（必須）
- **難易度**: 難しい（2段階ネスト + リソース管理）
- **変換案**:

  ```typescript
  const startTime = yield* Clock.currentTimeMillis

  yield* Effect.gen(function* () {
    // フェーズ1: 前提条件チェック
    yield* validateAtomicTransferPreconditions(transfers)

    // フェーズ2: リソースロック獲得
    const acquiredLocks = yield* acquireTransferLocks(transfers, txId)

    yield* Effect.gen(function* () {
      // フェーズ3: 転送実行
      yield* Effect.forEach(transfers, (transfer) => ...)

      // 成功時の統計更新
      yield* updateSuccessMetrics(startTime)

      return { transactionId: txId, completedTransfers: transfers.length, ... }
    }).pipe(
      Effect.ensuring(releaseLocks(acquiredLocks)) // finallyの代替
    )
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        // 失敗時の統計更新
        yield* updateFailureMetrics(startTime)
        yield* Effect.logError('Atomic transfers failed', { transactionId: txId, error: String(error) })
        return yield* Effect.fail(error)
      })
    )
  )
  ```

- **必要なSchema**: 既存エラー型を使用（新規定義不要）

---

### 箇所7: vector3.ts:29 - エラーフォーマッター（防御的プログラミング）

- **ファイル**: `src/domain/interaction/value_object/vector3.ts`
- **行番号**: 29-33
- **シンボル**: `formatParseError`
- **現在のパターン**: try-catch with fallback（防御的プログラミング）
- **エラーハンドリング**: `TreeFormatter.formatError`失敗時にデフォルトメッセージを返す
- **難易度**: 簡単
- **変換案**:
  ```typescript
  const formatParseError = (error: Schema.ParseError): string =>
    Effect.runSync(
      Effect.try({
        try: () => TreeFormatter.formatError(error, { includeStackTrace: false }),
        catch: () => 'Vector3を構築できません',
      }).pipe(Effect.catchAll(() => Effect.succeed('Vector3を構築できません')))
    )
  ```
  または、よりシンプルに:
  ```typescript
  const formatParseError = (error: Schema.ParseError): string =>
    Effect.runSync(
      Effect.orElse(
        Effect.sync(() => TreeFormatter.formatError(error, { includeStackTrace: false })),
        () => Effect.succeed('Vector3を構築できません')
      )
    )
  ```
- **必要なSchema**: エラー型定義不要（内部処理のみ）

---

## 除外対象詳細

### 除外1: fix_factory_syntax.mjs:144

- **理由**: ビルドスクリプト（プロダクションコード外）
- **パターン**: Node.jsスクリプトのファイル処理エラーハンドリング
- **対応**: 変換不要（Effect-TS適用範囲外）

### 除外2: index.ts:342 (camera/application_service)

- **理由**: コメント内のサンプルコード
- **パターン**: ドキュメント用の使用例
- **対応**: 変換不要（実際のコードではない）

### 除外3-7: interface定義5箇所

- **検出箇所**:
  - `src/domain/chunk/repository/chunk_repository/memory_implementation.ts:13` (ChunkEntry)
  - `src/domain/camera/domain_service/view_mode_manager/service.ts:379` (ViewModeHistoryEntry)
  - `src/domain/world/repository/biome_system_repository/biome_cache.ts:45,62` (BiomeCacheEntry, QueryCacheEntry)
  - `src/domain/world/types/core/biome_types.ts:402` (BiomeDistributionEntry)
- **理由**: `try\s*\{`パターンが誤検出（interfaceの`readonly`プロパティ）
- **対応**: 変換不要（try-catchブロックではない）

---

## 変換優先順位

### 優先度1: 簡単な箇所（既存Schemaあり/エラー無視パターン）: 2箇所

1. **vector3.ts:29** - エラーフォーマッター（防御的プログラミング）
2. **json_file.ts:151** - バックアップ作成処理（エラー無視）

### 優先度2: 普通の箇所（Schema定義必要/標準的変換）: 4箇所

3. **persistent.ts:50** - localStorage読み込み処理
4. **persistent.ts:86** - localStorage保存処理
5. **workflows.ts:253** - クラフティングワークフロー
6. **workflows.ts:341** - トレードワークフロー

### 優先度3: 難しい箇所（複雑なエラーハンドリング）: 1箇所

7. **live.ts:64&71** - アトミック転送（ネストtry-catch-finally）

---

## 依存関係分析

### Track Bとの関連: 0箇所

- **該当なし**: for/whileループとの併用なし

### Track Cとの関連: 0箇所

- **該当なし**: if-else/switch-case/matchパターンとの深い関連なし

### Track Dとの関連: 2箇所（Schema.TaggedError変換必要）

- **persistent.ts:50,86** - `StorageError`の`Data.tagged` → `Schema.TaggedError`変換が前提
- **json_file.ts:151** - 新規`BackupFailedError`の`Schema.TaggedError`定義が推奨

### 独立して変換可能: 5箇所

- **vector3.ts:29** - 完全独立
- **workflows.ts:253,341** - 既存エラー型使用
- **live.ts:64&71** - 既存エラー型使用

---

## 実装戦略

### Phase 1: Track D連携（優先度高）

1. `StorageError`を`Schema.TaggedError`に変換（Track D拡張作業）
2. persistent.ts:50,86の変換実施
3. json_file.ts:151の変換実施（新規`BackupFailedError`定義）

### Phase 2: 独立箇所（並列実行可能）

4. vector3.ts:29の変換実施
5. workflows.ts:253,341の変換実施（rollbackパターン確立）

### Phase 3: 複雑箇所（慎重対応）

6. live.ts:64&71の変換実施（Effect.ensuring活用）

---

## 検証計画

### 各箇所の変換後検証

```bash
# 型チェック
pnpm typecheck

# ユニットテスト
pnpm test

# ビルド検証
pnpm build

# try/catch残存確認
grep -r "try\s*{" src/domain --include="*.ts" --exclude="*.test.ts" --exclude="*.spec.ts"
```

### 統合テスト

- localStorage操作テスト（persistent.ts）
- ファイルシステム操作テスト（json_file.ts）
- トランザクション処理テスト（workflows.ts, live.ts）
- Vector3バリデーションテスト（vector3.ts）

---

## 参考資料

- **既存メモリ**: `domain-try-catch-effect-conversion-patterns`
- **既存メモリ**: `phase2-track-d-schema-tagged-error-patterns`
- **Effect-TSドキュメント**: https://effect.website/docs/error-management/expected-errors
- **プロジェクト規約**: `docs/how-to/development/development-conventions.md`

---

## 備考

### 実際の変換対象数について

当初の想定「残り14箇所」には以下が含まれていた:

- **実装コード**: 7箇所（真の変換対象）
- **スクリプト**: 1箇所（変換不要）
- **コメント**: 1箇所（変換不要）
- **interface誤検出**: 5箇所（try-catchではない）

**結論**: 実際の変換対象は **7箇所** である。

### 変換パターンの確立

今回の調査により、以下のパターンが確立された:

1. **Effect.try**: 同期的な例外処理
2. **Effect.tryPromise**: 非同期的な例外処理
3. **Effect.catchAll**: エラーハンドリング + 処理継続
4. **Effect.ensuring**: finally相当のリソース解放
5. **Effect.orElse**: フォールバック処理

これらのパターンを組み合わせることで、全7箇所の変換が可能。
