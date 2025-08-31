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

`World`からエンティティとコンポーネントを取得するためのAPIは、柔軟性とパフォーマンスのバランスを考慮して設計されています。

### `query`: 柔軟なオブジェクトベースのクエリ

`query` APIは、結果を `Map<EntityId, Components>` 形式で返します。各エンティティIDに対して、要求されたコンポーネントのインスタンスがマッピングされます。

-   **長所**:
    -   返されたコンポーネントはクラスインスタンスであるため、メソッド（もしあれば）を呼び出すことができます。
    -   特定のエンティティの複数コンポーネントをまとめて扱うのが直感的で容易です。
-   **短所**:
    -   クエリを実行するたびに、条件に一致したすべてのエンティティとコンポーネントに対して**新しいオブジェクトが生成されます**。
    -   これにより、特にエンティティ数が多い場合、ガベージコレクション（GC）の負荷が増大し、パフォーマンスの低下を引き起こす可能性があります。

```typescript
// Position と Velocity の両方を持つエンティティを取得
const queryResult = yield* world.query(Position, Velocity);

for (const [id, components] of queryResult.entries()) {
  // components.Position と components.Velocity は新しいインスタンス
  const pos = components.Position;
  const vel = components.Velocity;
  // ...
}
```

### `querySoA`: パフォーマンス最優先のSoAクエリ

`querySoA` APIは、パフォーマンスを最大化するために設計されており、SoAアーキテクチャの利点を直接システムに提供します。

-   **長所**:
    -   **オブジェクトを一切生成しません**。代わりに、内部ストレージのデータ配列（またはそのビュー）を直接返します。
    -   データがメモリ上で連続しているため、CPUキャッシュのヒット率が劇的に向上し、ループ処理が非常に高速になります。
    -   GCの負荷を最小限に抑え、フレームレートの安定に貢献します。
-   **短所**:
    -   データがプロパティごとの配列になっているため、扱うのが `query` よりも少し複雑になる場合があります。

```typescript
// Position と Velocity を持つエンティティのSoAデータを取得
const { entities, positions, velocitys } = yield* _(
  world.querySoA(Position, Velocity),
);

for (let i = 0; i < entities.length; i++) {
  const entityId = entities[i];
  // positions.x[i], positions.y[i], positions.z[i] のように直接データにアクセス
  const posX = positions.x[i];
  const velY = velocitys.dy[i];
  // ...
}
```

### APIの使い分け

プロジェクトの規約として、以下のようにAPIを使い分けます。

-   **`querySoA`**: `physics`, `collision`, `scene` など、毎フレーム多数のエンティティを処理する**パフォーマンスが重要なシステム**で**必ず使用します**。
-   **`query`**: デバッグや、エディタ機能、UIの更新など、エンティティ数が少なく、パフォーマンス要件が厳しくない特定のケースでのみ使用が許可されます。

### 発展的なクエリ

どちらのAPIも、より複雑な条件を指定するためにクエリオブジェクトを渡すことができます。

-   `all`: 指定したすべてのコンポーネントを持つエンティティを検索します。
-   `not`: 指定したコンポーネントを**持たない**エンティティを検索します。

```typescript
// Playerコンポーネントを持つが、Frozenコンポーネントは持たないエンティティを取得
const queryResult = yield* world.querySoA({
  all: [Player, Position],
  not: [Frozen],
});
```

## 3. ライフサイクルと状態変更

エンティティとコンポーネントの生成、変更、削除はすべて`World`サービスを通じて行います。

-   `createEntity(...components)`: 新しいエンティティを生成します。
-   `removeEntity(id)`: エンティティとそれに関連するすべてのコンポーネントを削除します。
-   `updateComponent(id, component)`: 既存のコンポーネントの値を更新します。
-   `addComponent(id, component)`: エンティティに新しいコンポーネントを追加します。
-   `removeComponent(id, componentClass)`: エンティティからコンポーネントを削除します。

**注意:** 現在の実装では、SoAアーキテクチャの複雑さから、`addComponent`と`removeComponent`はパフォーマンス上の警告を伴うプレースホルダーとなっています。これらの操作はエンティティをArchetype間で移動させる高コストな処理であり、多用は避けるべきです。ゲームロジックは、コンポーネントの値を`updateComponent`で更新することを主軸に設計することが推奨されます。
