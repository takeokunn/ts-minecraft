# 機能仕様: レンダリング (Rendering)

このドキュメントは、ECS（Entity Component System）のワールド状態を画面に描画するプロセスに関する仕様を定義します。このロジックは `renderSystem` が担当し、`Three.js` ライブラリを具体的な描画バックエンドとして利用します。

## 1. 責務

`renderSystem` は、`World` から描画可能なエンティティの情報を読み取り、それを `Three.js` のシーンオブジェクトに変換する責務を持ちます。主な役割は以下の通りです。

-   プレイヤーの `Position` と `CameraState` に基づいて、`Three.js` のカメラを更新する。
-   `Renderable` コンポーネントを持つエンティティを、`InstancedMesh` を用いて効率的に描画する。
-   `InstancedMesh` オブジェクトのライフサイクル（生成、管理）を担当する。
-   `interactionSystem` が使用するマッピング情報 (`RenderContext`) を毎フレーム更新する。

## 2. 対象コンポーネント

-   **`Position`**: ワールド内でのエンティティの位置 (`x`, `y`, `z`)。
-   **`Renderable`**: エンティティが描画可能であることを示すコンポーネント。ジオメトリの種類 (`geometry`) とブロックの種類 (`blockType`) を含みます。
-   **`CameraState`**: プレイヤーエンティティに付与され、カメラの回転 (`pitch`, `yaw`) を保持します。

## 3. 描画パイプライン

`renderSystem` は毎フレーム、以下の処理を実行します。

### ステップ1: カメラの更新

-   **目的**: ECSのプレイヤー状態を`Three.js`のカメラに反映させます。
-   **プロセス**:
    1.  プレイヤーエンティティの `Position` と `CameraState` をクエリします。
    2.  カメラの位置をプレイヤーの `Position` に基づいて設定します。この際、リアルな視点を表現するため、y座標に `+1.6` のオフセットを加えて目線の高さに合わせます。
    3.  **ECSを信頼できる情報源 (Source of Truth) とする**: `PointerLockControls` の内部状態を上書きする形で、カメラの回転を `CameraState` の `yaw` と `pitch` に正確に同期させます。これにより、プレイヤーの向きは常にECSの状態によって決定されることが保証されます。

### ステップ2: インスタンスメッシュによる描画

-   **目的**: ワールド内の大量のブロックを、単一の描画コールで効率的にレンダリングします。
-   **アルゴリズム**:
    1.  **レジストリ**: `BlockType` をキー、`THREE.InstancedMesh` を値とする `Map`（レジストリ）を内部的に保持します。
    2.  **メッシュの準備**:
        -   まず、レジストリ内のすべての `InstancedMesh` の描画カウントを `0` にリセットします。
        -   `Position` と `Renderable` を持つすべてのエンティティを `World` からクエリします。
    3.  **エンティティの走査とマトリクス設定**:
        -   各エンティティについて、その `blockType` に対応する `InstancedMesh` をレジストリから取得します（存在しない場合は、`MaterialManager` からマテリアルを取得して新規作成し、シーンに追加します）。
        -   エンティティの `Position` に基づいて変換マトリクス (`THREE.Matrix4`) を作成し、`mesh.setMatrixAt()` を使ってインスタンスの位置として設定します。
        -   この際、`RenderContext` の `instanceIdToEntityId` マップを更新し、どのインスタンスがどのエンティティIDに対応するかを記録します。
    4.  **描画の確定**:
        -   すべてのエンティティの処理が終わったら、各 `InstancedMesh` の `count` プロパティを、そのフレームで描画すべきインスタンスの総数に更新します。
        -   最後に `mesh.instanceMatrix.needsUpdate = true` を設定し、`Three.js` にインスタンス情報が変更されたことを伝えます。

-   **`MAX_INSTANCES`**: 各 `InstancedMesh` が保持できるインスタンスの最大数。現在は `50,000` に設定されています。

## 4. 関連サービス

-   **`MaterialManager`**: ブロックの種類 (`blockType`) に応じた `THREE.Material` を提供するサービス。テクスチャ管理を抽象化します。
-   **`RenderContext`**: `interactionSystem` が使用する `instanceId` と `EntityId` のマッピング情報を保持します。`renderSystem` はこのマップの更新を担当します。