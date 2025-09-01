# Camera Systems

カメラの振る舞いは、責務が明確に分離された複数のシステムによって管理されます。これにより、入力処理、ゲームロジック、レンダリングが疎結合に保たれます。

-   **関連ソース**: [`src/infrastructure/camera-three.ts`](../../src/infrastructure/camera-three.ts)

---

## システムの役割分担

### 1. [カメラ制御システム](./camera-control.md)

-   **責務**: **入力 → 状態**
-   **概要**: ユーザーのマウス入力を受け取り、プレイヤーエンティティの `CameraState` コンポーネント（`yaw`, `pitch`）を更新します。詳細はリンク先のドキュメントを参照してください。

### 2. カメラサービス (`camera-three.ts`)

-   **責務**: **状態 → レンダリングエンジン**
-   **概要**: プレイヤーの `Position` と `CameraState` コンポーネントを読み取り、その情報を使ってThree.jsのカメラ (`THREE.Camera`) の位置と回転を同期させます。これは独立したシステムではなく、`RendererThree`サービスの一部として、レンダリングループ内で直接実行されます。

## 実行順序

システムの実行順序は、データの依存関係を正しく反映するようにスケジューリングされています。

`cameraControlSystem` -> ... (物理演算など) ... -> `RendererThree` (内部でカメラ更新)

1.  `cameraControlSystem` がフレームの早い段階で実行され、プレイヤーの視点に関する「意図」が `CameraState` に反映されます。
2.  `physicsSystem` や `collisionSystem` などが実行され、プレイヤーの最終的な位置が `Position` コンポーネントに確定します。
3.  `RendererThree` がフレームの最後に実行され、確定した `Position` と `CameraState` をもとに、レンダリング直前のThree.jsカメラを正しい位置に設定します。

この設計により、ゲームロジックはレンダリングの詳細から完全に独立し、テストと保守が容易になります。
