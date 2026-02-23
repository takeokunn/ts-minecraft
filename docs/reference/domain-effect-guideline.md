---
title: 'Domain Effect-TS 移行ガイドライン'
description: 'ドメイン層全体を Effect-TS ベースの純粋関数型アーキテクチャへ再構築するための分析結果と実行規約'
category: 'reference'
difficulty: 'advanced'
tags: ['domain-layer', 'effect-ts', 'functional-architecture', 'refactoring-guide']
related_docs:
  [
    '../how-to/development/development-conventions.md',
    '../how-to/development/effect-ts-migration-guide.md',
    '../how-to/testing/testing-standards.md',
  ]
---

## 分析サマリ

- `src/domain` 配下には TypeScript ファイルが 800+ 存在し、命令的構文（`if/for/class` 等）が多数残存している。
- `rg` とスクリプト集計による主要指標：
  - `if`: 2,113 件 / `for`: 928 件 / `class`: 145 件 / `Promise`: 24 件
  - 高密度領域は `world`, `inventory`, `camera`, `chunk` の各サブドメイン。
- 深刻度の高いモジュール例（命令的構文の上位 10 ファイル）：
  1. `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts`
  2. `src/domain/world/repository/world_metadata_repository/memory_implementation.ts`
  3. `src/domain/inventory/factory/container_factory/factory.ts`
  4. `src/domain/world/repository/biome_system_repository/persistence_implementation.ts`
  5. `src/domain/inventory/domain_service/transfer_service/live.ts`
  6. `src/domain/inventory/domain_service/crafting_integration/live.ts`
  7. `src/domain/inventory/domain_service/transfer_service/specifications.ts`
  8. `src/domain/world/repository/biome_system_repository/biome_cache.ts`
  9. `src/domain/inventory/InventoryServiceLive.ts`
  10. `src/domain/chunk/__test__/optics/integration.spec.skip.ts`

## Effect-TS 化の基本指針

- **制御フロー**: `Effect.gen` + `Match` を標準とし、`if/else/switch` をパターンマッチに置換する。
- **反復処理**: `Array`/`ReadonlyArray` ヘルパーと `Effect.forEach`, `Stream` 系 API を用いて `for` を廃止する。
- **例外処理**: `try/catch` は `Effect.try`, `Effect.catchAll`, `Either` ベースのエラーパイプラインへ移行する。
- **非同期**: `Promise` 返却は全面禁止し、`Effect` を返す。必要な場合は `Effect.fromPromise` に限定する。
- **データモデル**: ブランド型・ADT を Schema で定義 (`Schema.struct`, `Schema.literal`, `Data.taggedEnum`)。`as`/`any`/`unknown`/`!` を 0 にする。
- **サービス**: 依存解決は `Layer` を使い、`class` ベース実装を `{ services... }` のモジュール (tagged service) へ移行する。
- **Date/Clock**: すべて `Effect.Clock`/`Layer.succeed` で抽象化し、`new Date()` などの直接呼び出しを禁止する。

## サブドメイン別アクションプラン

### world

- Repository 実装が命令的構文の最大ホットスポット。`WorldMetadataRepository` から着手し、Effect レイヤ構成と Schema バリデーションを導入する。
- `value_object/coordinates`・`factory/world_generator_factory` は `try/catch`・`class` が集中。`Effect.try` と ADT を適用する。

### inventory

- Factory / Domain Service の `class` と `for` が多い。`ContainerFactory`, `TransferService`, `InventoryServiceLive` を先行リファクタし、`Layer` + `Effect.gen` + `Schema` に変換する。
- `value_object` 系は既に Schema を使用しているため、ブランド型の共通ユーティリティを抽出して再利用する。

### camera / chunk

- テスト・実装ともに `switch` と `for` が多い。`Match` を活用した ADT 変換と、`Chunk` 系の非同期パスを `Effect` に揃える。
- `chunk` の try/catch はシリアライザ周辺に集中。`ChunkSerializationError` を ADT 化し、エラーチャネルで扱う。

### physics / others

- `physics` は Effect 変換途中で `Not a valid effect` エラーが発生している。`provide` の渡し方と `Layer` 設計の再確認が必須。
- `player`, `entities`, `equipment` に残る `for` や `class` は少量。基盤が整い次第で対応。

## 実装パターン・共有ユーティリティ

1. **Effect Flow DSL**: `src/domain/shared/effect-flow.ts`（新設予定）に `matchEffect`, `forEachSequential`, `provideManyLayers` などの共通関数を集約。
2. **Schema Toolkit**: `src/domain/shared/schema.ts`（新設予定）でブランド生成・Refinements・TaggedError を標準化。
3. **Layer 合成**: `Layer.mergeAll`, `Layer.succeed` のラッパーを提供し、`provideServiceLayer` パターンを徹底。
4. **Date/Time Service**: `src/domain/shared/time-service.ts` に `CurrentTime`, `ElapsedTime` などの Tag/Layer を定義。

## 作業分割と優先度

1. **基盤整備**: 共通ユーティリティ作成 → `inventory` / `world` のホットスポットを順次対応。
2. **エラーハンドリングの統一**: 既存の `Error` 継承クラスをすべて `Data.TaggedError` に置換。`class` 排除を進めつつ ADT 化。
3. **テスト連動**: リファクタ対象ごとに `@effect/vitest` テストを再作成し、命名規約・PBT を組み込む。
4. **モジュール統合**: 全リファクタ完了後に `index.ts` を再整理し、外部 API と Layer 定義の整合を取る。

## 既知のテスト失敗（2025-10-04 実行ログ）

- `src/domain/physics/domain_service/__test__/collision_service.test.ts` : `Not a valid effect` → Layer 提供漏れ。
- `src/domain/physics/repository/__test__/physics_world_repository.test.ts` : 同上。
- `src/presentation/inventory/state/store.test.ts` : `args[1] is not a function` → `Effect.Stream` API の不一致。
- `src/presentation/inventory/state/reactive-system.test.ts` : Service 未登録。
- `src/presentation/inventory/view-model/inventory-view-model.test.ts` : `self.add` 呼び出しが不適合。
- `src/infrastructure/ecs/__test__/System.spec.ts` : 期待されるログ収集がゼロ。
- `src/infrastructure/ecs/__test__/SystemRegistry.spec.ts` : 未整備のモック層が原因の複数失敗。

上記の失敗はいずれも Layer/Service 構成の再設計で解消予定。Phase2 以降のリファクタに合わせてテストも全面的に書き換える。

## 運用ルール

- リファクタ対象ファイルは `Effect-TS` のみを使用し、`class` や命令的構文を導入しない。
- 新規テストは `describe` 単位で `Effect.it` / `Effect.withLayer` を必ず使用。PBT は `Effect.property` を標準とする。
- 変更時は `pnpm tsc --noEmit` と `pnpm vitest run --coverage` を dev-shell 経由で実行し、失敗ログを必ず記録する。
- 既存ドキュメントと矛盾する方針は本ドキュメントを優先する。
