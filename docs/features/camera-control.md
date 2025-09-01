# カメラ制御システム (Camera Control System)

-   **関連ソース**: [`src/systems/camera-control.ts`](../../src/systems/camera-control.ts)
-   **責務**: ユーザーのマウス入力を `InputService` から受け取り、`CameraService` を通じてカメラの視点を更新し、その結果をプレイヤーの `CameraState` コンポーネントに反映すること。

---

## 概要

このシステムは、プレイヤーの視点操作を担当します。マウスの動きを検知し、それをカメラの回転（ヨーとピッチ）に変換します。ロジックの大部分を `CameraService` に委譲し、自身は状態の更新に集中することで、関心の分離を実現しています。

## 処理フロー

1.  **プレイヤーの検索**: `world.querySingle(Player, CameraState)` を使用して、対象となる単一のプレイヤーエンティティを検索します。
2.  **サービスの取得**: `InputService` と `CameraService` をEffectのコンテキストから取得します。
3.  **マウス入力の取得**: `inputService.getMouseState()` を呼び出し、前回のフレームからのマウスの移動量 (`dx`, `dy`) を取得します。
4.  **カメラの操作**:
    -   `cameraService.moveRight(-mouseState.dx * SENSITIVITY)` を呼び出し、水平方向の回転（ヨー）を更新します。
    -   `cameraService.rotatePitch(-mouseState.dy * SENSITIVITY)` を呼び出し、垂直方向の回転（ピッチ）を更新します。`CameraService` 内部で、ピッチが-90度から+90度の範囲にクランプ（制限）されます。
5.  **`CameraState` の更新**:
    -   `cameraService.getYaw()` と `cameraService.getPitch()` を呼び出し、更新後のカメラの回転角度（ラディアン）を取得します。
    -   `world.updateComponentData()` を使用して、プレイヤーエンティティの `CameraState` コンポーネントを最新のヨーとピッチの値で更新します。このAPIは、新しいコンポーネントインスタンスを生成しないため、パフォーマンス上のベストプラクティスです。

## データフロー

このシステムのデータフローは、入力からサービス、そして状態への一方向です。

`[InputService]` --(マウス移動量)--> `[cameraControlSystem]` --(操作コマンド)--> `[CameraService]` --(更新後の角度)--> `[cameraControlSystem]` --(更新)--> `[CameraState]`

この設計により、`cameraControlSystem` はカメラの具体的な実装（例: Three.jsの `Euler` や `Quaternion`）を知る必要がなく、テストが容易になります。

## 実行順序

このシステムは、`playerMovementSystem` よりも先に実行される必要があります。なぜなら、プレイヤーの移動方向はカメラの向き（特にヨー）に依存するため、移動計算の前に最新のカメラ状態が `CameraState` コンポーネントに反映されている必要があるからです。
