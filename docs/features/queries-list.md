# 共通クエリ一覧 (Query List)

このドキュメントは、`src/domain/queries.ts`で定義されている共通のクエリオブジェクトについて解説します。

クエリを共通化することで、各システムは`World`からどのような条件でデータを取得するかの詳細を意識する必要がなくなり、コードの可読性と保守性が向上します。

---

### `playerQuery`

- **目的**: プレイヤーエンティティを特定するためのクエリ。
- **対象コンポーネント**: `Player`, `Position`, `Velocity`, `CameraState`, `InputState`
- **使用システム例**: `playerMovementSystem`

### `physicsQuery`

- **目的**: 物理演算（特に重力）の影響を受けるすべてのエンティティを取得します。
- **対象コンポーネント**: `Position`, `Velocity`, `Gravity`
- **使用システム例**: `physicsSystem`

### `playerColliderQuery`

- **目的**: 物理的な当たり判定を持つプレイヤーエンティティを取得します。
- **対象コンポーネント**: `Player`, `Position`, `Velocity`, `Collider`
- **使用システム例**: `collisionSystem`

### `positionColliderQuery`

- **目的**: 位置と当たり判定を持つすべてのエンティティを取得します。主に衝突対象のオブジェクト（ブロックなど）を取得するために使われます。
- **対象コンポーネント**: `Position`, `Collider`
- **使用システム例**: `collisionSystem`

### `sceneQuery`

- **目的**: シーンに描画されるべきすべてのエンティティを取得します。
- **対象コンポーネント**: `Position`, `Renderable`
- **使用システム例**: `sceneSystem` (旧)

### `terrainQuery`

- **目的**: ワールドの地形を構成するすべてのエンティティを取得します。
- **対象コンポーネント**: `TerrainBlock`, `Chunk`
- **使用システム例**: `chunk-loading` (アンロード処理など)

### `instancedRenderableQuery`

- **目的**: `InstancedMesh`を使って描画されるべきすべてのエンティティを取得します。
- **対象コンポーネント**: `InstancedMeshRenderable`, `Position`
- **使用システム例**: `renderer-three.ts` (レンダリングループ内)
