# ECS (Entity Component System) with Effect

本プロジェクトのアーキテクチャは、伝統的なEntity Component System (ECS) パターンと、関数型プログラミングライブラリである Effect を深く統合させた独自のモデルに基づいています。これにより、データ指向設計のパフォーマンス上の利点と、関数型プログラミングの持つ堅牢性・テスト容易性を両立させています。

## 1. 基本概念

### Entity (エンティティ)

-   **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
-   **実装**: `string` 型に `EntityId` というブランドを付けた `Branded<string, "EntityId">` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

```typescript
// src/domain/entity.ts
import { Brand } from 'effect'
import { v4 as uuidv4 } from 'uuid'

export type EntityId = string & Brand.Brand<'EntityId'>
export const make = () => Brand.nominal<EntityId>()(uuidv4())
```

### Component (コンポーネント)

-   **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。
-   **実装**: `@effect/schema` の `Schema.Class` を用いて定義されます。これにより、以下の利点が得られます。
    -   **型安全性**: コンポーネントの構造がコンパイル時に保証されます。
    -   **不変性 (Immutability)**: `Schema` から生成される型は `Readonly` であり、意図しない状態変更を防ぎます。
    -   **バリデーションとシリアライズ**: セーブデータからのデコードなど、外部のデータを安全にコンポーネントに変換できます。

```typescript
// src/domain/components.ts
import { Schema } from '@effect/schema'

export class Position extends Schema.Class<Position>('Position')({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}) {}

export class Velocity extends Schema.Class<Velocity>('Velocity')({
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number,
}) {}
```

### System (システム)

-   **定義**: ゲームのロジックを実装する部分です。特定のコンポーネントを持つエンティティの集合をクエリし、それらのコンポーネントを読み取って新しい状態を計算し、ワールドに反映させます。
-   **実装**: `Effect<void, E, R>` 型のプログラムとして実装されます。
    -   `R` (Context): システムが必要とする依存サービス（`World`, `Input` など）の型。
    -   `E` (Error): システムが失敗する可能性のあるエラーの型。
    -   `void`: システムは値を返さず、`World` サービスを通じて状態変更という副作用を実行します。

```typescript
// src/systems/physics.ts (概念コード)
import { Effect } from 'effect'
import { World } from '../runtime/world'
import { Position, Velocity } from '../domain/components'

export const physicsSystem = Effect.gen(function* () {
  const world = yield* World
  const entities = yield* world.query(Position, Velocity)

  yield* Effect.forEach(entities, ([id, pos, vel]) => {
    const newPos = new Position({
      x: pos.x + vel.dx,
      y: pos.y + vel.dy,
      z: pos.z + vel.dz,
    })
    return world.updateComponent(id, newPos)
  })
})
```

## 2. World: 唯一の状態管理ハブ

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。ECSの中核をなし、状態へのアクセスと変更を安全に行うためのAPIを提供します。

-   **状態の保持**: 内部的に `Map` や `HashMap` を使用して、`EntityId` とコンポーネントのリストを関連付けて保持します。
-   **アトミックな操作**: Effectの `Ref` や `STM` を利用することで、複数のシステムが同時に状態を変更しようとしても、データ競合を起こさず安全に更新できます。
-   **クエリ機能**: `world.query(ComponentA, ComponentB)` のようなAPIを提供し、特定のコンポーネントの組み合わせを持つエンティティを効率的に検索できます。

## 3. システムの合成と実行順序

各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります。例えば、プレイヤーの入力を処理する前に物理演算を行ってしまうと、入力が1フレーム遅れて反映されることになります。

この実行順序は `src/systems/index.ts` で定義されています。

```typescript
// src/systems/index.ts
export const mainSystem: Effect.Effect<
  void,
  never,
  // ... dependencies
> = Effect.sync(() => {}).pipe(
  Effect.tap(() => playerControlSystem),
  Effect.tap(() => interactionSystem),
  Effect.tap(() => chunkLoadingSystem),
  Effect.tap(() => physicsSystem),
  Effect.tap(() => collisionSystem),
  Effect.tap(() => uiSystem),
  Effect.tap(() => renderSystem),
);
```

`Effect.tap` を用いて各システムを順番に実行するパイプラインを構築しています。これにより、毎フレーム以下の順序で処理が実行されることが保証されます。

1.  **`playerControlSystem`**: プレイヤーの入力を処理し、意図をコンポーネントに反映。
2.  **`interactionSystem`**: ブロックの破壊・設置など。
3.  **`chunkLoadingSystem`**: プレイヤーの位置に基づき、チャンクをロード/アンロード。
4.  **`physicsSystem`**: 速度や重力を位置に反映。
5.  **`collisionSystem`**: 物理演算の結果を壁や床との衝突に基づき補正。
6.  **`uiSystem`**: ゲーム内UI（ホットバーなど）の状態を更新。
7.  **`renderSystem`**: 最終的なワールドの状態を画面に描画。

## 4. データフローとゲームループ

ゲームループは、以下のステップを繰り返す `Effect` プログラムとして `src/runtime/loop.ts` に定義されています。

1.  **入力の収集**: `Input` サービスから現在のフレームでのユーザー入力を取得します。
2.  **システムの実行**: `src/systems/index.ts` で合成された `mainSystem` を実行します。
    -   各システムは `World` から必要なデータを読み取ります。
    -   ロジックを実行し、新しいコンポーネントの状態を計算します。
    -   `World` サービスを通じて、コンポーネントの更新、エンティティの追加/削除を要求します。
3.  **レンダリング**: パイプラインの最後に実行される `renderSystem` が `World` の最新の状態を読み取り、`Renderer` サービスに描画コマンドを送信します。
4.  **繰り返し**: `Effect.repeat(Schedule.animationFrame)` を用いて、このループをブラウザの描画タイミングに合わせて効率的に繰り返します。

このアーキテクチャにより、ロジック（System）とデータ（Component）が明確に分離され、各コンポーネントが疎結合になるため、機能の追加や変更が容易になっています。