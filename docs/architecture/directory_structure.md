# ディレクトリ構成 (Directory Structure)

プロジェクトのソースコードは `src/` ディレクトリ以下に配置され、責務に応じて明確に分割されています。この構成は、[関心の分離 (Separation of Concerns)](https://en.wikipedia.org/wiki/Separation_of_concerns) の原則に強く従っており、コードの保守性、再利用性、テスト容易性を高めることを目的としています。

# ディレクトリ構成 (Directory Structure)

プロジェクトのソースコードは `src/` ディレクトリ以下に配置され、責務に応じて明確に分割されています。この構成は、[関心の分離 (Separation of Concerns)](https://en.wikipedia.org/wiki/Separation_of_concerns) の原則に強く従っており、コードの保守性、再利用性、テスト容易性を高めることを目的としています。

```
src/
├── main.ts             # アプリケーションのエントリーポイント、レイヤー合成
├── domain/             # ドメインモデル（エンティティ、コンポーネント、アーキタイプ）
├── runtime/            # ゲームの実行環境（ワールド、ループ、サービス）
├── systems/            # ゲームロジック（ECSのシステム）
├── infrastructure/     # 外部ライブラリ・APIとの境界
├── workers/            # Web Workerとして実行されるスクリプト
└── utils/              # 汎用的なユーティリティ関数
```

---

## 各ディレクトリの詳細

### `main.ts`

アプリケーション全体の起動と、依存関係の解決を担当するエントリーポイントです。
`Effect.Layer` を使用して、アプリケーションに必要なすべてのサービス（`WorldLive`, `RendererLive`, `GameStateLive` など）を宣言的に合成し、最終的な `AppLayer` を構築します。構築されたレイヤーをプログラムに提供（`provide`）し、ゲームループを含むメインの`Effect`を実行します。

### `domain/`

ゲーム世界の核となる概念（ドメインモデル）を定義するディレクトリです。フレームワークやライブラリに依存しない、純粋なデータ構造と型が含まれます。

-   **`entity.ts`**: `EntityId` のブランド型など、エンティティに関連する型定義。
-   **`components.ts`**: `Position`, `Velocity` といった、すべてのコンポーネントのスキーマ (`@effect/schema`)。コンポーネントは純粋なデータであり、ロジックを持ちません。SoA(Structure of Arrays)のための型情報（`StorageType`）もここでアノテーションされます。
-   **`archetypes.ts`**: エンティティを生成するためのファクトリ関数（プリファブ）を定義します。例えば `createPlayer` のように、特定の役割を持つエンティティに必要なコンポーネント構成をカプセル化します。
-   **`queries.ts`**: ECSの `World` から特定のエンティティ群を取得するための、型安全なクエリオブジェクトを定義します。
-   **`geometry.ts`**: ブロックの頂点や面の定義など、静的なジオメトリデータ。
-   **`block.ts`**: ブロックの種類 (`BlockType`) やテクスチャ座標など、ブロックに特化したデータ構造を定義します。

### `runtime/`

ゲームを実行するための環境（ランタイム）を提供します。アプリケーションのコアとなる状態管理やサービスのインターフェース定義が含まれます。

-   **`world.ts`**: ECSの `World` の実装。エンティティとコンポーネントの集合を管理します。詳細は[Worldアーキテクチャ](./world.md)を参照。
-   **`scheduler.ts`**: システムの実行順序を依存関係に基づいて決定するスケジューラ。詳細は[システムスケジューラ](./system-scheduler.md)を参照。
-   **`loop.ts`**: ゲームループの `Effect` プログラム。`requestAnimationFrame` を利用して、フレームごとに全システムをスケジューラに従って実行します。
-   **`services.ts`**: アプリケーション全体で利用されるサービスのインターフェース（`Context.Tag`）を定義します。
-   **`render-queue.ts`**: ゲームロジックからレンダラへ描画コマンドを非同期に渡すためのキューの実装。
-   **`chunk-data-queue.ts`**: Workerで生成されたチャンクデータをメインスレッドに渡すためのキューの実装。
-   **`save-load.ts`**: ゲームの状態をシリアライズ・デシリアライズするロジック。
-   **`game-state.ts`**: ゲームの全体的な状態（例: `Title`, `InGame`）やUIの状態を管理するサービス。

### `systems/`

ECSアーキテクチャにおける **System** を実装するディレクトリです。各ファイルは単一の明確な責務を持ち、`World` からエンティティをクエリし、コンポーネントストアを直接操作してゲームのロジックを進行させます。

-   **`index.ts`**: すべてのシステムを `SystemNode` として定義し、それらの実行順序に関する依存関係を記述します。
-   **`chunk-loading.ts`**: プレイヤーの位置に基づき、`computation.worker.ts`にチャンク生成タスクを依頼します。
-   **`world-update.ts`**: Workerから`ChunkDataQueue`経由で届いた地形データを受け取り、`World`にブロックエンティティとして追加し、メッシュを`RenderQueue`に送信します。
-   **`collision.ts`**: `SpatialGrid`を利用して効率的に衝突検知と解決を行います。
-   **`update-physics-world.ts`**: 毎フレーム、エンティティの最新位置を`SpatialGrid`に登録し直し、衝突検知の精度を保ちます。

### `infrastructure/`

外部の世界（ブラウザAPI、Three.js、Web Worker）との具体的なやり取りを実装する層です。`runtime/services.ts` で定義されたインターフェースの具体的な実装を提供します。

-   **`renderer-three.ts`**: `Renderer` サービスのThree.jsを用いた実装。
-   **`input-browser.ts`**: `Input` サービスのブラウザDOMイベントを用いた実装。
-   **`raycast-three.ts`**: `RaycastService` のThree.jsを用いた実装。
-   **`spatial-grid.ts`**: `SpatialGrid` サービスの実装。衝突検知を高速化するための空間グリッドを提供します。
-   **`computation-worker.ts`**: `ComputationWorker`サービスの実装。Web Workerのプールを管理し、重い計算タスクをオフロードします。
-   **`ui.ts`**: DOMイベントリスナーを登録し、UI操作に応じて `GameState` を更新します。

### `workers/`

メインスレッドをブロックしないように、重い計算処理をバックグラウンドで実行するためのWeb Workerスクリプトを配置します。

-   **`computation.worker.ts`**: プロシージャルな地形生成と、Greedy Meshingアルゴリズムによるメッシュ最適化を担当します。メインスレッドからチャンク座標とシード値を受け取り、計算結果のブロックデータとメッシュデータを返します。

### `utils/`

特定のドメインに属さない、プロジェクト全体で再利用可能な汎用ユーティリティ関数を配置します。（現在、このディレクトリは空です）


---

## 各ディレクトリの詳細

### `main.ts`

アプリケーション全体の起動と、依存関係の解決を担当するエントリーポイントです。
`Effect.Layer` を使用して、アプリケーションに必要なすべてのサービス（`WorldLive`, `RendererLive`, `GameStateLive` など）を宣言的に合成し、最終的な `AppLayer` を構築します。構築されたレイヤーをプログラムに提供（`provide`）し、ゲームループを含むメインの`Effect`を実行します。

### `domain/`

ゲーム世界の核となる概念（ドメインモデル）を定義するディレクトリです。フレームワークやライブラリに依存しない、純粋なデータ構造と型が含まれます。

-   **`entity.ts`**: `EntityId` のブランド型など、エンティティに関連する型定義。
-   **`components.ts`**: `Position`, `Velocity` といった、すべてのコンポーネントのスキーマ (`@effect/schema`)。コンポーネントは純粋なデータであり、ロジックを持ちません。
-   **`archetypes.ts`**: エンティティを生成するためのファクトリ関数（プリファブ）を定義します。例えば `createPlayer` のように、特定の役割を持つエンティティに必要なコンポーネント構成をカプセル化します。
-   **`queries.ts`**: ECSの `World` から特定のエンティティ群を取得するための、型安全なクエリオブジェクトを定義します。
-   **`geometry.ts`**: ブロックの頂点や面の定義など、静的なジオメトリデータ。
-   **`block.ts`**: ブロックの種類 (`BlockType`) やテクスチャ座標など、ブロックに特化したデータ構造を定義します。

### `runtime/`

ゲームを実行するための環境（ランタイム）を提供します。アプリケーションのコアとなる状態管理やサービスのインターフェース定義が含まれます。

-   **`world.ts`**: ECSの `World` の実装。エンティティとコンポーネントの集合を管理します。詳細は[Worldアーキテクチャ](./world.md)を参照。
-   **`component-store.ts`**: `World`のデータ層の具体的な実装。SoA(Structure of Arrays)に基づいた高効率なデータストレージを提供します。
-   **`scheduler.ts`**: システムの実行順序を依存関係に基づいて決定するスケジュューラ。詳細は[システムスケジュューラ](./system-scheduler.md)を参照。
-   **`loop.ts`**: ゲームループの `Effect` プログラム。`requestAnimationFrame` を利用して、フレームごとに全システムをスケジュューラに従って実行します。
-   **`services.ts`**: アプリケーション全体で利用されるサービスのインターフェース（`Context.Tag`）を定義します。
-   **`render-queue.ts`**: ゲームロジックからレンダラへ描画コマンドを非同期に渡すためのキューの実装。
-   **`chunk-data-queue.ts`**: Workerで生成されたチャンクデータをメインスレッドに渡すためのキューの実装。
-   **`save-load.ts`**: ゲームの状態をシリアライズ・デシリアライズするロジック。
-   **`game-state.ts`**: ゲームの全体的な状態（例: `Title`, `InGame`）やUIの状態を管理するサービス。

### `systems/`

ECSアーキテクチャにおける **System** を実装するディレクトリです。各ファイルは単一の明確な責務を持ち、`World` からコンポーネントをクエリし、それらを操作してゲームのロジックを進行させます。

-   **`index.ts`**: すべてのシステムを `SystemNode` として定義し、それらの実行順序に関する依存関係を記述します。
-   **`chunk-loading.ts`**: プレイヤーの位置に基づき、`computation.worker.ts`にチャンク生成タスクを依頼します。
-   **`world-update.ts`**: Workerから`ChunkDataQueue`経由で届いた地形データを受け取り、`World`にブロックエンティティとして追加します。
-   **`collision.ts`**: `SpatialGrid`を利用して効率的に衝突検知と解決を行います。
-   **`update-physics-world.ts`**: 毎フレーム、エンティティの最新位置を`SpatialGrid`に登録し直し、衝突検知の精度を保ちます。

### `infrastructure/`

外部の世界（ブラウザAPI、Three.js、Web Worker）との具体的なやり取りを実装する層です。`runtime/services.ts` で定義されたインターフェースの具体的な実装を提供します。

-   **`renderer-three.ts`**: `Renderer` サービスのThree.jsを用いた実装。
-   **`input-browser.ts`**: `Input` サービスのブラウザDOMイベントを用いた実装。
-   **`raycast-three.ts`**: `RaycastService` のThree.jsを用いた実装。
-   **`spatial-grid.ts`**: `SpatialGrid` サービスの実装。衝突検知を高速化するための空間グリッドを提供します。
-   **`computation-worker.ts`**: `ComputationWorker`サービスの実装。Web Workerのプールを管理し、重い計算タスクをオフロードします。
-   **`ui.ts`**: DOMイベントリスナーを登録し、UI操作に応じて `GameState` を更新します。

### `workers/`

メインスレッドをブロックしないように、重い計算処理をバックグラウンドで実行するためのWeb Workerスクリプトを配置します。

-   **`computation.worker.ts`**: 現在はプロシージャルな地形生成のロジックを担当しています。メインスレッドからチャンク座標とシード値を受け取り、計算結果のブロックデータとメッシュデータを返します。

### `utils/`

特定のドメインに属さない、プロジェクト全体で再利用可能な汎用ユーティリティ関数を配置します。（現在、このディレクトリは空です）