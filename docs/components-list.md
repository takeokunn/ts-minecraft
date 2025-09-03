# コンポーネント一覧 (Component List)

このドキュメントは、`src/domain/components.ts` で定義されている全てのコンポーネントについて、その役割とプロパティを解説します。

コンポーネントはECSアーキテクチャの根幹をなす純粋なデータコンテナであり、すべて `@effect/schema/Schema` の `S.Class` を用いて定義されています。これにより、型安全とランタイムの検証が保証されます。

- **関連ソース**: [`src/domain/components.ts`](../../src/domain/components.ts)

---

## 物理・位置情報

### `Position`

- **役割**: エンティティの3D空間における位置を定義します。
- **プロパティ**: `x`, `y`, `z` (Float)

### `Velocity`

- **役割**: エンティティの速度ベクトルを定義します。`physicsSystem` がこの値に基づいて `Position` を更新します。
- **プロパティ**: `dx`, `dy`, `dz` (Float)

### `Collider`

- **役割**: エンティティの物理的な境界ボックス（AABB）を定義します。`collisionSystem` が衝突検知に使用します。
- **プロパティ**: `width`, `height`, `depth` (Float)

### `Gravity`

- **役割**: エンティティが重力の影響を受けることを示します。
- **プロパティ**: `value` (Float)

---

## プレイヤー関連

### `Player`

- **役割**: エンティティをプレイヤーとして識別するためのタグコンポーネント。
- **プロパティ**: `isGrounded` (Boolean) - プレイヤーが地面に接しているかどうか。

### `InputState`

- **役割**: `inputPollingSystem` によって毎フレーム更新される、プレイヤーの現在の入力状態のスナップショット。
- **プロパティ**: `forward`, `backward`, `left`, `right`, `jump`, `sprint`, `place`, `destroy`, `isLocked` (Boolean)

### `CameraState`

- **役割**: プレイヤーの視点（カメラ）の回転を保持します。
- **プロパティ**: `pitch`, `yaw` (Float) - 上下・左右の回転（ラジアン）。

### `Hotbar`

- **役割**: プレイヤーのホットバーの状態を管理します。
- **プロパティ**:
  - `slots` (Array<BlockType>): ホットバーのスロットに対応するブロックの種類の配列。
  - `selectedIndex` (Int): 現在選択されているスロットのインデックス。

### `Target`

- **役割**: `raycastSystem` によってプレイヤーに付与されるコンポーネント。プレイヤーが視線の先で狙っている対象の情報。
- **型**: `S.Union(TargetBlock, TargetNone)`
  - **`TargetBlock`**: ブロックをターゲットしている状態。
    - `_tag`: `"block"`
    - `entityId` (EntityId): ターゲットブロックのエンティティID。
    - `face` (Vector3Int): 視線が当たった面の法線ベクトル。
    - `position` (Position): ターゲットブロックの位置。
  - **`TargetNone`**: 何もターゲットしていない状態。
    - `_tag`: `"none"`

---

## ワールド・チャンク関連

### `TerrainBlock`

- **役割**: ワールド生成時に作られた、自然の地形を構成するブロックであることを示すタグコンポーネント。

### `Chunk`

- **役割**: ロード済みのチャンクを示すマーカーエンティティ。
- **プロパティ**:
  - `chunkX`, `chunkZ` (Int): チャンクのグリッド座標。
  - `blocks` (Array<BlockType>): チャンク内のブロックデータの配列。

### `ChunkLoaderState`

- **役割**: どのチャンクがロード済みかを管理するグローバルな状態を持つコンポーネント。
- **プロパティ**: `loadedChunks` (ReadonlySet<string>) - ロード済みチャンクのキーを保持するセット。

---

## レンダリング・UI関連

### `Renderable`

- **役割**: エンティティが個別のメッシュとしてレンダリング対象であることを示します。
- **プロパティ**:
  - `geometry` (String): 描画するジオメトリの種類 (例: `"box"`)。
  - `blockType` (BlockType): 描画に使用するテクスチャを決定します。

### `InstancedMeshRenderable`

- **役割**: エンティティが `InstancedMesh` を用いて効率的にレンダリングされることを示します。
- **プロパティ**: `meshType` (String) - 使用する `InstancedMesh` の種類を識別する文字列。

### `Camera`

- **役割**: Three.jsのカメラと同期させるためのエンティティ。
- **プロパティ**:
  - `position` (Position): カメラの位置。
  - `target` (Position, optional): カメラの注視点。
  - `damping` (Float): カメラの動きのダンピング係数。

### `TargetBlockComponent`

- **役割**: プレイヤーがターゲットしているブロックを視覚的に示すためのエンティティ（ワイヤーフレームなど）を識別するタグコンポーネント。
