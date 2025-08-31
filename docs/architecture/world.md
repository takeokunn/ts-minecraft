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
    物理演算システムがすべてのエンティティの`x`座標を更新するような場合、データがメモリ上で連続しているため、CPUはキャッシュを最大限に活用でき、処理が劇的に高速化します。

このArchetypeとSoAの組み合わせにより、`World`は高いクエリ性能とデータ処理性能を両立しています。

## 2. クエリAPI

`World`からエンティティとコンポーネントを取得するためのAPIは、シンプルかつ表現力豊かになるように設計されています。

### 基本的なクエリ

1つ以上のコンポーネントクラスを引数として渡すことで、それらすべてのコンポーネントを持つエンティティを検索します。

```typescript
// Position と Velocity の両方を持つエンティティを取得
const queryResult = yield* world.query(Position, Velocity)

for (const [id, components] of queryResult.entries()) {
  const pos = components.Position
  const vel = components.Velocity
  // ...
}
```

### 発展的なクエリ

より複雑な条件を指定するために、クエリオブジェクトを渡すこともできます。

-   `all`: 指定したすべてのコンポーネントを持つエンティティを検索します。
-   `not`: 指定したコンポーネントを**持たない**エンティティを検索します。

```typescript
// Playerコンポーネントを持つが、Frozenコンポーネントは持たないエンティティを取得
const queryResult = yield* world.query({
  all: [Player, Position],
  not: [Frozen],
})
```

この柔軟なAPIにより、各システムは必要とするデータを効率的かつ正確に取得できます。

## 3. ライフサイクルと状態変更

エンティティとコンポーネントの生成、変更、削除はすべて`World`サービスを通じて行います。

-   `createEntity(...components)`: 新しいエンティティを生成します。
-   `removeEntity(id)`: エンティティとそれに関連するすべてのコンポーネントを削除します。
-   `updateComponent(id, component)`: 既存のコンポーネントの値を更新します。
-   `addComponent(id, component)`: エンティティに新しいコンポーネントを追加します。
-   `removeComponent(id, componentClass)`: エンティティからコンポーネントを削除します。

**注意:** 現在の実装では、SoAアーキテクチャの複雑さから、`addComponent`と`removeComponent`はパフォーマンス上の警告を伴うプレースホルダーとなっています。これらの操作はエンティティをArchetype間で移動させる高コストな処理であり、多用は避けるべきです。ゲームロジックは、コンポーネントの値を`updateComponent`で更新することを主軸に設計することが推奨されます。
