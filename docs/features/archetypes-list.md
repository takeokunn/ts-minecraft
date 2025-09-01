# アーキタイプ一覧 (Archetype List)

このドキュメントは、`src/domain/archetypes.ts`で定義されている主要なエンティティのテンプレート（アーキタイプ/プリファブ）について解説します。

アーキタイプは、特定の役割を持つエンティティを生成するためのファクトリ関数です。これにより、エンティティの構成がカプセル化され、一貫性が保たれます。

- **関連ソース**: [`src/domain/archetypes.ts`](../../src/domain/archetypes.ts)

---

## `createPlayer`

- **目的**: プレイヤーエンティティを生成します。
- **引数**:
  - `position` ({ x: number; y: number; z: number }): プレイヤーの初期スポーン位置。
- **構成コンポーネント**:
  - `Player`: プレイヤーであることを示すタグ。
  - `Position`: 初期位置。
  - `Velocity`: 初期速度 (0, 0, 0)。
  - `Gravity`: 重力の影響を受けるように設定。
  - `CameraState`: カメラの初期回転 (0, 0)。
  - `InputState`: 全ての入力が`false`の初期状態。
  - `Collider`: プレイヤーの物理的な当たり判定。
  - `Hotbar`: 初期アイテムを持つホットバー。
  - `InstancedMeshRenderable`: `"player"`メッシュとしてレンダリングされるように設定。

## `createBlock`

- **目的**: ワールド内にブロックエンティティを生成します。
- **引数**:
  - `position` ({ x: number; y: number; z: number }): ブロックの設置位置。
  - `blockType` (BlockType): 設置するブロックの種類 (`grass`, `dirt`など)。
- **構成コンポーネント**:
  - `Position`: 設置位置。
  - `Block`: ブロックの種類を保持。
  - `Renderable`: `"box"`ジオメトリとしてレンダリングされるように設定。
  - `TerrainBlock`: ワールドの地形を構成するブロックであることを示すタグ。
