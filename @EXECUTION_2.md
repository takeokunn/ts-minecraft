# Effect-TS完全準拠 実行計画書

## 1. 背景と目的
- `@EXECUTION.md` に定義した4つの目的（全体リファクタリング、型安全性、Effect-TS高度機能導入、Effect-TS公式パターン完全準拠）を本計画のガードレールとする。
- Effect-TSの標準ガイドラインに沿ったAPI設計・エラーハンドリング・リソース管理・テスト戦略を整備し、長期的な保守性とオンボーディング容易性を確保する。

## 2. 現状達成状況サマリ

### 2.1 型安全性
- `any`: 173件、`unknown`: 638件が残存（`rg -o '\bany\b' src | wc -l`, `rg -o '\bunknown\b' src | wc -l`）。
- 型アサーション（`as Type`）がおよそ982件残留（`rg -o ' as [A-Z]' src | wc -l`）。alias importも含むため要精査。
- 非nullアサーション（`!`）の顕著利用は確認できなかった。

### 2.2 関数型スタイル
- `Schema.Struct` 1,612件、`Effect.gen` 2,902件、`Match.*` 3,219件と関数型スタイルは広く浸透（`rg -o 'Schema.Struct' src | wc -l` 等）。
- `class` 定義は83件（`rg -o 'class\\s+\\w+' src | wc -l`）。多くが `Schema.TaggedError` 派生クラスやBuilder実装として残存し、FR-2.1の未完了箇所。
- `async`/`await` は主にテスト内に限定されているが、インターフェース層では `Promise` を返すAPIが8箇所確認できる（`rg -o 'Promise<' src | wc -l`。例: `src/domain/inventory/types/specifications.ts:600` 前後）。

### 2.3 Effect-TS高度機能
- `STM`: 152箇所で利用され（`rg -o 'STM\\.' src | wc -l`）、`src/application/world/world_state_stm.ts` などで本格運用済み。
- `Queue`: 39箇所、`Fiber`: 9箇所、`Stream`: 52箇所で活用。`Pool`: 19箇所。`Scope` は `src/infrastructure/cannon/service.ts:123` 等2箇所（いずれも `rg -o '<名前>\\.' src | wc -l` の概算値）。
- `Resource` APIは未使用（`rg -o 'Resource\\.' src | wc -l` の結果0件）。リソース寿命管理がPool実装に依存。

### 2.4 Date/Time設計
- `new Date(...)` は全廃（0件、`rg -o 'new Date' src | wc -l`）。一方で `Date.now` は37件残存しており（`rg -o 'Date\\.now' src | wc -l`）、`DateTime` 系APIへの集約が未完。

### 2.5 設定・パッケージ
- `package.json` では `effect@3.18.2`, `@effect/schema@0.75.5`, `@effect/platform@0.90.10` を採用済みで、最新系のAPIが利用可能。

## 3. TODO洗い出し

### T-1 型安全性強化
- `any`/`unknown` の除去：`src/domain/inventory`、`src/application/world` 周辺のデータ構造にSchema追加。
- 型アサーション削減：`Schema.decode`/`Brand`/`Option`/`Result`を用いた流れへ移行。特に `src/presentation/inventory/view-model/inventory-view-model.ts` 系のViewモデル。
- `ISpecificationRepository` APIを `Effect.Effect` へ置換 (`src/domain/inventory/types/specifications.ts:600`)。
- Schema/Brandの未定義ドメイン型（例: WorldSeed, WorldGeneratorId）を整備し、`src/application/world/world_state_stm.ts:451` などのTODOを解消。

### T-2 完全関数型化
- Builder実装の `class` 排除：`src/domain/inventory/aggregate/inventory/factory.ts:306`、`src/domain/inventory/aggregate/container/factory.ts:382` を `Schema.Struct` + 関数群へ変更。
- `Schema.TaggedError` 生成クラスの代替検討：純関数シグネチャ＋`Data.TaggedError` もしくは `Schema.TaggedError` のfactoryメソッド化。
- `Promise`ベースの永続化API（IndexedDB, Repository系）のEffect化：`src/infrastructure/inventory/persistence/indexed-db.ts:48` の `tryPromise` パターンを共通化し、外部公開インターフェースから `Promise` を排除。

### T-3 Effect-TS高度機能準拠
- リソース寿命管理の明確化：`Pool.use` 依存箇所 (`src/infrastructure/cannon/service.ts:149`, `src/infrastructure/three/renderer/webgl_renderer.ts:231`) に `Resource` / `Scope` の標準パターンを導入。
- STMカバレッジ拡大：`src/domain/world_generation/aggregate/generation_session/generation_session.ts` では `STM.fromEffect(DateTime.nowAsDate)` やイベント発行が混在するため、STMネイティブなClock/Eventサービスを導入し、副作用をScope配下に閉じ込める。
- Queue/Stream監視：`src/application/game_loop/game_event_queue.ts` などのイベント系でBackpressure/Subscription解除を `Scope` と組み合わせて制御。

### T-4 DateTime統一
- `Date.now` 利用箇所（例: `src/application/chunk/chunk_generator.ts:92`, `src/domain/inventory/inventory-types.ts:127`）が37件残るため、`DateTime.now` / `DateTime.nowAsDate` ヘルパーとClock抽象へ移行。
- `DateTime` ブランド型を `DateTime.Utc` ベースで整備し、`Clock.currentTimeMillis` からの変換ヘルパー（例: Timestampブランド）を共通化。

### T-5 既存TODO対応（抜粋）
- `src/domain/physics/service/terrain_adaptation.ts:460` 再登攀ロジック実装。
- `src/domain/camera/aggregate/camera/factory.ts:338` と `src/domain/camera/aggregate/camera/camera.ts:386` の ViewMode 型統一。
- `src/application/chunk/chunk_generator.ts:79` 実チャンク生成ロジック差し替え。
- `src/application/world/world_state_stm.ts:451-471` WorldSeed / WorldCoordinate のBrand実装反映。
- `src/domain/world_generation/repository/world_generator_repository/memory_implementation.ts:477`、`src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:818` のメトリクス算出実装。
- チュートリアルドキュメント内の未実装コード（`docs/tutorials/basic-game-development/interactive-learning-guide.md:125` など）をサンプル完成版に更新。

## 4. 実行フェーズ

### フェーズ1: 型安全性と基盤整備 (2週間想定)
- `any`/`unknown` の優先度順リファクタリング。最初にドメインモジュール→アプリケーション層→プレゼンテーション層の順で対応。
- `ISpecificationRepository` など `Promise` APIのEffect化と周辺呼び出し修正。
- `DateTime` ヘルパー導入と `Date.now` 一括置換のためのcodemod準備。

### フェーズ2: 構造改革と高度機能の標準化 (3週間想定)
- Inventory/Container Builderの関数化、TaggedErrorのfactory化。
- Resource/Scopeを用いたリソース管理ガイドライン策定と既存Pool実装の移行。
- Queue/Stream/Fiberのライフサイクル統合（Scope閉鎖時の解放など）とテスト整備。

### フェーズ3: 仕上げとドキュメント整備 (1-2週間想定)
- 残余の`Date.now`／`Date` 系API置換とWorldSeed/Coordinate Brand導入によるTODO解消。
- メトリクス算出ロジックやチャンク生成本実装など未完タスクの埋め込み。
- `@EXECUTION.md`・`@EXECUTION_2.md`・`EXECUTE.md` の整合性確認とチーム共有、Effect-TS遵守チェックリストをCIに統合。

## 5. リスクと対策
- **大規模変更によるリグレッション**: `@effect/vitest` を活用したEffectファーストのテスト追加で抑制。
- **Resource未導入領域のメモリリーク**: Scope導入を前倒しし、実際のThree.js/CANNONリソースで計測。
- **学習コスト**: 目的文書と計画書を最新化した状態でドキュメントセッションを設け、オンボーディング資料をSSoTに統合。
