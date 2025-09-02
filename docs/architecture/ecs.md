# ECS (Entity Component System) with Effect

本プロジェクトのアーキテクチャは、伝統的なEntity Component System (ECS) パターンと、関数型プログラミングライブラリである **[Effect](https://effect.website/)** を深く統合させた独自のモデルに基づいています。これにより、データ指向設計のパフォーマンス上の利点と、関数型プログラミングの持つ堅牢性・テスト容易性を両立させています。

このアーキテクチャは、主に5つの要素で構成されます。

- **[Entity (エンティティ)](#entity-エンティティ)**: ゲーム内に存在する「モノ」を識別するID。
- **[Component (コンポーネント)](#component-コンポーネント)**: エンティティの特性を表す純粋なデータ。
- **[Archetype (アーキタイプ)](#archetype-アーキタイプ)**: エンティティを生成するためのテンプレート。
- **[Query (クエリ)](#query-クエリ)**: 特定の条件に合うエンティティ群を効率的に検索するための定義。
- **[System (システム)](#system-システム)**: エンティティとコンポーネントを操作するゲームロジック。

これらの要素は、**[World](#world-ワールド)** と呼ばれる中央サービスによって一元管理されます。

---

## Entity (エンティティ)

- **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
- **実装**: `src/domain/entity.ts` で定義されており、`string` 型に `EntityId` というブランドを付けた `Brand.Brand<'EntityId'>` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

---

## Component (コンポーネント)

- **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。コンポーネントはロジック（メソッド）を持ちません。
- **実装**: `src/domain/components.ts` に集約されています。コンポーネントは `@effect/schema` の `Schema.Class` を用いて定義されます。
  - **型安全性と不変性**: `Schema.Class` により、コンポーネントのプロパティは静的に型チェックされ、デフォルトで `readonly` となるため、意図しない変更が防止されます。
  - **ランタイムスキーマ**: 各コンポーネントは自身のスキーマ情報を保持しており、セーブ/ロード機能で安全なシリアライズを実現します。

```typescript
// src/domain/components.ts
import { Schema as S } from 'effect'

export class Position extends S.Class<Position>('Position')({
  x: S.Float,
  y: S.Float,
  z: S.Float,
}) {}
```

---

## Archetype (アーキタイプ)

- **定義**: 特定のコンポーネントの組み合わせを持つエンティティを生成するためのテンプレート（雛形）です。
- **実装**: `src/domain/archetypes.ts` で定義されています。`createPlayer`, `createBlock` のようなファクトリ関数を通じて利用されます。これにより、エンティティの構成がカプセル化され、一貫性が保たれます。

```typescript
// src/domain/archetypes.ts
export const createArchetype = (builder: ArchetypeBuilder): Archetype => {
  return (
    match(builder)
      .with({ type: 'player' }, ({ pos }) => playerArchetype(pos))
      // ...
      .exhaustive()
  )
}
```

---

## Query (クエリ)

- **定義**: 「`Position` と `Velocity` を持ち、かつ `Frozen` を持たないエンティティ」のように、特定の条件に合致するエンティティの集合を効率的に検索するための定義です。
- **実装**: `src/domain/queries.ts` で一元管理されています。システムはこれらのクエリを `World` サービスに渡すことで、目的のエンティティ群を高速に取得します。

```typescript
// src/domain/queries.ts
export const playerMovementQuery: Query = createQuery('playerMovementQuery', ['player', 'inputState', 'velocity', 'cameraState'])
```

---

## System (システム)

- **定義**: ゲームのロジックを実装する部分です。クエリを使ってエンティティの集合を取得し、それらのコンポーネントを読み書きしてゲームの状態を更新します。
- **実装**: `Effect<R, E, void>` 型の `Effect` プログラムとして実装されます。
  - **依存性の注入**: `World` サービスや `InputManager` などの依存関係は、`Effect` のコンテキスト (`R` 型パラメータ) を介してシステムに提供されます。これにより、システムは純粋なビジネスロジックに集中でき、テストが容易になります。
  - **宣言的なロジック**: `Effect.gen` (do記法) を用いることで、非同期処理やエラー処理を含む複雑なロジックを、同期的で直線的なコードのように記述できます。

```typescript
// src/systems/player-movement.ts (概念コード)
import { Effect } from 'effect'
import { playerMovementQuery } from '@/domain/queries'
import { World } from '@/runtime/world'
import { InputManager } from '@/infrastructure/input-browser'

export const playerMovementSystem = Effect.gen(function* (_) {
  // 1. DI: 必要なサービスをコンテキストから安全に取得
  const world = yield* _(World)
  const input = yield* _(InputManager)

  // 2. クエリ: 対象エンティティのコンポーネントを取得
  const { velocities, inputStates } = yield* _(world.querySoA(playerMovementQuery))

  // 3. ロジック: 状態を読み取り、新しい状態を書き込む
  for (let i = 0; i < velocities.length; i++) {
    if (inputStates.forward[i]) {
      velocities.dz[i] = -PLAYER_SPEED
    }
  }
})
```

---

## World (ワールド)

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。本プロジェクトの `World` は、パフォーマンスを最大化するために **Archetype** と **Structure of Arrays (SoA)** アーキテクチャを組み合わせて採用しています。

- **Archetype**: 同じコンポーネントの組み合わせを持つエンティティは、同じ「アーキタイプ」に属します。これにより、特定のコンポーネントを持つエンティティの検索が極めて高速になります。

- **Structure of Arrays (SoA)**: 各アーキタイプ内部では、コンポーネントのデータは種類ごとに連続した配列として格納されます。これは、一般的なオブジェクトの配列 (AoS: Array of Structures) と対照的です。
  - **AoS (非効率な例)**: `[{pos, vel}, {pos, vel}, ...]`
  - **SoA (本プロジェクトの方式)**: `{ positions: [...], velocities: [...] }`
  - SoAはCPUキャッシュのヒット率を劇的に向上させ（**データ局所性**）、クエリやイテレーションを大幅に高速化します。

- **`querySoA` API**: このSoAアーキテクチャの性能を最大限に引き出すためのAPIが `world.querySoA()` です。このAPIは、内部ストレージの配列への直接の参照を返すため、システムはGC負荷の原因となる中間オブジェクトを一切生成することなく、データを直接読み書きできます。

詳細は **[Worldアーキテクチャ](./world.md)** のドキュメントを参照してください。

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

yield * _(gameLoop(systems))
```

これにより、フレームごとにどのシステムがどの順番で実行されるかが明確に制御されます。詳細は **[システムスケジューラ](./system-scheduler.md)** のドキュメントを参照してください。
