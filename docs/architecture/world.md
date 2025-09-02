# Worldアーキテクチャ

`World` は、ECSアーキテクチャの中心となるサービスであり、すべてのエンティティとコンポーネントの状態を一元管理する唯一の信頼できる情報源（Source of Truth）です。その実装は、現代のゲームエンジンで採用されている高性能な設計原則に基づいています。

## 1. コア設計: Archetype + Structure of Arrays (SoA)

パフォーマンスを最大化するため、`World` は **Archetype（アーキタイプ）** と **Structure of Arrays (SoA)** という2つの強力なコンセプトを組み合わせています。

### Archetype (アーキタイプ)

- **概要**: Archetypeとは、「`Position`と`Velocity`を持つエンティティの集まり」といった、**コンポーネントの型の組み合わせ**そのものを指します。
- **動作**: エンティティは、自身が持つコンポーネントの構成によって、対応するArchetypeに自動的に分類されます。
- **利点**: `queryEntities({ all: [Position, Velocity] })`のようなクエリは、ワールド内の全エンティティを走査する必要がありません。代わりに、`Position`と`Velocity`の両方を持つArchetype群を直接参照するため、極めて高速に動作します。

### Structure of Arrays (SoA)

- **概要**: SoAは、データをメモリ上にどのように配置するかという設計パターンです。`World`の内部では、コンポーネントのプロパティごとに`Float32Array`のような型付き配列でデータを保持します。

- **AoS (低効率な例)**:

  ```
  // Positionコンポーネントのオブジェクト配列
  [{x: 1, y: 2, z: 3}, {x: 4, y: 5, z: 6}, ...]
  ```

  この場合、`x`の値だけを連続して処理したくても、メモリ上では`y`や`z`のデータによって分断されており、CPUのキャッシュ効率が悪化します。

- **SoA (本プロジェクトの採用方式)**:
  ```typescript
  // PositionコンポーネントのSoAストア
  {
    x: Float32Array([1, 4, ...]), // xの値がメモリ上で連続
    y: Float32Array([2, 5, ...]), // yの値がメモリ上で連続
    z: Float32Array([3, 6, ...])  // zの値がメモリ上で連続
  }
  ```
  物理演算システムがすべてのエンティティの`x`座標を更新するような場合、データがメモリ上で連続しているため、CPUはキャッシュを最大限に活用でき、処理が劇的に高速化されます。

このArchetypeとSoAの組み合わせにより、`World`は高いクエリ性能とデータ処理性能を両立しています。

## 2. World API

`World`からエンティティやコンポーネントを操作するためのAPIは、パフォーマンスを最優先するように設計されています。

### `queryEntities`: エンティティIDのリストを取得

- **目的**: 特定のコンポーネント構成を持つエンティティのIDリストを高速に取得します。
- **戻り値**: `EntityId[]`
- **規約**: システムが処理対象のエンティティを見つけるための主要なエントリーポイントです。

```typescript
// Position と Velocity を持つエンティティのIDを取得
const entities = yield * _(queryEntities({ all: [Position, Velocity] }))
```

### `getComponentStore`: SoAストアへの直接アクセス

- **目的**: 特定のコンポーネントのSoAストアへの参照を取得します。
- **戻り値**: `ComponentSoAStore` (例: `{ x: Float32Array, y: Float32Array, ... }`)
- **規約**: `queryEntities`で取得したIDを使い、このAPIで得られたストアの配列を直接読み書きします。これにより、**ループ内でのメモリアロケーションを完全にゼロ**にし、GC負荷を最小限に抑えます。

```typescript
const entities = yield * _(queryEntities({ all: [Position, Velocity] }))
const positions = yield * _(getComponentStore(Position))
const velocities = yield * _(getComponentStore(Velocity))

for (const id of entities) {
  // SoAストアのデータを直接読み書き
  positions.x[id] += velocities.dx[id]
  positions.y[id] += velocities.dy[id]
  positions.z[id] += velocities.dz[id]
}
```

### 発展的なクエリ

クエリオブジェクトを使用することで、より複雑な条件を指定できます。

- `all`: 指定したすべてのコンポーネントを持つエンティティを検索します。
- `not`: 指定したコンポーネントを**持たない**エンティティを検索します。

```typescript
// Playerコンポーネントを持つが、Frozenコンポーネントは持たないエンティティを取得
const entities =
  yield *
  queryEntities({
    all: [Player, Position],
    not: [Frozen],
  })
```

すべてのクエリは、保守性を高めるために `src/domain/queries.ts` で共通化することが推奨されます。

## 3. ライフサイクルと状態変更

エンティティとコンポーネントの生成、削除はすべて`World`サービスを通じて行います。

- `createEntity(...components)`: 新しいエンティティを生成します。
- `removeEntity(id)`: エンティティとそれに関連するすべてのコンポーネントを削除します。

**注意**:
ゲームループ内でコンポーネントを追加・削除する操作（エンティティをArchetype間で移動させる操作）は、非常に高コストな処理です。そのため、本プロジェクトの`World` APIでは意図的に実装されていません。エンティティの構造は、原則として生成時に決定されるべきです。

---

より高レベルなAPI（`createEntity`, `query`など）の具体的な使用方法については、[\*\*Worldサービス仕様 (features/world.md)](./../features/world.md) を参照してください。
