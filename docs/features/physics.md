# 物理システム (Physics System)

- **関連ソース**: [`src/systems/physics.ts`](../../src/systems/physics.ts)
- **責務**: エンティティに物理法則（重力、摩擦）を適用し、その結果に基づいてエンティティの位置を更新すること。

---

## 概要

`physicsSystem` は、ゲームワールド内のエンティティに基本的な物理演算を適用します。この計算はフレームレートに依存しないように、前フレームからの経過時間（`DeltaTime`）を考慮して行われます。

このシステムが計算した位置は「暫定的な」ものであり、最終的な位置は後続の `collisionSystem` によって衝突解決が行われた後に確定します。

## アーキテクチャ

`physicsSystem` は `Effect<R, E, void>` として実装された `Effect` プログラムです。

- **依存性の注入**: `World` サービスと `DeltaTime` サービスを `Effect` のコンテキストを通じて受け取ります。
- **状態の更新**: `world.querySoA` を使ってコンポーネントの配列への直接参照を取得し、状態を効率的に更新します。

## 処理フロー

1.  **クエリ実行**:
    - `physicsQuery` を使用して、物理演算に必要なコンポーネント（`position`, `velocity`, `gravity`, `player`）を持つエンティティのデータを `querySoA` で取得します。

2.  **物理計算**:
    - ループ処理で各エンティティのコンポーネントを更新します。
    - **重力の適用**:
      - エンティティが接地していない（`isGrounded` が `false`）場合、`Velocity` の `dy` 成分に重力を適用します。落下速度が `TERMINAL_VELOCITY`（終端速度）を超えないように制限されます。
    - **摩擦の適用**:
      - エンティティが接地している（`isGrounded` が `true`）場合、水平方向の速度 (`dx`, `dz`) に `FRICTION`（摩擦係数）を乗算し、スムーズに減速させます。
    - **位置の更新**:
      - 上記の計算で更新された最終的な速度 (`newDx`, `newDy`, `newDz`) に `deltaTime` を乗算し、現在の `Position` に加算します。これにより、フレームレートの変動に関わらず、物理挙動が一貫性を保ちます。

3.  **コンポーネントの更新**:
    - 計算された新しい速度と位置を、`querySoA` で取得したコンポーネント配列に直接書き込みます。

## 実行順序

物理システムの実行順序は、ゲームのシミュレーションにおいて極めて重要です。

`playerMovementSystem` -> **`physicsSystem`** -> `collisionSystem`

1.  **`playerMovementSystem`**: プレイヤーの移動やジャンプの「意図」を決定し、`Velocity` を更新します。
2.  **`physicsSystem` (このシステム)**: `playerMovementSystem` によって設定された `Velocity` に重力と摩擦を適用し、`Position` を暫定的に更新します。
3.  **`collisionSystem`**: `physicsSystem` によって更新された暫定的な `Position` を検証し、衝突があれば位置を補正して最終的な位置を「確定」させます。
