# World Architecture

`World` は、ECSアーキテクチャの中心となるサービスであり、すべてのエンティティとコンポーネントの状態を一元管理する唯一の信頼できる情報源（Source of Truth）です。その実装は、現代のゲームエンジンで採用されている高性能な設計原則に基づいています。

## 1. コア設計: Archetype + Structure of Arrays (SoA)

パフォーマンスを最大化するため、`World` は **Archetype（アーキタイプ）** と **Structure of Arrays (SoA)** という2つの強力なコンセプトを組み合わせています。

### Archetype (アーキタイプ)

-   **概要**: Archetypeとは、「`Position`と`Velocity`を持つエンティティの集まり」といった、**コンポーネントの型の組み合わせ**そのものを指します。
-   **動作**: エンティティは、自身が持つコンポーネントの構成によって、対応するArchetypeに自動的に分類されます。例えば、エンティティに`Gravity`コンポーネントを追加すると、そのエンティティは現在のArchetypeから`Gravity`を含む新しいArchetypeへと移動します。
-   **利点**: `world.query(Position, Velocity)`のようなクエリは、ワールド内の全エンティティを走査する必要がありません。代わりに、`Position`と`Velocity`の両方を持つArchetype群を直接参照するため、極めて高速に動作します。

### Structure of Arrays (SoA)

-   **概要**: SoAは、データをメモリ上にどのように配置するかという設計パターンです。一般的なオブジェクトの配列（`Array of Structures`, AoS）とは対照的に、コンポーネントのプロパティごとに配列を用意します。

-   **AoS (低効率な例)**:
    ```
    // Positionコンポーネントの配列
    [{x: 1, y: 2, z: 3}, {x: 4, y: 5, z: 6}, ...]
    ```
    この場合、`x`の値だけを連続して処理したくても、メモリ上では`y`や`z`のデータによって分断されており、CPUのキャッシュ効率が悪化します。

-   **SoA (本プロジェクトの採用方式)**:
    ```
    // Positionコンポーネントのストレージ
    {
      x: [1, 4, ...], // xの値がメモリ上で連続
      y: [2, 5, ...], // yの値がメモリ上で連続
      z: [3, 6, ...]  // zの値がメモリ上で連続
    }
    ```
    物理演算システムがすべてのエンティティの`x`座標を更新するような場合、データがメモリ上で連続しているため、CPUはキャッシュを最大限に活用でき、処理が劇的に高速化されます。

このArchetypeとSoAの組み合わせにより、`World`は高いクエリ性能とデータ処理性能を両立しています。

## 2. World API

`World`からエンティティやコンポーネントを操作するためのAPIは、パフォーマンスを最優先するように設計されています。

### `querySoA`: 唯一のクエリAPI

`querySoA` は、エンティティとコンポーネントのデータを取得するための唯一の方法です。パフォーマンス上の理由から、オブジェクトを生成する旧 `query` APIは廃止されました。

-   **長所**:
    -   **オブジェクトを一切生成しません**。代わりに、内部ストレージのデータ配列への直接的な参照を返します。
    -   データがメモリ上で連続しているため、CPUキャッシュのヒット率が劇的に向上し、ループ処理が非常に高速になります。
    -   GC（ガベージコレクション）の負荷を最小限に抑え、フレームレートの安定に貢献します。
-   **規約**:
    -   プロジェクト内のすべてのシステムは、**必ず `querySoA` を使用しなければなりません。**

```typescript
// Position と Velocity を持つエンティティのSoAデータを取得
const { entities, positions, velocitys } = yield* _(
  world.querySoA({ all: [Position, Velocity] }),
);

for (let i = 0; i < entities.length; i++) {
  const entityId = entities[i];
  // positions.x[i], positions.y[i], positions.z[i] のように直接データにアクセス
  const posX = positions.x[i];
  const velY = velocitys.dy[i];
  // ...
}
```

### 発展的なクエリ

クエリオブジェクトを使用することで、より複雑な条件を指定できます。

-   `all`: 指定したすべてのコンポーネントを持つエンティティを検索します。
-   `not`: 指定したコンポーネントを**持たない**エンティティを検索します。

```typescript
// Playerコンポーネントを持つが、Frozenコンポーネントは持たないエンティティを取得
const queryResult = yield* world.querySoA({
  all: [Player, Position],
  not: [Frozen],
});
```

すべてのクエリは、保守性を高めるために `src/domain/queries.ts` で共通化することが推奨されます。

## 3. ライフサイクルと状態変更

エンティティとコンポーネントの生成、変更、削除はすべて`World`サービスを通じて行います。

-   `createEntity(...components)`: 新しいエンティティを生成します。
-   `removeEntity(id)`: エンティティとそれに関連するすべてのコンポーネントを削除します。
-   `updateComponentData(id, componentClass, data)`: 既存のコンポーネントの値を部分的に更新します。**パフォーマンス向上のため、このAPIの使用が強く推奨されます。**
-   `getComponent(id, componentClass)`: 単一のエンティティから特定のコンポーネントを取得します。
-   `getComponents(id)`: （デバッグ用）単一のエンティティが持つすべてのコンポーネントを取得します。

**非推奨のAPI:**
-   `updateComponent(id, component)`: このAPIは内部で新しいコンポーネントインスタンスを生成するため、パフォーマンスが重要なコードパスでの使用は非推奨です。代わりに `updateComponentData` を使用してください。

**未実装のAPI:**
-   `addComponent(id, component)`
-   `removeComponent(id, componentClass)`

これらの操作は、エンティティをArchetype間で移動させる非常に高コストな処理です。ゲームループ内で頻繁に呼び出すべきではないため、現在は意図的に実装されていません。エンティティの構造は、生成時に決定されるべきです。
