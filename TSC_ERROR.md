# TSCエラー修正実行計画

## 目的
- `devenv shell` 上で `pnpm typecheck` が完了する状態に戻す。
- 発生している TypeScript 型エラーを再発防止できる形で解消する。

## ベースラインと作業方針
- すべてのコマンドは `devenv shell` 内で実行する。
  - 例: `devenv shell -- pnpm typecheck`
- エラー調査ログは `.logs/` 配下に保存し、差分比較できるよう `git` 管理を確認してから扱う。
- ファイル編集前に既存の型定義やヘルパー有無を確認し、重複実装を避ける。
- Effect v3系 API 仕様は Context7 で最新版を参照し、破壊的変更を把握する。

## フェーズ一覧
1. **調査フェーズ**: エラー全体像の把握と優先度設定。
2. **メニュー制御モジュール修正**: `src/app.tsx` の `Fiber`/`Effect` 型不一致を解消。
3. **Effect制御フローリファクタ**: if/switch/try-catch/Promise/for を Effect-TS 高度APIへ移行。
4. **マッチャー／スキーマ整備**: `Match` の利用見直しと Schema の戻り型調整。
5. **タグ付きエラー基盤調整**: Tagged Error ファクトリとエンティティマッパーの更新。
6. **リグレッション確認**: 型チェック・静的検査・テストの再実行。

## フェーズ詳細

### フェーズ1: 調査フェーズ
- `mkdir -p .logs` でログ格納場所を用意。
- `devenv shell -- pnpm typecheck | tee .logs/tsc-initial.log` を実行し、エラー全文を取得。
- `rg "error TS" .logs/tsc-initial.log` や `rg "src/" .logs/tsc-initial.log` でファイル単位に整理。
- 主要エラーグループ（`src/app.tsx`, `src/shared/schema/...`, `src/shared/services/...`）の行番号を特定。
- 型定義の参照元を洗うため `rg "MenuControllerService"` や `rg "TaggedError"` を用いて関連ファイルを確認。

### フェーズ2: メニュー制御モジュール修正 (`src/app.tsx`)
- `Fiber.RuntimeFiber<void, never>` と `Fiber.RuntimeFiber<void, unknown>` の不一致が生じている箇所 (`src/app.tsx:67`, `:91`) を精査。
  - `runtime.runFork` の戻り値型を明示指定し、`ManagedRuntime` の型引数 (`ManagedRuntime<Env, Fx>`) を確認。
  - `Effect.matchEffect` 内で `Effect.sync` を返す箇所が `unknown` を発生させていないか確認。
- `Match.value(cancelled)` へ `boolean` を渡した状態で `Match.when` 側の型推論を補助するため、必要なら `pipe(cancelled as const, ...)` 等で literal 型を明示。
- `controller.stream()` の戻り型を確認し、`Stream.runForEach` の effect 戻り値が `Effect<MenuViewModel, any, never>` になっている原因を特定。
  - `controller.updateSetting` 等の返り値型 (`Effect<MenuViewModel, ErrorTag, never>`) を調査し、`any` を `MenuError` など具体的な型に置換。
  - 既存のドメインエラー型がある場合は利用し、なければ Schema で厳密化。
- 修正後は `devenv shell -- pnpm typecheck --filter src/app.tsx`（tsc 5.9 `--filter` オプション）で局所確認。

### フェーズ3: Effect制御フローリファクタ
- メニュー関連フックと UI コンポーネントの命令的分岐（`if` / `switch` / `return null` 等）を `Effect` + `Match` ベースへ置換。
  - `if/else` 相当は `Effect.if`・`Effect.flatMap` を使い、副作用がある分岐は Effect を返す。
  - `switch` や `_tag` 判定は `Match.value` / `Match.tag` / `Match.discriminatorsExhaustive` へ移行し、`Match.exhaustive` で網羅性を強制。
  - `try/catch` 部分は `Effect.try`, `Effect.catchAll`, `Effect.catchTags`, `Effect.catchIf` を利用してエラーパスをエフェクトに持ち上げる。
  - `Promise` 生成・連鎖は `Effect.promise`, `Effect.async`, `Effect.asyncInterrupt` に統一し、`Effect.gen` の `yield*` で記述。
  - `for` / `forEach` などのループは `Effect.forEachSequential`, `Effect.forEachParN`, もしくは `Stream.fromIterable` → `Stream.runForEach` に差し替え。
- 各リファクタで UI 側の戻り値が `JSX.Element | null` から Effect にならないよう、境界で `Effect.runSync` を避けて既存 React コンポーネント内では再構成済みの値を渡す。
- 制御フロー変換後に `runtime.runFork` を介したハンドラは `Effect.tapBoth` や `Effect.matchEffect` を使い、ログとエラー状態更新を一箇所にまとめる。

### フェーズ4: マッチャー／スキーマ整備
- `src/app.tsx` と `src/shared/browser/network-info-schema.ts` の `Match` 利用箇所で `Match.value` の戻り型が `Matcher` を要求しているため、`Match.value(cancelled)` の代わりに `pipe(cancelled, Match.when(true, ...))` 等へリファクタ。
  - 必要であれば `Match.type`/`Match.value` 用に共通ヘルパーを作成し、`Matcher` を期待する関数へ適合させる。
- `src/shared/schema/error.ts` の暗黙的 `any` を除去。
  - `Schema.Struct` や `Schema.Literal` を用いた明示的な `Schema` 定義へ置換。
  - 型述語 (`candidate is ParseErrorShape`) を実装する際は引数の型をインターフェースに寄せ、`return candidate != null && typeof candidate.message === "string"` のように安全なガードを追加。
- `src/shared/schema/json.ts` の循環参照エラー (`TS7022`, `TS7024`) に対してはスキーマ定義を関数分割し、`const defineJsonValueSchema = (): Schema.Json => ...` のように遅延初期化を導入。
  - `instanceof Error` 判定で `never` が出る問題は、Union Schema で `Error` 型を扱わない方針を検討し、必要に応じ `Schema.Struct({ message: Schema.String })` に置換。

### フェーズ5: タグ付きエラー基盤調整
- `src/shared/schema/tagged_error_factory.ts` の `Schema.ParseError` 非存在エラーに対して、Effect v3.18 のエラーモデルを調査。
  - Context7 で `effect` リポジトリの該当 API (`ParseError` → `ParseResult.ParseError`) を確認。
  - 新 API を踏まえ `Schema.decode` 利用箇所の戻り値型を更新。
- `src/shared/services/entity_id_mapper/errors.ts` の `TaggedError` 生成ロジックを v3.18 仕様へ合わせる。
  - `TaggedError` の `make` と `taggedClass` が廃止されていないか調査し、代替の `Data.Error` や `Schema.TaggedClass` を検討。
  - 具体的なジェネリクスを定義し、`never` 型に落ちないようエラースキーマを明示。

### フェーズ6: リグレッション確認
- 主要修正後に `devenv shell -- pnpm typecheck | tee .logs/tsc-after-fixes.log` を実行し、初期ログとの差分 (`diff -u .logs/tsc-initial.log .logs/tsc-after-fixes.log`) を確認。
- 型エラーがゼロになったら `devenv shell -- pnpm check` を実行し、フォーマッタ・EditorConfig 検証も通ることを確認。
- テスト影響範囲がある場合は `devenv shell -- pnpm test` でユニットテストを再実行。
- 作業中に追加したログファイルの取り扱い（`.gitignore` 対応など）を最終確認。

## 追加検討事項
- Effect ライブラリのバージョン変更履歴をチェックし、必要なら `CHANGELOG` から破壊的変更を抽出。
- `ManagedRuntime` のラップを共通化できる場合、カスタムフックとして切り出す案を検討（重複排除）。
- 修正規模が大きい場合は、フェーズごとにコミットを分けてレビュアブルに保つ。
