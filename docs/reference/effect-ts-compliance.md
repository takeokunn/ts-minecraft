# Effect-TS完全準拠ガイドライン

## 概要

このドキュメントは、Effect-TSの高度機能を最大限活用するための**禁止パターン**と**推奨パターン**を一覧化したものです。実測データ（EXECUTION_3.md/EXECUTION_4.md）に基づいた具体的な基準値を提供します。

## 📋 禁止パターン一覧

### コア原則違反

| パターン              | 理由                                   | 代替手段                             | 実測値 | 目標 |
| --------------------- | -------------------------------------- | ------------------------------------ | ------ | ---- |
| `Effect.runSync`      | 同期実行による副作用・遅延評価違反     | `Effect.runPromise`（境界のみ）      | 0件    | 0件  |
| `throw new Error`     | Effect外エラー・型情報喪失             | `Effect.fail` + `Schema.TaggedError` | 0件    | 0件  |
| `Promise<T>`          | 型安全性低下・エラー情報喪失           | `Effect.Effect<T, E>`                | 0件    | 0件  |
| `async/await`         | Effect合成不可・エラーハンドリング困難 | `Effect.gen` + `yield*`              | 0件    | 0件  |
| `class` (Service以外) | 副作用・可変性・テスト困難             | `interface` + `Context.Tag`          | 0件    | 0件  |

### 型安全性違反

| パターン               | 理由               | 代替手段                         | 実測値   | 目標   |
| ---------------------- | ------------------ | -------------------------------- | -------- | ------ |
| `any`                  | 完全な型安全性喪失 | 具体的型・`unknown`・Schema      | 0件      | 0件    |
| `unknown` (不適切使用) | 型情報喪失         | `Schema.decodeUnknown`・型ガード | 0件      | 0件    |
| `as Type`              | 型安全性バイパス   | `Schema.decodeUnknown`・Brand型  | 削減対象 | 最小化 |

### Effect境界違反

| パターン                   | 理由                       | 代替手段                                  | 実測値 | 目標 |
| -------------------------- | -------------------------- | ----------------------------------------- | ------ | ---- |
| `console.log/error`        | Effect外副作用・テスト困難 | `Effect.log*` (logDebug/logInfo/logError) | 0件    | 0件  |
| `Math.random()`            | 非決定性・テスト困難       | `Random.next`・`Random.nextIntBetween`    | 0件    | 0件  |
| `Date.now()`・`new Date()` | 環境依存・テスト困難       | `Clock.currentTimeMillis`                 | 0件    | 0件  |
| `JSON.parse/stringify`     | エラーハンドリング不備     | `Schema.parseJson`・`Schema.encodeJson`   | 0件    | 0件  |
| `window`・`navigator`      | ブラウザ依存・SSR不可      | Platform Service抽象化                    | 0件    | 0件  |

### 遅延評価違反

| パターン                               | 理由                       | 代替手段                       | 実測値 | 目標 |
| -------------------------------------- | -------------------------- | ------------------------------ | ------ | ---- |
| `Schema.decodeUnknownSync`             | モジュール初期化時同期実行 | `Schema.decodeUnknown` + Layer | 0件    | 0件  |
| `Effect.runPromise` (モジュールレベル) | 即時実行・遅延評価違反     | Effect返却関数・Layer統合      | 0件    | 0件  |

### リソース管理違反

| パターン                | 理由                           | 代替手段                                               | 実測値   | 目標     |
| ----------------------- | ------------------------------ | ------------------------------------------------------ | -------- | -------- |
| `Effect.fork` (生Fiber) | リソースリーク・中断不可       | `Effect.forkScoped`・`Effect.forkDaemon`               | 0件      | 0件      |
| Layer誤用               | リソースリーク・生存期間不明確 | `Layer.scoped` (外部リソース)・`Layer.effect` (GC管理) | 適切実装 | 継続維持 |

## ✅ 推奨パターン一覧

### エラーハンドリング

| パターン                    | 用途                             | 実装例                                                                                                               |
| --------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Effect.catchTags`          | 複数の型付きエラーを個別処理     | [Inventory Validation](../../src/domain/inventory/domain_service/validation_service/service.ts)                      |
| `Effect.catchAll`           | 全エラーを統一的に処理           | [Chunk Repository](../../src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts)                   |
| `Effect.retry` + `Schedule` | リトライ戦略（指数バックオフ等） | [World Generation](../../src/domain/world_generation/domain_service/world_generation_orchestrator/error_recovery.ts) |
| `Effect.timeout`            | 外部I/Oタイムアウト              | [WebGL Renderer](../../src/infrastructure/three/renderer/webgl_renderer.ts)                                          |

### Layer/Service設計

| パターン                                 | 用途                     | 実装例                                                                             |
| ---------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `Layer.effect` + `Ref.make`              | 状態管理（GC管理）       | [Camera State Repository](../../src/domain/camera/repository/camera_state/live.ts) |
| `Layer.effect` + `Queue.unbounded`       | イベントキュー（GC管理） | [Audio Service](../../src/infrastructure/audio/audio-service-live.ts)              |
| `Layer.scoped` + `Effect.acquireRelease` | 外部リソース管理         | [WebGL Renderer](../../src/infrastructure/three/renderer/webgl_renderer.ts)        |
| `Layer.scoped` + `Effect.forkScoped`     | バックグラウンドFiber    | [Game Event Queue](../../src/application/game_loop/game_event_queue.ts)            |

### テスト

| パターン                                  | 用途                     | 実装例                                                                                    |
| ----------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `TestClock.adjust`                        | 時間依存ロジックのテスト | [Guidelines §9.1](../how-to/development/effect-ts-guidelines.md#91-testclock---時間制御)  |
| `TestRandom` + `TestContext`              | 乱数テストの決定性保証   | [Guidelines §9.2](../how-to/development/effect-ts-guidelines.md#92-testrandom---乱数制御) |
| `Effect.provide(TestContext.TestContext)` | テストコンテキスト統合   | Effect-TS公式ドキュメント                                                                 |

### 観測性

| パターン           | 用途                  | 実装例                                                                                                   |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `Metric.frequency` | エラー頻度計測        | [Guidelines §9.5](../how-to/development/effect-ts-guidelines.md#95-metrictracing統合)                    |
| `Metric.timer`     | レスポンスタイム計測  | [Performance Monitoring](../../src/application/world/performance_monitoring/metrics_collector.ts)        |
| `Effect.withSpan`  | 分散トレーシング      | [Guidelines §9.5](../how-to/development/effect-ts-guidelines.md#95-metrictracing統合)                    |
| `Supervisor.track` | Fiber監視・リーク検出 | [Guidelines §9.4](../how-to/development/effect-ts-guidelines.md#94-supervisor---fiberライフサイクル監視) |

### 型安全性

| パターン                         | 用途                   | 実装例                                                                                            |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `Schema.Struct` + `Schema.Brand` | 構造化データ + Brand型 | [Chunk Position](../../src/domain/chunk/value_object/chunk_position/types.ts)                     |
| `Schema.decodeUnknown`           | ランタイム検証         | [Inventory Metadata](../../src/domain/inventory/value_object/item_metadata/schema.ts)             |
| `Schema.parseJson`               | JSON安全パース         | [Inventory Storage](../../src/domain/inventory/repository/inventory_repository/storage_schema.ts) |
| `satisfies` (型アサーション削減) | 型推論 + 型チェック    | [Biome Factory](../../src/domain/biome/factory/biome_system_factory/builder_functions.ts)         |

## 🔍 CI自動チェック項目

プロジェクトの `.github/workflows/ci.yml` で以下をチェック：

### コア品質メトリクス

| 項目                  | 閾値 | チェック方法                            |
| --------------------- | ---- | --------------------------------------- |
| `any`                 | 0件  | `rg '\bany\b' src --type ts -c`         |
| `unknown`             | 0件  | `rg '\bunknown\b' src --type ts -c`     |
| `Promise<`            | 0件  | `rg 'Promise<' src --type ts -c`        |
| `Effect.runSync`      | 0件  | `rg 'Effect\.runSync' src --type ts -c` |
| `console.*`           | 0件  | `rg 'console\.' src --type ts -c`       |
| `Math.random`         | 0件  | `rg 'Math\.random' src --type ts -c`    |
| `throw new Error`     | 0件  | `rg 'throw new Error' src --type ts -c` |
| `class` (Service以外) | 0件  | 手動レビュー                            |

### 型チェック

```bash
pnpm typecheck  # TypeScript型チェック（strictモード）
pnpm check      # Biomeによるコード品質チェック
pnpm test       # Vitestによるテスト実行
```

## 📊 達成状況（EXECUTION_4.md実測値）

### Phase 3 完了メトリクス

| カテゴリ                   | 完了率          | 備考                         |
| -------------------------- | --------------- | ---------------------------- |
| **コード品質（T-1~T-20）** | **95%** (19/20) | 基盤完成                     |
| **高度機能（T-21~T-40）**  | **15%** (3/20)  | TestClock/Supervisor等未導入 |
| **観測性（T-41~T-60）**    | **10%** (2/20)  | Metric/Tracing未導入         |
| **インフラ（T-61~T-100）** | **7.5%** (3/40) | ドキュメント未整備           |

### コア禁止パターン削減完了

- ✅ `any`: 0件（100%削減）
- ✅ `unknown`: 0件（100%削減、326件→0件）
- ✅ `Promise`: 0件（100%削減）
- ✅ `Effect.runSync`: 0件（97.6%削減、41件→0件）
- ✅ `console.*`: 0件（100%削減）
- ✅ `Math.random`: 0件（100%削減）
- ✅ `throw new Error`: 0件（100%削減）

## 🎯 次期目標（Phase 4以降）

### 高度機能導入

1. **TestClock/TestRandom**: 全テストファイルへの導入
2. **Metric**: パフォーマンス計測基盤構築
3. **Tracing**: OpenTelemetry統合
4. **Supervisor**: Fiberライフサイクル監視

### 観測性強化

1. **構造化ログ**: `Effect.log*` への完全統合
2. **分散トレーシング**: `Effect.withSpan` による可視化
3. **メトリクス収集**: Prometheus/Grafana統合

## 📚 関連ドキュメント

- [Effect-TS実装ガイドライン](../how-to/development/effect-ts-guidelines.md) - 詳細実装パターン
- [Effect-TS移行ガイド](../tutorials/effect-ts-migration-guide.md) - 移行手順
- [開発規約](../how-to/development/development-conventions.md) - プロジェクト全体規約
- [EXECUTION_3.md](../../EXECUTION_3.md) - Phase 3実績
- [EXECUTION_4.md](../../EXECUTION_4.md) - 未完了タスク詳細

## 🔗 外部リソース

- [Effect-TS公式ドキュメント](https://effect.website)
- [Effect-TS GitHub](https://github.com/Effect-TS/effect)
- [Effect Patterns Hub](https://github.com/pauljphilp/effectpatterns) - コミュニティパターン集
