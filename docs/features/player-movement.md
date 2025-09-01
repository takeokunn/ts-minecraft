# プレイヤー移動システム (Player Movement System)

-   **関連ソース**: [`src/systems/player-movement.ts`](../../src/systems/player-movement.ts)
-   **責務**: プレイヤーの `InputState` と `CameraState` に基づいて移動とジャンプの意図を計算し、その結果を `Velocity` コンポーネントに反映すること。

---

## 概要

このシステムは、プレイヤーの「移動したい」という意図を物理的な「速度」に変換する役割を担います。入力状態とカメラの向きから進むべき方向と速さを決定し、`Velocity` コンポーネントストアを直接更新します。

このシステムは速度を計算するだけで、**実際にエンティティの座標を移動させることはしません**。座標の更新は、この後に実行される `physicsSystem` と `collisionSystem` が担当します。この責務の分離が、予測可能でテストしやすい物理エンジンを構築する鍵となります。

## 処理フロー

`playerMovementSystem` は `Effect` プログラムとして実装されており、毎フレーム以下の処理を実行します。

1.  **データ取得**: `world.querySoA(playerQuery)` を使用して、プレイヤーエンティティのコンポーネントデータ（`Player`, `InputState`, `Velocity`, `CameraState`）が格納されたSoAストアへの直接の参照を効率的に取得します。
2.  **速度と方向の決定**:
    -   `InputState` の `sprint` フラグをチェックし、基本速度 (`PLAYER_SPEED`) またはスプリント速度 (`PLAYER_SPEED * SPRINT_MULTIPLIER`) を設定します。
    -   `InputState` の `forward`, `backward`, `left`, `right` の状態と、`CameraState` の `yaw` (左右の回転) を元に、進むべき水平方向のベクトル (`dx`, `dz`) を三角関数 (`Math.sin`, `Math.cos`) を用いて計算します。
        -   例えば `forward` が `true` の場合、`dx` は `-Math.sin(yaw)`、`dz` は `-Math.cos(yaw)` の方向に `speed` が加算されます。
3.  **減速処理**:
    -   水平方向の入力がない場合 (`dx` と `dz` が両方 `0`)、現在の速度 (`velocity.dx`, `velocity.dz`) に `DECELERATION` (減速率、例: 0.85) を乗算し、スムーズに停止させます。
    -   速度が非常に小さい値 (`MIN_VELOCITY`) になったら、完全に `0` にして不要な計算を防ぎます。
4.  **ジャンプ処理**:
    -   `InputState` の `jump` フラグが `true` で、かつ `Player` コンポーネントの `isGrounded` (接地フラグ) も `true` の場合にのみジャンプを実行します。
    -   `Velocity` ストアの `dy` (垂直速度) に `JUMP_FORCE` を設定します。
    -   `Player` ストアの `isGrounded` フラグを `false` に設定し、空中での連続ジャンプを防ぎます。
5.  **コンポーネントストアの更新**:
    -   計算された新しい速度 (`newDx`, `newDy`, `newDz`) を、`Velocity` コンポーネントストアの対応するインデックスに直接書き込みます。SoAストアへの直接書き込みにより、不要なメモリアロケーションを回避し、GC負荷を最小限に抑えます。

## 主要な定数

システムの振る舞いは、ソースコード上部で定義された定数によって調整されます。

-   `PLAYER_SPEED`: 基本的な歩行速度。
-   `SPRINT_MULTIPLIER`: スプリント時の速度倍率。
-   `JUMP_FORCE`: ジャンプ時の垂直方向の初速。
-   `DECELERATION`: 入力がない場合の減速率。1に近いほどゆっくり止まる。
-   `MIN_VELOCITY`: 速度を0と見なすための閾値。

## 実行順序

このシステムの実行順序は、物理シミュレーションの正確性を保証する上で極めて重要です。

`inputPollingSystem` -> `cameraControlSystem` -> **`playerMovementSystem`** -> `physicsSystem` -> `collisionSystem`

1.  `inputPollingSystem` と `cameraControlSystem` の**後**に実行されることで、常に最新の入力と視点情報に基づいて移動計算ができます。
2.  `physicsSystem` と `collisionSystem` の**前**に実行されることで、ここで計算された「移動の意図」としての速度が、その後の物理演算（重力適用）と衝突解決に正しく反映されます。