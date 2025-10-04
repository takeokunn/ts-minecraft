# Effect-TS リファクタリング実行計画

## 目的
- Effect-TS をコード全域の唯一の制御フロー基盤に据え、同期/非同期/副作用を統一的に扱う
- Brand・ADT・Either を用いて `as`・`any`・`unknown`・ノンヌルアサーションを排除し、実行時安全性とドメイン整合性を最大化する
- `class` ベースのオブジェクト指向構造を排し、Effect の文脈 (`Context`, `Layer`, `Managed`, `Ref`, `Schema`) を中心にした関数型アーキテクチャへ移行する
- Vitest + @effect/vitest による 1:1 テスト構造と PBT の標準化で、100% カバレッジと即時失敗検知を保証する
- Date/Promise/imperative loop を Effect のプリミティブへ置換し、純粋性とテスタビリティを確保する

## フェーズ1 現状評価（完了）
### 環境課題
- `./.devenv/profile/bin/pnpm tsc --noEmit` 実行時に PATH に `node` が解決されず失敗
  - 対応: `PATH="./.devenv/profile/bin:$PATH"` を標準で付与するラッパースクリプト `scripts/pnpm.sh` を導入し、CI/ドキュメントから同スクリプトを利用
- `vitest run` で 59 ファイル 61 テスト失敗、Effect ハンドラが `undefined.pipe` で落下するケースを多数確認

### コード観測
- `class`: 147 箇所。Builder やサービス層が主用途で、`GenerationSessionBuilderImpl` など完全置換対象
- `any`: 745 行 / 139 ファイル。永続層・テスト補助で多用され、Brand 未導入
- `Date.now`: 562 箇所。Clock への依存抽象が薄く、Effect ベースの日付境界が未整備
- 制御構造 (`if/else/for/switch/try/catch`): 3,796 行。Effect の `Match`, `Either`, `Stream`, `Schedule` 等への変換が必要

## フェーズ2 Effect-TS アーキテクチャ方針
### 制御フロー変換ポリシー
- **条件分岐**: `if/else` → `Match.value(taggedUnion)`, `Effect.if`, `Effect.mapBoth`
- **分岐網羅**: `switch` → `Match.type` or `match(tag)`。エラー ADT は `Effect.matchTag` を利用
- **例外ハンドリング**: `try/catch` → `Effect.try`, `Effect.catchTag`, `Effect.catchAll`
- **同期/非同期ループ**: `for` → `Effect.Array.forEach`, `Stream.fromIterable`, `Effect.forEach` with `concurrency`
- **Promise**: 全廃。外部 Promise API は `Effect.tryPromise` → `Layer`, `ScopedRef` で囲い、返り値は `Effect` に統一
- **Date**: `Clock`, `TestClock`, `Effect.Time` を利用し、`Brand<'Timestamp'>` で構築

### 型安全戦略
- **Brand 基盤**: `shared-kernel/brand.ts` を新設し、`Schema.brand` + `Schema.refine` で ID/Name/Interval 等を定義
- **ADT**: ドメインイベント・エラーを `Effect.Data.tagged` / `taggedEnum` で再定義し、パターンマッチ容易化
- **Either 導線**: I/O 層は `Effect.flatMapEither`, `Either.matchEffect` で成功/失敗を明示
- **Schema**: すべての入出力境界で `Schema.parseEffect` を導入し、`as` 不要化

### Effect レイヤリング
- **環境注入**: 既存 `Layer` の見直し。`Layer.scoped`, `Layer.memoize`, `Layer.withContext` を多用し副作用境界を明確化
- **Ref/Context**: Stateful 処理は `Ref`, `FiberRef`, `Context.Tag` を使用し、`class` 状態管理を代替
- **Stream/Schedule**: ループやポーリングを `Stream` + `Schedule` で表現し、テスト用に制御可能とする

## フェーズ3 モジュール再設計
### ディレクトリ・バレル整備
- `src/index.ts` を純粋なバレル (`export * from './bootstrap/main'` など) に変更
- 実行エントリ (`initApp`) は `bootstrap/main.ts` へ移動し、Effect `Layer` から起動
- ドメインごとに `index.ts` をバレル統一。実装と型を `implementation/adt/schema` などへ分割

### クラス廃止ロードマップ
- 優先度:
  1. `session-builder` 系 Builder
  2. Repository 実装
  3. サービス層 (`world/domain_service`, `physics/service`)
  4. UI ロジック
- 置換手法: `Module` パターン (`const make = ...`, `export const GenerationSessionBuilder = Context.Tag...`)
- 状態保持: `Ref` + `Effect.gen` で逐次処理、必要に応じ `MutableHashMap` / `Option`

### Date/環境境界
- `shared-kernel/time` に `ClockService` Layer
- すべての `Date.now` を `Clock.currentTimeMillis` ラップに差し替え
- Test では `TestClock.adjust` により deterministic 化

## フェーズ4 テスト戦略
### 構造再編
- 実装ファイルと同階層に `*.spec.ts` (ユニット) と `*.prop.ts` (PBT) を配置
- 旧 `__test__` / `*.spec.skip.ts` は段階的に削除・移植
- テスト命名規約: `component.spec.ts`, `component.prop.ts`

### テスト技術
- `@effect/vitest` の `it.effect`, `it.scoped`, `TestClock`
- PBT: `Effect.Test.Arbitrary.*` + カスタム Arbitrary を `testing/arbitrary` に集約
- カバレッジ: `vitest run --coverage` を PR ゲート化し 100% ライン率を強制
- 遅延対策: `Layer.memoize`, `TestServices` で I/O をスタブ化し、`TestClock` で時間進行

## フェーズ5 移行ロードマップ
### マイルストーン
1. **インフラ整備**: `scripts/pnpm.sh`, `shared-kernel/brand.ts`, `shared-kernel/time.ts`
2. **共通抽象**: Effect ヘルパー (`effect/control.ts`) と Schema ベースの型再定義
3. **ドメイン逐次移行**: chunk → world → physics → inventory → presentation の順で `class`/imperative を排除
4. **テスト刷新**: 各ドメイン移行時に対応テストを同階層へ移し PBT 追加
5. **カバレッジ最適化**: レポートを `test-results/coverage` へ保存し、閾値達成確認
6. **最終ゲート**: `tsc --noEmit`, `vitest run --coverage`, `dependency-cruiser` を統合チェック

### 品質ゲート
- `tsc --noEmit` (Effect 化後に strict モード継続)
- `vitest run --coverage` (ライン/ステートメント/ブランチ 100%)
- `pnpm lint`（必要なら ESLint 導入を検討）

### リスクと対応
- 差分肥大 → ドメイン単位の PR 設計と `docs/reference/architecture/` でガイド維持
- テスト時間増大 → `TestClock`, `Layer.memoize`、PBT のケース数調整で抑制
- Effect API 変更 → Context7 でバージョン監視、API ラッパーを shared-kernel に集約

## 次アクション
- `scripts/pnpm.sh` を追加し PATH 問題を恒久的に解消
- `shared-kernel/brand.ts` / `shared-kernel/time.ts` / `testing/arbitrary` の雛形を実装
- `index.ts` 再編と `bootstrap/main.ts` の Effect 起動パイプライン設計を開始
- ドメイン優先度に沿って Builder/Repository から `class` 廃止と Effect 適用を進行
