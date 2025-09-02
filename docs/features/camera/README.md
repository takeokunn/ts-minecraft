# Camera Systems

カメラの振る舞いは、責務が明確に分離された複数のシステムによって管理されます。これにより、入力処理、ゲームロジック、レンダリングが疎結合に保たれます。

- **関連ソース**: [`src/infrastructure/camera-three.ts`](../../src/infrastructure/camera-three.ts)

---

## システムの役割分担

### 1. カメラ制御システム (Camera Control System)

- **責務**: **入力 → 状態**
- **概要**: ユーザーのマウス入力を受け取り、プレイヤーエンティティの `CameraState` コンポーネント（`yaw`, `pitch`）を更新します。詳細はリンク先のドキュメントを参照してください。

### 2. カメラサービス (`camera-three.ts`)

- **責務**: **状態 → レンダリングエンジン**
- **概要**: プレイヤーの `Position` と `CameraState` コンポーネントを読み取り、その情報を使ってThree.jsのカメラ (`THREE.Camera`) の位置と回転を同期させます。これは独立したシステムではなく、`RendererThree`サービスの一部として、レンダリングループ内で直接実行されます。

## 実行順序

システムの実行順序は、データの依存関係を正しく反映するようにスケジューリングされています。

`cameraControlSystem` -> ... (物理演算など) ... -> `RendererThree` (内部でカメラ更新)

1.  `cameraControlSystem` がフレームの早い段階で実行され、プレイヤーの視点に関する「意図」が `CameraState` に反映されます。
2.  `physicsSystem` や `collisionSystem` などが実行され、プレイヤーの最終的な位置が `Position` コンポーネントに確定します。
3.  `RendererThree` がフレームの最後に実行され、確定した `Position` と `CameraState` をもとに、レンダリング直前のThree.jsカメラを正しい位置に設定します。

この設計により、ゲームロジックはレンダリングの詳細から完全に独立し、テストと保守が容易になります。

## カメラ制御システム (Camera Control System)

- **関連ソース**: [`src/systems/camera-control.ts`](../../src/systems/camera-control.ts)
- **責務**: ユーザーのマウス入力を `InputService` から受け取り、`CameraService` を通じてカメラの視点を更新し、その結果をプレイヤーの `CameraState` コンポーネントに反映すること。

---

### 概要

このシステムは、プレイヤーの視点操作を担当します。マウスの動きを検知し、それをカメラの回転（ヨーとピッチ）に変換します。ロジックの大部分を `CameraService` に委譲し、自身は状態の更新に集中することで、関心の分離を実現しています。

### 処理フロー

1.  **プレイヤーの検索**: `world.querySingle(Player, CameraState)` を使用して、対象となる単一のプレイヤーエンティティを検索します。
2.  **サービスの取得**: `InputService` と `CameraService` をEffectのコンテキストから取得します。
3.  **マウス入力の取得**: `inputService.getMouseState()` を呼び出し、前回のフレームからのマウスの移動量 (`dx`, `dy`) を取得します。
4.  **カメラの操作**:
    - `cameraService.moveRight(-mouseState.dx * SENSITIVITY)` を呼び出し、水平方向の回転（ヨー）を更新します。
    - `cameraService.rotatePitch(-mouseState.dy * SENSITIVITY)` を呼び出し、垂直方向の回転（ピッチ）を更新します。`CameraService` 内部で、ピッチが-90度から+90度の範囲にクランプ（制限）されます。
5.  **`CameraState` の更新**:
    - `cameraService.getYaw()` と `cameraService.getPitch()` を呼び出し、更新後のカメラの回転角度（ラディアン）を取得します。
    - `world.updateComponentData()` を使用して、プレイヤーエンティティの `CameraState` コンポーネントを最新のヨーとピッチの値で更新します。このAPIは、新しいコンポーネントインスタンスを生成しないため、パフォーマンス上のベストプラクティスです。

### データフロー

このシステムのデータフローは、入力からサービス、そして状態への一方向です。

`[InputService]` --(マウス移動量)--> `[cameraControlSystem]` --(操作コマンド)--> `[CameraService]` --(更新後の角度)--> `[cameraControlSystem]` --(更新)--> `[CameraState]`

この設計により、`cameraControlSystem` はカメラの具体的な実装（例: Three.jsの `Euler` や `Quaternion`）を知る必要がなく、テストが容易になります。

### 実行順序

このシステムは、`playerMovementSystem` よりも先に実行される必要があります。なぜなら、プレイヤーの移動方向はカメラの向き（特にヨー）に依存するため、移動計算の前に最新のカメラ状態が `CameraState` コンポーネントに反映されている必要があるからです。
