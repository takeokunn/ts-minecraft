# 共通クエリ一覧 (Query List)

このドキュメントは、`src/domain/queries.ts` で定義されている共通のクエリオブジェクトについて解説します。

クエリを共通化することで、各システムは `World` からどのような条件でデータを取得するかの詳細を意識する必要がなくなり、コードの可読性と保守性が向上します。

- **関連ソース**: [`src/domain/queries.ts`](../../src/domain/queries.ts)

---

### `playerQuery`

- **目的**: 移動やインタラクションに必要な主要コンポーネントを持つプレイヤーエンティティを取得します。
- **コンポーネント**: `player`, `position`, `velocity`, `inputState`, `cameraState`, `hotbar`

### `playerTargetQuery`

- **目的**: ブロックのターゲティングに必要なコンポーネントを持つプレイヤーエンティティを取得します。
- **コンポーネント**: `player`, `inputState`, `target`, `hotbar`

### `playerColliderQuery`

- **目的**: 衝突検知に必要なコンポーネントを持つプレイヤーエンティティを取得します。
- **コンポーネント**: `player`, `position`, `velocity`, `collider`

### `positionColliderQuery`

- **目的**: 位置と当たり判定を持つすべてのエンティティを取得します。主に衝突対象の障害物（ブロックなど）を見つけるために使われます。
- **コンポーネント**: `position`, `collider`

### `physicsQuery`

- **目的**: 物理演算（重力）の影響を受けるエンティティを取得します。
- **コンポーネント**: `position`, `velocity`, `gravity`, `player`

### `chunkQuery`

- **目的**: チャンクのマーカーエンティティを取得します。
- **コンポーネント**: `chunk`

### `chunkLoaderQuery`

- **目的**: チャンクロード状態を管理するエンティティを取得します。
- **コンポーネント**: `chunkLoaderState`

### `playerMovementQuery`

- **目的**: 移動ベクトルの計算に必要なコンポーネントを持つプレイヤーエンティティを取得します。
- **コンポーネント**: `player`, `inputState`, `velocity`, `cameraState`

### `playerInputQuery`

- **目的**: 生の入力状態を持つプレイヤーエンティティを取得します。
- **コンポーネント**: `player`, `inputState`

### `terrainBlockQuery`

- **目的**: レイキャストやワールド操作の対象となる、すべての地形ブロックを取得します。
- **コンポーネント**: `terrainBlock`, `position`