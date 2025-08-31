# プレイヤー移動システム (Player Movement System)

-   **ソース**: `src/systems/player-movement.ts`
-   **責務**: プレイヤーの `InputState` と `CameraState` に基づいて移動とジャンプの意図を計算し、その結果を `Velocity` コンポーネントに反映すること。

---

## 概要

このシステムは、プレイヤーの「移動したい」という意図を物理的な「速度」に変換する役割を担います。入力状態とカメラの向きから進むべき方向と速さを決定し、`Velocity` コンポーネントを更新します。実際の座標移動は、この後に実行される `physicsSystem` と `collisionSystem` が担当します。

## 処理フロー

1.  **効率的なデータ取得**: `world.querySoA(playerQuery)` を使用して、プレイヤーエンティティのコンポーネントデータ（`Player`, `InputState`, `Velocity`, `CameraState`）をStructure of Arrays (SoA) 形式で効率的に一括取得します。これにより、オブジェクト生成のオーバーヘッドを避け、高いパフォーマンスを維持します。
2.  **速度と方向の決定**:
    -   `InputState` の `sprint` フラグに応じて、基本速度 (`PLAYER_SPEED`) またはスプリント速度 (`PLAYER_SPEED * SPRINT_MULTIPLIER`) を設定します。
    -   `InputState` の `forward`, `backward`, `left`, `right` の状態と、`CameraState` の `yaw` (左右の向き) を元に、進むべき水平方向のベクトル (`dx`, `dz`) を三角関数 (`Math.sin`, `Math.cos`) を用いて計算します。
3.  **減速処理**:
    -   水平方向の入力がない場合、現在の速度 (`velocity.dx`, `velocity.dz`) に `DECELERATION` (減速率、例: 0.85) を乗算し、スムーズに停止させます。
    -   速度が非常に小さい値 (`MIN_VELOCITY`) になったら、完全に0にして不要な計算を防ぎます。
4.  **ジャンプ処理**:
    -   `InputState` の `jump` フラグが `true` で、かつ `Player` コンポーネントの `isGrounded` (接地しているか) フラグも `true` の場合にのみジャンプを実行します。
    -   `Velocity` の `dy` (垂直速度) に `JUMP_FORCE` を設定します。
    -   `world.updateComponentData` を使用して `Player` コンポーネントの `isGrounded` フラグを `false` に設定し、空中での連続ジャンプを防ぎます。
5.  **コンポーネントの更新**:
    -   計算された新しい速度 (`newDx`, `newDy`, `newDz`) を `world.updateComponentData` を使って `Velocity` コンポーネントに書き込みます。このAPIは不要なオブジェクト生成を避けるため、パフォーマンスに優れています。

## 主要な定数

システムの振る舞いは、ソースコード上部で定義された定数によって調整されます。

-   `PLAYER_SPEED`: 基本的な歩行速度。
-   `SPRINT_MULTIPLIER`: スプリント時の速度倍率。
-   `JUMP_FORCE`: ジャンプ時の垂直方向の初速。
-   `DECELERATION`: 入力がない場合の減速率。1に近いほどゆっくり止まる。
-   `MIN_VELOCITY`: 速度を0と見なすための閾値。

## 実行順序

このシステムは、以下の順序で実行されることが重要です。

`inputPollingSystem` -> `cameraControlSystem` -> **`playerMovementSystem`** -> `physicsSystem` -> `collisionSystem`

1.  `inputPollingSystem` と `cameraControlSystem` が実行された後であるため、常に最新の入力と視点情報に基づいて移動計算ができます。
2.  `physicsSystem` と `collisionSystem` の前に実行されるため、ここで計算された速度がその後の物理演算と衝突解決に正しく反映されます。
