# レンダリングパイプライン (Rendering Pipeline)

このドキュメントは、ECSのワールド状態がどのようにして画面上のピクセルに変換されるか、つまりレンダリングパイプラインについて解説します。中心的な役割を担うのは `sceneSystem` (`src/systems/scene.ts`) です。

---

## 責務

`sceneSystem` の唯一の責務は、**現在のゲームワールドの状態を `RenderService` (Three.js) が理解できる形式に変換し、描画コマンドを発行すること**です。このシステムはゲームロジックには一切関与せず、状態の「可視化」にのみ集中します。

---

## 関連コンポーネント

レンダリングパイプラインは、以下のコンポーネントを持つエンティティを対象とします。

-   **`Position`**: 3D空間におけるエンティティの現在位置。オブジェクトがどこに描画されるかを決定します。
-   **`Renderable`**: エンティティが描画可能であることを示すコンポーネント。現在、描画するジオメトリの種類 (`geometry`) とブロックの種類 (`blockType`) を保持しており、これにより `MaterialManager` が適切なテクスチャを選択します。

---

## システムのロジック (`sceneSystem`)

`sceneSystem` は、パフォーマンスを最大化するために **Instanced Rendering** という技術を全面的に採用しています。これにより、同じ種類のブロック（例: 草ブロック）を何千個も描画する場合でも、描画命令を1回にまとめることができ、GPUの負荷を劇的に削減します。

システムの実行フローは以下の通りです。

1.  **クエリ**: `world.querySoA` を使用して、`Position` と `Renderable` の両方を持つすべてのエンティティのSoAデータを効率的に取得します。
2.  **インスタンス情報の収集**:
    -   クエリ結果をループ処理し、各エンティティの位置とブロック種別を読み取ります。
    -   ブロック種別ごとに、描画すべきインスタンスの位置情報を集約します。
3.  **InstancedMeshの更新**:
    -   `sceneSystem` は、ブロック種別ごとに `THREE.InstancedMesh` のインスタンスを保持しています。
    -   ループの開始時に、すべての `InstancedMesh` の `count` を `0` にリセットします。
    -   収集したインスタンス情報に基づき、各 `InstancedMesh` の `setMatrixAt` メソッドを呼び出して、個々のインスタンス（ブロック）の位置をGPUに伝達します。
    -   最後に、更新されたインスタンスの総数を `mesh.count` に設定し、`mesh.instanceMatrix.needsUpdate = true` をセットして、次のレンダリングフレームで変更が反映されるようにします。
4.  **エンティティIDのマッピング**:
    -   `RaycastService` がマウスカーソル下のブロックを特定できるように、`InstancedMesh` のインスタンスID（`0`, `1`, `2`...）とECSの `EntityId` をマッピングする情報を `RenderContext` サービスに格納します。

```typescript
// src/systems/scene.ts より (主要部分)
const { entities, positions, renderables } = yield* _(
  world.querySoA(Position, Renderable),
);

// 1. カウントをリセット
for (const mesh of meshRegistry.values()) {
  mesh.count = 0;
}

// 2. インスタンス情報を収集・更新
for (let i = 0; i < entities.length; i++) {
  const id = entities[i];
  const blockType = renderables.blockType[i] as BlockType;
  const mesh = getOrCreateMesh(blockType); // ブロック種別に応じたInstancedMeshを取得
  const count = counts.get(blockType) ?? 0;

  // 3. 位置行列を設定
  matrix.setPosition(positions.x[i], positions.y[i], positions.z[i]);
  mesh.setMatrixAt(count, matrix);

  // ... IDマッピングとカウント更新
}

// 4. 最終的な更新をGPUに通知
for (const mesh of meshRegistry.values()) {
  mesh.instanceMatrix.needsUpdate = true;
}
```

---

## 他のシステムとの連携

`sceneSystem` は、通常、すべてのゲームロジック（移動、衝突、ブロックの追加/削除など）が完了した後に実行されるべきです。これにより、そのフレームでの最終的なワールドの状態が正確に画面に描画されることが保証されます。

`... all game logic systems ...` -> `cameraSystem` -> **`sceneSystem`**

-   **`cameraSystem`**: プレイヤーの位置やマウスの動きに基づいてカメラの位置と向きを更新します。
-   **`sceneSystem` (このシステム)**: `cameraSystem` によって設定された視点から見えるワールドの状態を描画します。

この明確な分離により、レンダリングロジックはゲームの他の部分から独立して最適化することが可能になっています。
