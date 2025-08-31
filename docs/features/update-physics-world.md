# updatePhysicsWorldSystem

`updatePhysicsWorldSystem` は、物理エンジン、特に衝突検知システムの効率と正確性を維持するための、フレームごとのハウスキーピング（整理）システムです。

-   **ソース**: `src/systems/update-physics-world.ts`

---

## 責務

このシステムの唯一の責務は、**`PhysicsWorld` サービス内の空間グリッドを、現在のフレームにおけるエンティティの最新の位置情報で更新すること**です。

`PhysicsWorld` サービスは、広域衝突検知（Broad-Phase Collision Detection）を高速化するために、エンティティの位置をグリッド構造で管理しています。あるエンティティの衝突をチェックする際、ワールド内のすべてのエンティティと総当たりで比較するのではなく、そのエンティティが属するグリッドセルと、その周辺のセルに存在するエンティティのみを候補とすることで、計算量を大幅に削減します。

しかし、エンティティは毎フレーム移動するため、この空間グリッドの情報はすぐに古くなってしまいます。`updatePhysicsWorldSystem` は、この情報を最新の状態に保つ役割を担います。

---

## 関連コンポーネント

このシステムは、物理的な実体を持つすべてのエンティティを対象とします。

-   **`Position`**: エンティティの現在位置。
-   **`Collider`**: エンティティの衝突境界ボックス（AABB - Axis-Aligned Bounding Box）の寸法（幅、高さ、奥行き）。

---

## システムのロジック

システムの実行フローは、毎フレーム以下の手順で行われます。

1.  **クリア**: まず、`physicsWorld.clear()` を呼び出し、前のフレームの空間グリッド情報をすべて消去します。
2.  **クエリ**: `world.querySoA` と共通クエリ `colliderQuery` を使用して、`Position` と `Collider` の両方を持つすべてのエンティティの最新データを効率的に一括取得します。
3.  **再登録**:
    -   クエリ結果をループ処理し、各エンティティの `Position` と `Collider` の情報から、そのフレームでの正確なAABB（最小・最大のXYZ座標）を計算します。
    -   計算したAABBとエンティティIDを `physicsWorld.register(entityId, aabb)` に渡して空間グリッドに再登録するための `Effect` を生成し、配列に収集します。
    -   収集したすべての登録 `Effect` を `Effect.all` を使って並行に実行し、空間グリッドの再構築を高速に完了させます。

---

## 他のシステムとの連携

`updatePhysicsWorldSystem` の実行順序は、衝突検知の正確性を保証する上で非常に重要です。

`... movement systems (e.g., physicsSystem) ...` -> **`updatePhysicsWorldSystem`** -> `collisionSystem`

1.  **`physicsSystem`**: `Velocity` に基づいてエンティティの `Position` を更新します。これにより、エンティティが新しい位置に移動します。
2.  **`updatePhysicsWorldSystem` (このシステム)**: `physicsSystem` によって更新された**後**の最終的な位置を読み取り、`PhysicsWorld` の空間グリッドを更新します。
3.  **`collisionSystem`**: 更新されたばかりの最新の空間グリッドを利用して、効率的かつ正確な衝突検知を行います。

もしこのシステムの実行が `physicsSystem` の前だったり、`collisionSystem` の後だったりすると、衝突検知が1フレーム前の古い位置情報に基づいて行われることになり、トンネリング（オブジェクトのすり抜け）などの不具合を引き起こす原因となります。