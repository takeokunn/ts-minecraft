# ts-minecraft 設計書 (v2)

## 1. 概要

本プロジェクトは、TypeScriptを使用してMinecraftライクな3Dサンドボックスゲームを開発するものである。
この設計書では、**Entity Component System (ECS)** アーキテクチャをベースとし、**関数型プログラミング (Effect-TS)** の原則を全面的に採用することで、極めて堅牢で、テスト容易性が高く、ハイパフォーマンスなゲームの構造を定義する。

## 2. コアコンセプト

- **データ指向設計 (ECS):** ゲームのすべての状態をプレーンなデータ（コンポーネント）として管理する。これにより、キャッシュ効率が向上し、パフォーマンスのボトルネックを特定しやすくなる。
- **純粋関数型プログラミング:** ゲームのロジック（システム）はすべて副作用のない純粋な関数として記述する。副作用（描画、ファイルI/O、ネットワーク通信など）は `Effect` データ型を用いて厳密に分離・管理する。
- **型安全性と不変性:** TypeScriptの強力な型システムとEffect-TSの機能（`Schema`, `immutable` collections）を最大限に活用し、実行時エラーを撲滅する。すべてのデータ構造は原則として不変（immutable）とし、状態変更を安全かつ予測可能にする。
- **テスト駆動開発 (TDD) & プロパティベーステスト (PBT):** すべてのロジックはテストによってその正しさが保証される。ユニットテストに加え、`fast-check` を用いたPBTを導入し、膨大な数のシナリオを自動的にテストすることで、システムの堅牢性を極限まで高める。

## 3. 使用する主要ライブラリ

- **関数型プログラミング:** [Effect-TS](https://effect.website/) - アプリケーション全体の制御フロー、副作用管理、依存性注入、並行処理、スキーマ定義など、あらゆる側面で利用する。
- **レンダリング:** [Three.js](https://threejs.org/) - 3Dグラフィックスの描画。`Effect` を介してラップし、純粋なインターフェースを提供する。
- **テスト:**
    - [Vitest](https://vitest.dev/) - テストランナー。
    - [fast-check](https://fast-check.dev/) - プロパティベーステスト。
- **ユーティリティ:**
    - [simplex-noise](https://github.com/jwagner/simplex-noise.js) - 地形生成のためのノイズ関数。
    - [uuid](https://github.com/uuidjs/uuid) - エンティティIDの生成。

## 4. アーキテクチャ: Effect-TSネイティブなECS

ECSの各要素をEffect-TSの思想に基づいて再定義する。

- **Entity (エンティティ):** `Branded<string, "EntityId">` のようなブランド型で表現される、一意なID。
- **Component (コンポーネント):** `Schema.Struct` を用いて定義される、不変なデータレコード。これにより、型安全性とデータのバリデーションが保証される。
- **System (システム):** `Effect<R, E, void>` として表現される、純粋なプログラム。
    - `R` (Context): システムが必要とする依存関係（例: `World`, `Renderer`, `Input`）。
    - `E` (Error): システムが失敗する可能性のあるエラーの型。
    - `void`: システムは状態を直接変更せず、新しい状態を計算して `World` に反映させる責務を持つ（後述）。

### 4.1. World: 唯一の状態（Source of Truth）

`World` は、すべてのエンティティとコンポーネントの状態を保持する唯一のオブジェクト。`Effect` の `Ref` や `TMap` などを利用して、アトミックかつ安全な状態更新を実現する。システムは `World` を直接変更せず、「現在のWorldから次のWorldへ」の遷移を記述した `Effect` を返す。

### 4.2. ゲームループ

ゲームループは、`Effect` のスケジューラによって駆動される宣言的なストリームとして表現される。

```typescript
// 概念コード
const gameLoop = pipe(
  Effect.sync(() => input.poll()), // 1. 入力状態のポーリング
  Effect.flatMap(() =>
    Effect.forEach(systems, (system) => system.run()) // 2. 全システムを並列または直列に実行
  ),
  Effect.flatMap(() => renderer.render(world)), // 3. レンダリング
  Effect.schedule(Schedule.spaced("16ms")), // 約60FPSでループ
  Effect.forever
);

// 起動
pipe(gameLoop, Effect.provide(initialContext), Effect.runPromise);
```

## 5. 主要なコンポーネントとシステムの再定義

### 5.1. コンポーネント (Component Schemas)

`@effect/schema` を用いて定義する。

```typescript
import { Schema } from "effect";

const Position = Schema.Struct({
  _tag: Schema.Literal("Position"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});

const Velocity = Schema.Struct({
  _tag: Schema.Literal("Velocity"),
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number,
});
```

### 5.2. システム (System Effects)

```typescript
// 概念コード
const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const entities = yield* _(world.query([Position, Velocity]));

  yield* _(
    Effect.forEach(entities, (entity) => {
      const pos = entity.get(Position);
      const vel = entity.get(Velocity);
      const newPos = { ...pos, x: pos.x + vel.dx, y: pos.y + vel.dy };
      return world.updateComponent(entity.id, newPos);
    })
  );
});
```

## 6. ディレクトリ構造案

```
src/
├── main.ts             # Effectプログラムの構築と実行
├── runtime/
│   ├── world.ts        # Worldの状態管理
│   ├── loop.ts         # ゲームループのEffect
│   └── services.ts     # Renderer, Inputなどのサービス定義
├── domain/
│   ├── entity.ts       # Entityの型定義
│   └── components.ts   # Componentスキーマの定義
├── systems/            # 各システムのEffect
│   ├── physics.ts
│   ├── render.ts
│   └── index.ts        # システムの合成
├── infrastructure/     # 外部ライブラリとの境界
│   ├── renderer-three.ts # Three.jsの実装
│   └── input-browser.ts  # ブラウザAPIを使った入力実装
└── utils/
    └── ...
```

## 7. 移行計画

1.  **Effect-TSとECSコアの導入:** `runtime`, `domain` の基本構造を実装する。
2.  **サービスの抽象化:** レンダリングや入力処理を `Effect.Layer` として抽象化し、`infrastructure` に具体的な実装を配置する。
3.  **コンポーネントスキーマの定義:** `domain/components.ts` に既存のコンポーネントを `Schema` を使って再定義する。
4.  **システムのEffect化:** 既存のロジックを `systems` ディレクトリ配下に `Effect` を使った純粋なプログラムとして再実装する。
5.  **メインループの刷新:** `main.ts` で各レイヤーとシステムを合成し、新しいEffectベースのゲームループを実行する。