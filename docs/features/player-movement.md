# プレイヤー移動システム (Player Movement System)

-   **関連ソース**: [`src/systems/player-movement.ts`](../../src/systems/player-movement.ts)
-   **責務**: プレイヤーの入力状態とカメラの向きに基づいて移動とジャンプの意図を計算し、その結果を `Velocity` コンポーネントに反映すること。

---

## 概要

このシステムは、プレイヤーの「移動したい」という意図を物理的な「速度」に変換する役割を担います。入力状態とカメラの向きから進むべき方向と速さを決定し、`Velocity` コンポーネントを更新した新しい `World` オブジェクトを返します。

このシステムは速度を計算するだけで、**実際にエンティティの座標を移動させることはしません**。座標の更新は、この後に実行される `physicsSystem` と `collisionSystem` が担当します。この責務の分離が、予測可能でテストしやすい物理エンジンを構築する鍵となります。

## アーキテクチャ

`playerMovementSystem` は、`(world: World, deps: SystemDependencies) => [World, SystemCommand[]]` というシグネチャを持つ純粋な関数 (`System`) として実装されています。副作用は起こさず、コマンドも発行しないため、常に空のコマンド配列 `[]` を返します。状態の更新は、`updateComponent` のようなヘルパー関数を通じて、`World` オブジェクトを不変(immutable)に扱います。

## 処理フロー

`playerMovementSystem` は毎フレーム実行され、内部では責務に応じて純粋関数に分割されたロジックが実行されます。

1.  **クエリ実行**:
    -   `runtime/world` の `query` 関数と `domain/queries` の `playerMovementQuery` を使い、移動に必要なコンポーネント（`player`, `inputState`, `velocity`, `cameraState`）を持つエンティティのリストを取得します。

2.  **垂直方向の速度計算 (`calculateVerticalVelocity`)**:
    -   プレイヤーの `isGrounded` (接地フラグ) と `inputState.jump` (ジャンプ入力) を評価します。
    -   接地中にジャンプ入力があれば、垂直速度(`dy`)に`JUMP_FORCE`をセットし、`isGrounded`を`false`にして連続ジャンプを防ぎます。
    -   それ以外の場合は、現在の垂直速度を維持します。

3.  **水平方向の速度計算 (`calculateHorizontalVelocity` / `applyDeceleration`)**:
    -   `ts-pattern`ライブラリの`match`式を使い、水平方向の入力（`forward`, `left`など）の有無で処理を分岐します。
    -   **入力がある場合 (`calculateHorizontalVelocity`)**:
        -   `sprint`入力に応じて、基本速度 (`PLAYER_SPEED`) またはスプリント速度を決定します。
        -   入力方向（前後左右）から移動ベクトルを計算します。この際、斜め方向に速くなりすぎないよう、ベクトルを**正規化(normalize)**します。
        -   カメラの`yaw`（左右の向き）を考慮し、移動ベクトルを回転させ、カメラが見ている方向に正しく移動するように調整します。
    -   **入力がない場合 (`applyDeceleration`)**:
        -   現在の水平速度に`DECELERATION`（減速率、1未満の数値）を乗算し、スムーズに減速させます。
        -   速度が閾値 (`MIN_VELOCITY_THRESHOLD`) 以下になったら、完全に`0`にして停止させます。

4.  **Worldの更新**:
    -   計算された新しい速度と接地状態を、`updateComponent`ヘルパー関数を用いて`World`に適用します。
    -   `reduce`を使い、プレイヤーエンティティごとに更新処理を適用し、最終的に更新された`World`オブジェクトを生成して返します。

## 実行順序

このシステムの実行順序は、物理シミュレーションの正確性を保証する上で極めて重要です。

`inputPollingSystem` -> `cameraControlSystem` -> **`playerMovementSystem`** -> `physicsSystem` -> `collisionSystem`

1.  `inputPollingSystem` と `cameraControlSystem` の**後**に実行されることで、常に最新の入力と視点情報に基づいて移動計算ができます。
2.  `physicsSystem` と `collisionSystem` の**前**に実行されることで、ここで計算された「移動の意図」としての速度が、その後の物理演算（重力適用）と衝突解決に正しく反映されます。
