> **Summary**
> このドキュメントは、本プロジェクトのコアアーキテクチャであるEntity Component System (ECS)とEffect-TSの統合モデルについて解説します。Entity, Component, Archetype, Query, System, Worldの各要素がどのように連携し、データ指向設計と関数型プログラミングを両立させているかを説明します。

# ECS (Entity Component System) with Effect

本プロジェクトのアーキテクチャは、伝統的なEntity Component System (ECS) パターンと、関数型プログラミングライブラリである **[Effect](https://effect.website/)** を深く統合させた独自のモデルに基づいています。これにより、データ指向設計のパフォーマンス上の利点と、関数型プログラミングの持つ堅牢性・テスト容易性を両立させています。

このアーキテクチャは、主に6つの要素で構成されます。

- **[Entity (エンティティ)](#entity-エンティティ)**: ゲーム内に存在する「モノ」を識別するID。
- **[Component (コンポーネント)](#component-コンポーネント)**: エンティティの特性を表す純粋なデータ。
- **[Archetype (アーキタイプ)](#archetype-アーキタイプ)**: エンティティを生成するためのテンプレート。
- **[Query (クエリ)](#query-クエリ)**: 特定の条件に合うエンティティ群を効率的に検索するための定義。
- **[System (システム)](#system-システム)**: エンティティとコンポーネントを操作するゲームロジック。
- **[World (ワールド)](#world-ワールド)**: 上記のすべてを管理する中央サービス。

---

## Entity (エンティティ)

- **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
- **実装**: `src/domain/entity.ts` で定義されており、`string` 型に `EntityId` というブランドを付けた `Brand.Brand<'EntityId'>` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

---

## Component (コンポーネント)

- **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。コンポーネントはロジック（メソッド）を持ちません。
- **実装**: `src/domain/components.ts` に集約されています。コンポーネントは `@effect/schema` の `S.Struct` を用いて定義されます。
  - **型安全性と不変性**: `Schema` から生成される型はデフォルトでプロパティが `readonly` となるため、意図しない変更が防止されます。
  - **ランタイムスキーマ**: 各コンポーネントは自身のスキーマ情報を保持しており、セーブ/ロード機能で安全なシリアライズを実現します。

```typescript
// src/domain/components.ts
import * as S from 'effect/Schema'
import { Float } from './common'

export const Position = S.Struct({
  x: Float,
  y: Float,
  z: Float,
})
export type Position = S.Schema.Type<typeof Position>
```

---

## Archetype (アーキタイプ)

- **定義**: 特定のコンポーネントの組み合わせを持つエンティティを生成するためのテンプレート（雛形）です。
- **実装**: `src/domain/archetypes.ts` で定義されています。`createPlayer`, `createBlock` のようなファクトリ関数を通じて利用されます。これにより、エンティティの構成がカプセル化され、一貫性が保たれます。

```typescript
// src/domain/archetypes.ts
export const createArchetype = (builder: ArchetypeBuilder): Effect.Effect<Archetype> => {
  // ...
}
```

---

## Query (クエリ)

- **定義**: 「`Position` と `Velocity` を持ち、かつ `Frozen` を持たないエンティティ」のように、特定の条件に合致するエンティティの集合を効率的に検索するための定義です。
- **実装**: `src/domain/queries.ts` で一元管理されています。システムはこれらのクエリを `World` サービスに渡すことで、目的のエンティティ群を高速に取得します。

```typescript
// src/domain/queries.ts
export const playerMovementQuery: Query = createQuery({
  all: [Player, InputState, Velocity, CameraState],
})
```

---

## System (システム)

- **定義**: ゲームのロジックを実装する部分です。クエリを使ってエンティティの集合を取得し、それらのコンポーネントを読み書きしてゲームの状態を更新します。
- **実装**: 各システムは `Effect.Effect<void, E, R>` 型の `Effect` プログラムとして実装されます。
  - **`void`**: システムは通常、値を返さず、`World` の状態変更という副作用を引き起こすことが目的のため、成功時の型は `void` です。
  - **`E` (Error)**: システムが失敗する可能性のあるエラーの型。
  - **`R` (Context/Requirements)**: `World` サービスや `InputManager` など、システムが実行に必要とする依存関係（サービス）の型。これにより、依存関係が型レベルで明確になります。
  - **宣言的なロジック**: `Effect.gen` (do記法) を用いることで、非同期処理やエラー処理を含む複雑なロジックを、同期的で直線的なコードのように記述できます。

```typescript
// src/systems/player-movement.ts (概念コード)
import { Effect } from 'effect'
import { playerMovementQuery } from '@/domain/queries'
import { World } from '@/domain/world'
import { InputManager } from '@/infrastructure/input-browser'
import { PLAYER_SPEED } from '@/domain/world-constants'

export const playerMovementSystem = Effect.gen(function* (_) {
  // 1. DI: 必要なサービスをコンテキスト(`R`)から安全に取得
  const world = yield* _(World)
  const input = yield* _(InputManager)

  // 2. クエリ: 対象エンティティのコンポーネントをSoA形式で取得
  const { entities, components } = yield* _(world.querySoA(playerMovementQuery))

  // 3. ロジック: 状態を読み取り、新しい状態を書き込む
  for (let i = 0; i < entities.length; i++) {
    if (components.inputState.forward[i]) {
      components.velocity.dz[i] = -PLAYER_SPEED
    }
  }
})
```

---

## World (ワールド)

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。本プロジェクトの `World` は、パフォーマンスを最大化するために **Archetype** と **Structure of Arrays (SoA)** アーキテクチャを組み合わせて採用しています。

この設計により、CPUキャッシュのヒット率が劇的に向上し（**データ局所性**）、クエリやイテレーションが大幅に高速化されます。また、`world.querySoA()` APIを通じて内部ストレージへの直接参照を取得することで、GC負荷の原因となる中間オブジェクトを一切生成することなく、データを効率的に読み書きできます。

詳細は **[World内部設計 (World Architecture)](./world-performance.md)** のドキュメントを参照してください。

---

## システムの実行順序

各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります（例: `入力受付` → `物理演算` → `レンダリング`）。

本プロジェクトでは、`src/main.ts` 内でシステムの実行順序を静的な配列として定義しています。

```typescript
// src/main.ts
const systems = [
  inputPollingSystem,
  playerMovementSystem,
  physicsSystem,
  collisionSystem,
  // ... other systems
]

yield* _(gameLoop(systems))
```

これにより、フレームごとにどのシステムがどの順番で実行されるかが明確に制御されます。詳細は **[システムスケジューラ](./system-scheduler.md)** のドキュメントを参照してください。
