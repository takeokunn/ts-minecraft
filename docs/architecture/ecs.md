# ECS (Entity Component System) with Effect

本プロジェクトのアーキテクチャは、伝統的なEntity Component System (ECS) パターンと、関数型プログラミングライブラリである **Effect** を深く統合させた独自のモデルに基づいています。これにより、データ指向設計のパフォーマンス上の利点と、関数型プログラミングの持つ堅牢性・テスト容易性を両立させています。

このアーキテクチャは、主に3つの要素で構成されます。

-   **[Entity (エンティティ)](#entity-エンティティ)**: ゲーム内に存在する「モノ」を識別するID。
-   **[Component (コンポーネント)](#component-コンポーネント)**: エンティティの特性を表す純粋なデータ。
-   **[System (システム)](#system-システム)**: エンティティとコンポーネントを操作するゲームロジック。

これらの要素は、**[World](#world-ワールド)** と呼ばれる中央ハブによって一元管理され、**[システムスケジューラ](./system-scheduler.md)** によって効率的かつ安全に実行されます。

---

## Entity (エンティティ)

-   **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
-   **実装**: `src/domain/entity.ts` で定義されており、`string` 型に `EntityId` というブランドを付けた `Branded<string, "EntityId">` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

```typescript
// src/domain/entity.ts
import { Brand } from 'effect'
import { v4 as uuidv4 } from 'uuid'

export type EntityId = string & Brand.Brand<'EntityId'>
export const make = () => Brand.nominal<EntityId>()(uuidv4())
```

---

## Component (コンポーネント)

-   **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。コンポーネントはロジック（メソッド）を持ちません。
-   **実装**: `src/domain/components.ts` に集約されています。コンポーネントは `@effect/schema` の `Schema.Class` を用いて定義されます。
    -   **型安全性と不変性**: `Schema.Class` により、コンポーネントのプロパティは静的に型チェックされ、デフォルトで `readonly` となるため、意図しない変更が防止されます。
    -   **ランタイムスキーマ**: 各コンポーネントは自身のスキーマ情報を保持しており、`World` はこれを利用してストレージを動的に管理したり、セーブ/ロード機能で安全なシリアライズを実現します。

```typescript
// src/domain/components.ts
import * as Schema from '@effect/schema/Schema'

export class Position extends Schema.Class<Position>('Position')({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}) {}
```

---

## System (システム)

-   **定義**: ゲームのロジックを実装する部分です。特定のコンポーネントを持つエンティティの集合をクエリし、それらのコンポーネントを読み取って新しい状態を計算し、ワールドに反映させます。
-   **実装**: `Effect<void, never, World | ...Services>` 型の `Effect` プログラムとして実装されます。
    -   **依存性の注入**: `World` サービスやその他のサービス（`InputService`, `RenderService`など）は、`Effect` のコンテキスト (`R` 型パラメータ) を介してシステムに提供されます。これにより、システムは純粋なビジネスロジックに集中でき、テストが容易になります。
    -   **宣言的なロジック**: `Effect.gen` (do記法) を用いることで、非同期処理やエラー処理を含む複雑なロジックを、同期的で直線的なコードのように記述できます。
    -   **パフォーマンス**: パフォーマンスが重要なシステムでは、`world.querySoA` API を使用して、メモリアロケーションを避け、CPUキャッシュを最大限に活用します。

```typescript
// src/systems/physics.ts (リファクタリング後の実装例)
import { Effect } from "effect";
import { Gravity, Velocity } from "../domain/components";
import { World } from "../runtime/world";

export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);

  // 1. querySoAでコンポーネントのSoAデータを直接取得
  const { entities, velocitys, gravitys } = yield* _(
    world.querySoA(Velocity, Gravity),
  );

  const updateEffects = [];
  // 2. 高速なforループでデータを処理
  for (let i = 0; i < entities.length; i++) {
    const id = entities[i];
    const dy = velocitys.dy[i] as number;
    const gravityValue = gravitys.value[i] as number;

    // 3. 新しい値を計算
    const newDy = Math.max(-2, dy - gravityValue);

    // 4. コンポーネントを更新 (この部分でのオブジェクト生成は許容)
    const newVel = new Velocity({
      dx: velocitys.dx[i] as number,
      dy: newDy,
      dz: velocitys.dz[i] as number,
    });
    updateEffects.push(world.updateComponent(id, newVel));
  }

  // 5. 更新処理を並行実行
  if (updateEffects.length > 0) {
    yield* _(Effect.all(updateEffects, { discard: true }));
  }
}).pipe(Effect.withSpan("physicsSystem"));
```

---

## World (ワールド)

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。本プロジェクトの `World` は、パフォーマンスを最大化するために **Archetype** と **Structure of Arrays (SoA)** アーキテクチャを組み合わせて採用しています。

-   **Archetype**: 同じコンポーネントの組み合わせを持つエンティティは、同じ「アーキタイプ」に属します。例えば、`Position` と `Velocity` を持つすべてのエンティティは、1つのアーキタイプにまとめられます。
-   **Structure of Arrays (SoA)**: 各アーキタイプ内部では、コンポーネントのデータは種類ごとに連続した配列として格納されます。例えば、`Position` コンポーネントの `x`, `y`, `z` は、それぞれ別の配列 (`x: [1, 2, ...], y: [3, 4, ...], z: [5, 6, ...]`) として保持されます。
-   **利点**:
    -   **キャッシュ効率**: システムが特定のコンポーネント（例: `Position`）のみを処理する場合、CPUは必要なデータがまとめられたメモリ領域に効率的にアクセスできます（データ局所性）。これにより、キャッシュミスが減少し、クエリやイテレーションが大幅に高速化されます。
    -   **効率的なクエリ**: 特定のコンポーネントの組み合わせを持つエンティティを見つけるのが非常に高速です。

詳細は **[Worldアーキテクチャ](./world.md)** のドキュメントを参照してください。

---

## システムスケジューラ

各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります。本プロジェクトでは、システム間の依存関係を解決し、実行順序を自動的に決定するスケジューラを導入しています。

詳細は **[システムスケジューラ](./system-scheduler.md)** のドキュメントを参照してください。