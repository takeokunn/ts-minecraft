# ECS (Entity Component System) with Effect

本プロジェクトのアーキテクチャは、伝統的なEntity Component System (ECS) パターンと、関数型プログラミングライブラリである **Effect** を深く統合させた独自のモデルに基づいています。これにより、データ指向設計のパフォーマンス上の利点と、関数型プログラミングの持つ堅牢性・テスト容易性を両立させています。

このアーキテクチャは、主に3つの要素で構成されます。

- **[Entity (エンティティ)](#entity-エンティティ)**: ゲーム内に存在する「モノ」を識別するID。
- **[Component (コンポーネント)](#component-コンポーネント)**: エンティティの特性を表す純粋なデータ。
- **[System (システム)](#system-システム)**: エンティティとコンポーネントを操作するゲームロジック。

これらの要素は、**[World](#world-ワールド)** と呼ばれる中央ハブによって一元管理され、**[システムスケジューラ](./system-scheduler.md)** によって効率的かつ安全に実行されます。

---

## Entity (エンティティ)

- **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
- **実装**: `src/domain/types.ts` で定義されており、`string` 型に `EntityId` というブランドを付けた `Brand.Brand<"EntityId">` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

```typescript
// src/domain/types.ts
import { Brand } from 'effect'

export type EntityId = Brand.Brand<'EntityId'>
// (生成は `world.createEntity` 内で uuid を使って行われる)
```

---

## Component (コンポーネント)

- **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。コンポーネントはロジック（メソッド）を持ちません。
- **実装**: `src/domain/components.ts` に集約されています。コンポーネントは `@effect/schema` の `Schema.Class` を用いて定義されます。
  - **型安全性と不変性**: `Schema.Class` により、コンポーネントのプロパティは静的に型チェックされ、デフォルトで `readonly` となるため、意図しない変更が防止されます。
  - **ランタイムスキーマ**: 各コンポーネントは自身のスキーマ情報を保持しており、`World` はこれを利用してストレージを動的に管理したり、セーブ/ロード機能で安全なシリアライズを実現します。

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

- **定義**: ゲームのロジックを実装する部分です。特定のコンポーネントを持つエンティティの集合をクエリし、それらのコンポーネントを読み取って新しい状態を計算し、ワールドに反映させます。
- **実装**: `Effect<void, never, World | ...Services>` 型の `Effect` プログラムとして実装されます。
  - **依存性の注入**: `World` サービスやその他のサービス（`InputService`, `RenderService`など）は、`Effect` のコンテキスト (`R` 型パラメータ) を介してシステムに提供されます。これにより、システムは純粋なビジネスロジックに集中でき、テストが容易になります。
  - **宣言的なロジック**: `Effect.gen` (do記法) を用いることで、非同期処理やエラー処理を含む複雑なロジックを、同期的で直線的なコードのように記述できます。
  - **パフォーマンス**: パフォーマンスが重要なシステムでは、`world.querySoA` API を使用して、メモリアロケーションを避け、CPUキャッシュを最大限に活用します。

```typescript
// src/systems/physics.ts (主要部分の抜粋)
import { Effect } from 'effect'
import { physicsQuery } from '../domain/queries'
import { World } from '../runtime/world'

// システムは Effect プログラムとして定義される
export const physicsSystem = Effect.gen(function* (_) {
  // 1. DI: `World` サービスをコンテキストから安全に取得
  const world = yield* _(World)

  // 2. クエリ: SoA(Structure of Arrays) データを直接取得
  const { entities, positions, velocities, gravities } = yield* _(world.querySoA(physicsQuery))

  // 3. ロジック: 高速なforループでデータを直接操作
  for (let i = 0; i < entities.length; i++) {
    // 重力を速度に適用
    const newDy = Math.max(-2, velocities.dy[i] - gravities.value[i])
    velocities.dy[i] = newDy

    // 速度を位置に適用
    positions.x[i] += velocities.dx[i]
    positions.y[i] += newDy
    positions.z[i] += velocities.dz[i]
  }
}).pipe(Effect.withSpan('physicsSystem'))
```

---

## World (ワールド)

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。本プロジェクトの `World` は、パフォーマンスを最大化するために **Archetype** と **Structure of Arrays (SoA)** アーキテクチャを組み合わせて採用しています。

- **Archetype**: 同じコンポーネントの組み合わせを持つエンティティは、同じ「アーキタイプ」に属します。これにより、特定のコンポーネントを持つエンティティの検索が極めて高速になります。

- **Structure of Arrays (SoA)**: 各アーキタイプ内部では、コンポーネントのデータは種類ごとに連続した配列として格納されます。これは、一般的なオブジェクトの配列 (AoS: Array of Structures) と対照的です。
  - **AoS (非効率な例)**: `[{x:1,y:2}, {x:3,y:4}, ...]`
    - メモリ上で `x` と `y` が交互に並び、データが分断されます。`x` だけを処理したい場合でも、不要な `y` のデータがCPUキャッシュにロードされてしまい、効率が悪化します。

  - **SoA (本プロジェクトの方式)**: `{ x: [1,3,...], y: [2,4,...] }`
    - `x` の値がメモリ上で連続し、`y` の値も同様に連続します。`x` だけを処理する場合、CPUは必要なデータだけをキャッシュに効率的にロードでき（**データ局所性**）、キャッシュミスが劇的に減少します。これにより、クエリやイテレーションが大幅に高速化されます。

- **`querySoA` API**: このSoAアーキテクチャの性能を最大限に引き出すためのAPIが `world.querySoA()` です。このAPIは、内部ストレージの配列への直接の参照を返すため、システムはGC負荷の原因となる中間オブジェクトを一切生成することなく、データを直接読み書きできます。

詳細は **[Worldアーキテクチャ](./world.md)** のドキュメントを参照してください。

---

## システムスケジューラ

各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります。本プロジェクトでは、システム間の依存関係を解決し、実行順序を自動的に決定するスケジューラを導入しています。

詳細は **[システムスケジューラ](./system-scheduler.md)** のドキュメントを参照してください。
