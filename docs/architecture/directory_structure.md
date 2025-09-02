# ディレクトリ構成 (Directory Structure)

プロジェクトのソースコードは `src/` ディレクトリ以下に配置され、責務に応じて明確に分割されています。この構成は、関数型プログラミングと[関心の分離 (Separation of Concerns)](https://en.wikipedia.org/wiki/Separation_of_concerns) の原則に強く従っており、コードの保守性、再利用性、テスト容易性を高めることを目的としています。

```
src/
├── __test__/             # 複数のレイヤーで共有されるテストヘルパー
├── main.ts               # アプリケーションのエントリーポイント
├── domain/
│   ├── __test__/         # domain層のテスト (e.g., world.spec.ts)
│   ├── archetypes.ts
│   └── ...
├── systems/
│   ├── __test__/         # systems層のテスト
│   └── ...
├── runtime/
├── infrastructure/
└── workers/
```

---

## 各ディレクトリの詳細

### `src/` トップレベル

- **`__test__/`**: 複数のドメインやレイヤーを横断して共有される、テスト用のユーティリティ、ファクトリ関数、モック実装などを配置します。
- **`main.ts`**: アプリケーション全体の起動と依存関係の解決を担当するエントリーポイントです。
- **`index.ts`**: 主にアプリケーションのスタイルシート（CSS）をインポートするためのファイルです。

### `domain/`, `systems/` など

各機能ディレクトリ（`domain/`, `systems/`など）の内部には、それぞれの層に特化したテストコードを配置するための`__test__/`ディレクトリが存在します。

- **`__test__/`**:
  - **責務**: 対応する層（例: `domain`）のコードをテストします。テストファイルは `.spec.ts` という拡張子を持ちます。
  - **例**: `src/domain/__test__/world.spec.ts` は `src/domain/world.ts` をテストします。

### `domain/`

ゲーム世界の核となる概念（ドメインモデル）を定義するディレクトリです。フレームワークやライブラリに依存せず、純粋なデータ構造と型が含まれます。

- **`components.ts`**: `@effect/schema` を用いて、`Position`, `Velocity` といったすべてのコンポーネントのスキーマを定義します。コンポーネントは純粋なデータであり、ロジックを持ちません。
- **`archetypes.ts`**: `createPlayer`, `createBlock` など、特定のコンポーネントの組み合わせを持つエンティティを生成するためのファクトリ関数を定義します。
- **`queries.ts`**: `playerQuery` など、特定のコンポーネントを持つエンティティの集合を効率的に取得するためのクエリ定義です。
- **`types.ts`**: `EntityId` のブランド型など、ドメイン全体で使われる重要な型を定義します。
- **`world-constants.ts`**: `CHUNK_SIZE` など、ワールドに関する不変の定数を定義します。

### `systems/`

ECSアーキテクチャにおける **System** を実装するディレクトリです。各ファイルは単一の明確な責務を持つ `Effect` プログラムとして実装されます。

- **責務**: `World` サービスからエンティティとコンポーネントをクエリし、ゲームのロジックを適用して、`World` の状態を更新します。
- **実装**: 各システムは `Effect<R, E, void>` として実装されます。`R` には `World` や `InputManager` など、そのシステムが必要とするサービスが型レベルで定義されます。
- **例**:
  - `player-movement.ts`: プレイヤーの入力に基づき、プレイヤーエンティティの `Velocity` コンポーネントを更新します。
  - `chunk-loading.ts`: プレイヤーの位置を監視し、必要に応じてチャンク生成を `ComputationWorker` に依頼します。

### `runtime/`

ゲームを実行するための抽象的なインターフェース（サービス）と、ゲームループの定義を提供します。

- **`services.ts`**: `World`, `RendererService`, `InputManager` といった、アプリケーションの各機能のインターフェースを `Context.Tag` を用いて定義します。これにより、具体的な実装からロジックを分離します。
- **`loop.ts`**: ゲームループの心臓部。`requestAnimationFrame` を利用して、フレームごとに `systems/` で定義された全システムを順番に実行する `Effect` を構築します。
- **`world.ts`**: `World` サービスとその `Live` レイヤー（本番実装）を提供します。エンティティとコンポーネントの状態を管理し、クエリAPIを提供します。

### `infrastructure/`

`runtime/` で定義されたサービスの具体的な実装を提供する層です。外部の世界（ブラウザAPI、Three.js、Web Worker）とのやり取りは、すべてこのディレクトリにカプセル化されます。

- **`renderer-three/`**: `RendererService` の実装。Three.jsを用いてレンダリング処理を行います。
- **`input-browser.ts`**: `InputManager` の実装。ブラウザのDOMイベントをリッスンし、入力状態を提供します。
- **`camera-three.ts`**: `ThreeCameraService` の実装。ECSの状態をThree.jsの`Camera`オブジェクトに反映させます。
- **`computation.worker.ts`**: `ComputationWorker` サービスの実装。地形生成などを担当するWeb Workerとの通信を管理します。
- **`raycast-three.ts`**: `RaycastService` の実装。Three.jsを用いてレイキャスト計算を行います。
- **`material-manager.ts`**: Three.jsのマテリアルとテクスチャを管理する `MaterialManager` サービスの実装。
- **`spatial-grid.ts`**: 衝突検知を高速化するための `SpatialGrid` サービスの実装。

### `workers/`

メインスレッドをブロックしないように、重い計算処理をバックグラウンドで実行するためのWeb Workerスクリプトです。

- **`computation.worker.ts`**: プロシージャルな地形生成や、Greedy Meshingアルゴリズムによるメッシュ最適化などを担当します。
