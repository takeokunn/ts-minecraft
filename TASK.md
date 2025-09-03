# 実行計画書：TypeScriptエラーの完全解消とテストの正常化 (並列実行対応版)

## 1. 目標

`pnpm exec tsc --noEmit` と `pnpm test --run` が全て成功する状態にする。
そのために、プロジェクト全体のTypeScriptコードベースを修正し、型安全性を向上させ、すべてのテストがパスするように修正する。

## 2. 基本方針

- **並列タスク分割**: プロジェクトを依存関係の少ないレイヤー/ドメインごとに分割し、それぞれを独立したタスクとして並列実行可能にする。
- **ファイル単位での修正と検証**: 各タスク内では、1つのファイル（およびそのテストファイル）を修正するたびに、`tsc`と`vitest`を実行して個別に問題を解決する。
- **Effect/Schemaの規約統一**:
    - **`S.Struct` vs `S.Class`**: `S.Struct` とプレーンオブジェクト (`{...}`) または `S.decodeSync` を使用する方法に統一する。
    - **PBTの修正**: `Effect.promise(() => fc.assert(fc.asyncProperty(...)))` のパターンを正しく適用する。
- **依存関係とAPIの更新**:
    - Effect v3以降のAPI変更に追従する (`@effect/test` -> `effect/Test`, `ReadonlyArray` -> `effect/ReadonlyArray` など)。
    - `SoAResult` のような重複定義された型を統合する。

---

## 3. 並列実行タスク

以下のタスクは、依存関係が解決され次第、並列で実行可能です。

### タスクA: 基盤型定義とテストユーティリティの修正 (最優先)

*このタスクは他のすべてのタスクの前提条件となります。*

1.  **`test/arbitraries.ts` の修正**:
    - `Arbitrary.make(Schema)` の呼び出し方を修正。
    - 存在しないスキーマ (`AABBSchema`, `EntityIdSchema`) のインポート元を修正。
    - `Component` 型を `AnyComponent` に修正。
    - `Vector3IntArb` が `Vector3IntSchema` を使うように修正。
2.  **`src/domain/components.ts` の修正**:
    - `fc` をインポートする。
3.  **`src/domain/types.ts` の修正**:
    - `S.arbitrary` を `S.annotations({ arbitrary: ... })` に修正。
4.  **`src/domain/geometry.ts` の修正**:
    - `AABB` スキーマを `AABBSchema` としてエクスポートし、`AABB` 型エイリアスを維持する。
5.  **`test/test-utils.ts` の検証**:
    - `it.effect` が `@effect/vitest` から正しくインポートされていることを確認。

### タスクB: ドメイン層のコアロジック修正 (`domain`/*)

*依存: タスクA*

1.  **`src/domain/archetypes.ts` & `__test__/archetypes.spec.ts`**:
    - `new Position()` などを `S.decodeSync(Position)({...})` に置き換える。
    - PBTの `fc.property` を `fc.asyncProperty` に修正。
2.  **`src/domain/block.ts` & `__test__/block.spec.ts`**:
    - PBTの `fc.property` を `fc.asyncProperty` に修正。
3.  **`src/domain/camera-logic.ts` & `__test__/camera-logic.spec.ts`**:
    - `new Camera()` などを `S.decodeSync` やオブジェクトリテラルに修正。
    - `Option.match` の型推論エラーを修正。
4.  **`src/domain/query.ts` & `__test__/query.spec.ts`**:
    - `createQuery` の型定義とテストを検証・修正。
5.  **その他の `domain` ファイルとテスト**:
    - `common.spec.ts`, `entity.spec.ts`, `world.spec.ts` などの型エラーを個別に修正。

### タスクC: インフラ層の実装修正 (`infrastructure`/*)

*依存: タスクA, タスクB*

1.  **`src/infrastructure/world.ts` & `__test__/world.spec.ts`**:
    - `ReadonlyArray` のインポートを `effect/ReadonlyArray` に修正。
    - `Option.toEffect` を `Effect.flatten(Option.toEffect(...))` に修正。
    - `query` / `querySoA` の型推論エラーを修正。
    - テスト内の `world.state.pipe(...)` を `Ref.get(world.state).pipe(...)` に修正。
2.  **`src/infrastructure/input-browser.ts` & `__test__/input-browser.spec.ts`**:
    - `DomEventQueue` の `Tag` 定義を修正。
    - `Effect.if` の `onTrue`/`onFalse` が `LazyArg` を受け取るように修正。
3.  **`src/infrastructure/computation.worker.ts` & `__test__/computation.worker.spec.ts`**:
    - `messages.ts` からのスキーマインポートを修正。
    - `Arbitrary.make` の呼び出しを修正。
4.  **その他の `infrastructure` ファイルとテスト**:
    - `clock`, `material-manager`, `raycast-three`, `stats`, `three-js-context` のテストで、`@effect/test` のインポートと `Layer`/`Scope` の使い方を修正。

### タスクD: ランタイムとシステムの修正 (`runtime`/*, `systems`/*)

*依存: タスクA, タスクB, タスクC*

1.  **`src/runtime/services.ts` の修正**:
    - `SoAResult` の定義を `domain/types.ts` のものと統一する。
2.  **`src/systems/*.ts` の修正**:
    - `collision.ts`, `physics.ts`, `player-movement.ts` などで `new Component()` を使わないように修正。
    - `ui.ts`: `createUISystem` を `uiSystem` にリネームしてエクスポート。
    - `chunk-loading.ts`: `ReadonlyArray.pipe` を `pipe(ReadonlyArray, ...)` に修正。
3.  **`src/systems/__test__/*.spec.ts` の修正**:
    - 全てのシステムテストで、モック (`mockWorld` など) を最新のサービスインターフェースに合わせる。
    - `SoAResult` のモックデータを正しい構造に修正。
4.  **`src/runtime/loop.ts` & `__test__/loop.spec.ts`**:
    - `@effect/test` のインポートを修正。
    - `fc.string().pipe` を `fc.string().map` に修正。

### タスクE: 最終統合 (`main.ts`)

*依存: タスクA, タスクB, タスクC, タスクD*

1.  **`src/main.ts` & `__test__/main.spec.ts`**:
    - `uiSystem` のインポートを修正。
    - `pos` オブジェクトの型エラーを `toFloat` などで修正。
    - テスト容易性のために `main` 関数のシグネチャを修正。
    - テスト内の `fc.void()` を `fc.constant(undefined)` に置き換える。

### 最終検証ステップ

*依存: 全タスクの完了*

1.  プロジェクトルートで `pnpm exec tsc --noEmit` を実行し、エラーがゼロであることを確認。
2.  `pnpm test --run` を実行し、全テストがパスすることを確認。
3.  `pnpm test --coverage` を実行し、カバレッジが100%に達していることを確認。

---
この計画書に従い、各タスクを並行して進めることで、効率的に問題解決を図ります。
