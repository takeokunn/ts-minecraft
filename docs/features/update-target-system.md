# ターゲット更新システム (Update Target System)

このドキュメントは、プレイヤーの視線にあるオブジェクトを特定し、その情報を`Target`コンポーネントに記録する責務を持つ`updateTargetSystem`の仕様を定義します。

## 1. 設計思想: 関心の分離

この機能は、**関心の分離**を強く重視して設計されています。

- **`RaycastService` (インフラストラクチャ層)**: Three.jsのような特定のレンダリングエンジンを使用して、シーンに対してレイキャストを実行する*方法*を知っています。レンダラーの低レベルな詳細を抽象化します。
- **`updateTargetSystem` (システム層)**: レイキャストが*なぜ*必要なのかを知っています。`RaycastService`を呼び出して結果を取得し、プレイヤーの`Target`コンポーネントを更新します。
- **`blockInteractionSystem` (システム層)**: `Target`コンポーネントを読み取り、ブロックの設置や破壊などの*アクション*を実行します。

この設計により、ゲームロジック(`updateTargetSystem`)がレンダリングエンジンの詳細から完全に分離されることが保証されます。

## 2. `updateTargetSystem`の責務

`updateTargetSystem`の責務は、ワールドの状態をクエリし、その結果を別の状態として記録することに限定されています。

1.  **レイキャストの実行**: カメラの中心から発せられるレイキャストの結果を取得するために`RaycastService`を呼び出します。
2.  **ターゲットが見つかった場合**:
    - `RaycastService`は、ヒットしたメッシュの`instanceId`を含む交差情報を返します。`RenderContext`に保存されているマップを使用して、この`instanceId`を特定の`EntityId`に変換します。
    - システムは、プレイヤーエンティティに`Target`コンポーネントをアタッチ（または更新）します。このコンポーネントには、ターゲットブロックの`EntityId`、その`Position`、およびレイがヒットした面の法線ベクトルが含まれます。
    - また、`RenderContext`内の`TargetHighlight`状態を更新します。これは、`renderer`がターゲットブロックの周りに視覚的なハイライト（例：アウトライン）を描画するために使用します。
3.  **ターゲットが見つからない場合**:
    - プレイヤーエンティティから`Target`コンポーネントを削除します。
    - `RenderContext`の`TargetHighlight`状態をクリアし、シーンから視覚的なハイライトを削除します。

## 3. データフロー

`Input` -> `cameraControlSystem` -> `CameraState` -> `RaycastService` -> **`updateTargetSystem`** -> `Target`

1.  `cameraControlSystem`は`CameraState`コンポーネントのカメラの向きを更新します。
2.  `RaycastService`は、呼び出されると、内部的に現在のカメラ状態（Three.jsコンテキスト経由）を使用してレイキャストを実行します。
3.  `updateTargetSystem`は`RaycastService`を呼び出します。
4.  `updateTargetSystem`は返された結果を受け取り、プレイヤーエンティティに`Target`コンポーネントをアタッチします。
5.  `blockInteractionSystem`のような後続のシステムは、この`Target`コンポーネントを読み取って、プレイヤーが見ているものに基づいてアクションを実行できます。
