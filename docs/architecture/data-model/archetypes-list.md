# アーキタイプ一覧 (Archetype List)

このドキュメントは、`src/domain/archetypes.ts` で定義されているエンティティのテンプレート（アーキタイプ）について解説します。

アーキタイプは、特定の役割を持つエンティティを生成するためのコンポーネントの組み合わせです。本プロジェクトでは、`createArchetype` ファクトリ関数に `ArchetypeBuilder` オブジェクトを渡すことで、目的のアーキタイプを生成します。これにより、エンティティの構成がカプセル化され、一貫性が保たれます。

- **関連ソース**: [`src/domain/archetypes.ts`](../../src/domain/archetypes.ts)

---

## `createArchetype`

`createArchetype` は、`ArchetypeBuilder` を引数に取り、対応するコンポーネントの集合（`Archetype`）を返します。

```typescript
// src/domain/archetypes.ts
export const createArchetype = (builder: ArchetypeBuilder): Archetype => {
  return (
    match(builder)
      .with({ type: 'player' }, ({ pos }) => playerArchetype(pos))
      .with({ type: 'block' }, ({ pos, blockType }) => blockArchetype(pos, blockType))
      // ...
      .exhaustive()
  )
}
```

---

## `ArchetypeBuilder` の種類

### `{ type: 'player' }`

- **目的**: プレイヤーエンティティを生成します。
- **パラメータ**:
  - `pos` (Position): プレイヤーの初期スポーン位置。
- **構成コンポーネント**:
  - `Player`
  - `Position`
  - `Velocity`
  - `Gravity`
  - `CameraState`
  - `InputState`
  - `Collider`
  - `Hotbar`
  - `Target` (`TargetNone` で初期化)

### `{ type: 'block' }`

- **目的**: ワールド内にブロックエンティティを生成します。
- **パラメータ**:
  - `pos` (Position): ブロックの設置位置。
  - `blockType` (BlockType): 設置するブロックの種類 (`grass`, `dirt`など)。
- **構成コンポーネント**:
  - `Position`
  - `Renderable`
  - `Collider`
  - `TerrainBlock`

### `{ type: 'camera' }`

- **目的**: Three.jsのカメラと同期するためのエンティティを生成します。
- **パラメータ**:
  - `pos` (Position): カメラの初期位置。
- **構成コンポーネント**:
  - `Camera`
  - `Position`

### `{ type: 'targetBlock' }`

- **目的**: プレイヤーがターゲットしているブロックを視覚的に示すためのエンティティ（例: ワイヤーフレーム）を生成します。
- **パラメータ**:
  - `pos` (Position): ターゲットブロックの位置。
- **構成コンポーネント**:
  - `Position`
  - `TargetBlockComponent`

### `{ type: 'chunk' }`

- **目的**: ロード済みのチャンクを示すマーカーエンティティを生成します。
- **パラメータ**:
  - `chunkX` (Int): チャンクのX座標。
  - `chunkZ` (Int): チャンクのZ座標。
- **構成コンポーネント**:
  - `Chunk`