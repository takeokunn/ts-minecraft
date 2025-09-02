# 機能仕様: World サービス

このドキュメントは、ECS（Entity Component System）アーキテクチャの中核をなす `World` サービスについて詳述します。`World` サービスは、ゲーム内に存在するすべてのエンティティとコンポーネントの状態を一元管理する、唯一の信頼できる情報源（Source of Truth）です。

> `World`の内部的な設計思想（Archetype, SoA）やパフォーマンスに関する詳細については、[\*\*Worldアーキテクチャ (architecture/world.md)](./../architecture/world.md) を参照してください。

## 1. 設計思想: Archetypeベースのデータ指向設計

`World` の実装は、UnityのDOTSやBevyエンジンに代表されるような、モダンでハイパフォーマンスな**Archetype（アーキタイプ）ベース**のアーキテクチャを採用しています。

- **Archetypeとは**: 「`Position`, `Velocity`, `Renderable` を持つエンティティの集まり」といった、**コンポーネントの型の組み合わせ**そのものを指します。
- **データ指向**: エンティティは、自身が持つコンポーネントの組み合わせによって、対応するArchetypeに分類されます。クエリの際は、エンティティ全体を走査するのではなく、目的のコンポーネントを持つArchetypeに属するエンティティ群に直接アクセスするため、極めて高速です。
- **キャッシュ効率**: 同じArchetypeに属するエンティティのコンポーネントデータは、メモリ上で連続して配置される傾向があり、CPUのキャッシュヒット率を向上させ、パフォーマンスに貢献します。

## 2. 責務と実装

- **責務**:
  - すべてのエンティティとコンポーネントの状態を、コンポーネントの種類とArchetypeに基づいて効率的に保持する。
  - 状態の読み取り（クエリ）と変更（作成、更新、削除）のための、安全で型安全なAPIを提供する。
- **実装**:
  - `World` サービスの実体は、Effectの `Ref<WorldState>` です。`Ref` はアトミックな更新が可能な可変参照であり、複数のシステムから同時にアクセスされても状態の整合性を保ちます。
  - `WorldState` は主に以下の3つのデータ構造を持ちます。
    1.  **ComponentStorage**: `Map<ComponentTag, Map<EntityId, Component>>`
        - コンポーネントの種類ごとに、エンティティIDとコンポーネント実体のマップを保持します。
    2.  **ArchetypeMap**: `Map<ArchetypeId, Archetype>`
        - Archetypeの定義（含まれるコンポーネントタグのセットと、所属するエンティティIDのセット）を保持します。
    3.  **EntityArchetypeMap**: `Map<EntityId, ArchetypeId>`
        - 各エンティティがどのArchetypeに属しているかをマッピングします。

## 3. 主要API

`World` サービスと対話するための操作は、`src/runtime/world.ts` 内でEffectとして定義されています。

### `createEntity(...components)`

- **目的**: 新しいエンティティをワールドに追加します。
- **処理**:
  1.  一意な `EntityId` を生成します。
  2.  渡されたコンポーネントを`ComponentStorage`に追加します。
  3.  コンポーネントの組み合わせからArchetypeを決定し、新しいエンティティをそのArchetypeに登録します。

### `removeEntity(id)`

- **目的**: 指定されたエンティティをワールドから完全に削除します。
- **処理**:
  1.  エンティティが属するArchetypeからエンティティIDを削除します。
  2.  すべての`ComponentStorage`から、そのエンティティIDに関連するコンポーネントを削除します。
  3.  `EntityArchetypeMap`からエンティティIDを削除します。

### `addComponent(id, component)` / `removeComponent(id, componentClass)`

- **目的**: エンティティのコンポーネント構成を変更します。
- **処理**:
  1.  コンポーネントを`ComponentStorage`に追加または削除します。
  2.  エンティティのコンポーネント構成が変化したため、所属するArchetypeを更新します。エンティティは古いArchetypeから削除され、新しいコンポーネント構成に対応する新しいArchetypeに移動します。

### `query(...componentClasses)`

- **目的**: 指定されたすべてのコンポーネントを持つエンティティを**効率的に**検索します。
- **処理**:
  1.  ワールド内のすべてのArchetypeを走査します。
  2.  指定されたコンポーネントのセットをすべて含むArchetypeを見つけます。
  3.  そのArchetypeに属するすべてのエンティティIDを取得します。
  4.  取得したエンティティIDを使って、`ComponentStorage`から必要なコンポーネントを組み立てて返します。
- **パフォーマンス**: このアプローチにより、クエリはエンティティの総数に依存せず、Archetypeの数にのみ依存するため、非常に高速です。

### `querySingle(...componentClasses)`

- **目的**: `query`と同様ですが、最初に見つかった単一のエンティティのみを`Option`として返します。プレイヤーのようなシングルトンエンティティの取得に便利です。
