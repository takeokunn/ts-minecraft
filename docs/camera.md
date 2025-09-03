# カメラ (Camera)

カメラの振る舞いは、責務が明確に分離された複数のシステムやサービスによって管理されます。これにより、入力処理、ゲームロジック、レンダリングが疎結合に保たれます。

- **関連ソース**:
  - [`src/systems/camera-control.ts`](../../src/systems/camera-control.ts)
  - [`src/infrastructure/camera-three.ts`](../../src/infrastructure/camera-three.ts)
  - [`src/domain/camera-logic.ts`](../../src/domain/camera-logic.ts)

---

## システムとサービスの役割分担

### 1. カメラ制御システム (`cameraControlSystem`)

- **責務**: **入力 → 状態**
- **概要**: ユーザーのマウス入力を `InputManager` サービスから受け取り、プレイヤーエンティティの `CameraState` コンポーネント（`yaw`, `pitch`）を更新します。

### 2. カメラロジック (`camera-logic.ts`)

- **責務**: **純粋な計算**
- **概要**: カメラの回転（ヨーとピッチ）に関する計算ロジックを提供する純粋な関数の集まりです。例えば、ピッチを-90度から+90度の範囲にクランプ（制限）する処理などが含まれます。状態を持たず、副作用もありません。

### 3. カメラサービス (`camera-three.ts`)

- **責務**: **状態 → レンダリングエンジン**
- **概要**: プレイヤーの `Position` と `CameraState` コンポーネントを読み取り、その情報を使ってThree.jsのカメラ (`THREE.Camera`) の位置と回転を同期させます。これは独立したシステムではなく、`RendererThree`サービスの一部として、レンダリングループ内で直接実行されます。

---

## `cameraControlSystem` の詳細

### 処理フロー

1.  **プレイヤーの検索**: `world.query` を使用して、`Player` と `CameraState` コンポーネントを持つエンティティを検索します。
2.  **入力の取得**: `InputManager` サービスから、前回のフレームからのマウスの移動量 (`dx`, `dy`) を取得します。
3.  **回転の計算**:
    - `camera-logic.ts` の純粋関数を呼び出し、現在の `yaw` と `pitch` にマウスの移動量を加味した新しい回転角度を計算します。
    - この際、ピッチは上下90度以内に制限されます。
4.  **`CameraState` の更新**:
    - 計算された新しい `yaw` と `pitch` の値で、プレイヤーエンティティの `CameraState` コンポーネントを更新します。

### データフロー

`[InputManager]` --(マウス移動量)--> `[cameraControlSystem]` --(現在の角度, 移動量)--> `[camera-logic.ts]` --(計算後の角度)--> `[cameraControlSystem]` --(更新)--> `[CameraState]`

この設計により、`cameraControlSystem` はカメラの具体的な実装（例: Three.jsの `Euler` や `Quaternion`）を知る必要がなく、テストが容易になります。

---

## 実行順序

システムの実行順序は、データの依存関係を正しく反映するようにスケジューリングされています。

`inputPollingSystem` -> **`cameraControlSystem`** -> `playerMovementSystem` -> ... (物理演算など) ... -> `RendererThree` (内部でカメラ更新)

1.  `inputPollingSystem` が実行され、最新の入力状態が `InputManager` に反映されます。
2.  **`cameraControlSystem`** が実行され、プレイヤーの視点に関する「意図」が `CameraState` に反映されます。
3.  `playerMovementSystem` は、更新された `CameraState` を使って、プレイヤーが向いている方向に正しく移動するように `Velocity` を計算します。
4.  `physicsSystem` や `collisionSystem` などが実行され、プレイヤーの最終的な位置が `Position` コンポーネントに確定します。
5.  `RendererThree` がフレームの最後に実行され、確定した `Position` と `CameraState` をもとに、レンダリング直前のThree.jsカメラを正しい位置に設定します。

この設計により、ゲームロジックはレンダリングの詳細から完全に独立し、テストと保守が容易になります。
