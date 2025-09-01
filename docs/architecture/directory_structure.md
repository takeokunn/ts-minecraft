# ディレクトリ構成 (Directory Structure)

プロジェクトのソースコードは `src/` ディレクトリ以下に配置され、責務に応じて明確に分割されています。この構成は、[関心の分離 (Separation of Concerns)](https://en.wikipedia.org/wiki/Separation_of_concerns) の原則に強く従っており、コードの保守性、再利用性、テスト容易性を高めることを目的としています。

```
src/
├── main.ts               # アプリケーションのエントリーポイント、レイヤー合成
├── index.ts              # CSSのインポートなど、副作用を持つ初期化処理
├── perlin-noise.d.ts     # perlin-noiseライブラリの型定義ファイル
├── domain/               # ドメインモデル（コンポーネント、アーキタイプ、型定義）
├── runtime/              # ゲームの実行環境（ワールド、ループ、サービス）
├── systems/              # ゲームロジック（ECSのシステム）
├── infrastructure/       # 外部ライブラリ・APIとの境界
├── workers/              # Web Workerとして実行されるスクリプト
└── utils/                # 汎用的なユーティリティ関数 (現在は空)
```

---

## 各ディレクトリの詳細

### `main.ts`

アプリケーション全体の起動と、依存関係の解決を担当するエントリーポイントです。
`Effect.Layer` を使用して、アプリケーションに必要なすべてのサービス（`WorldLive`, `RendererLive`, `ResourceLive` など）を宣言的に合成し、最終的な `AppLayer` を構築します。構築されたレイヤーをプログラムに提供（`provide`）し、ゲームループを含むメインの`Effect`を実行します。

### `index.ts`

主にアプリケーションのスタイルシート（CSS）をインポートするためのファイルです。`main.ts`が純粋なロジックとレイヤー合成に集中する一方で、`index.ts`はHTMLに直接関連する副作用（CSSの適用など）を扱います。

### `domain/`

ゲーム世界の核となる概念（ドメインモデル）を定義するディレクトリです。フレームワークやライブラリに依存しない、純粋なデータ構造と型が含まれます。

-   **`components.ts`**: `Position`, `Velocity` といった、すべてのコンポーネントのスキーマ (`@effect/schema`)。コンポーネントは純粋なデータであり、ロジックを持ちません。
-   **`archetypes.ts`**: エンティティを生成するためのファクトリ関数（プリファブ）を定義します。
-   **`block.ts`**: ブロックの種類 (`BlockType`) やテクスチャ座標など、ブロックに特化したデータ構造を定義します。
-   **`geometry.ts`**: ブロックの頂点や面の定義など、静的なジオメトリデータ。
-   **`types.ts`**: `EntityId` のブランド型など、ドメイン全体で使われる基本的な型を定義します。

### `runtime/`

ゲームを実行するための環境（ランタイム）を提供します。アプリケーションのコアとなる状態管理やサービスのインターフェース定義が含まれます。

-   **`world.ts`**: ECSの `World` の実装。エンティティとコンポーネントの集合を管理します。詳細は[Worldアーキテクチャ](./world.md)を参照。
-   **`loop.ts`**: ゲームループの `Effect` プログラム。`requestAnimationFrame` を利用して、フレームごとに全システムをスケジューラに従って実行します。
-   **`resource.ts`**: ゲームの状態（例: `Title`, `InGame`）やUIの状態を管理するサービス (`Resource`) のインターフェースとLive実装を定義します。
-   **`render-queue.ts`**: ゲームロジックからレンダラへ描画コマンドを非同期に渡すためのキュー。
-   **`chunk-data-queue.ts`**: Workerで生成されたチャンクデータをメインスレッドに渡すためのキュー。
-   **`save-load.ts`**: ゲームの状態をシリアライズ・デシリアライズするロジック。
-   **`computation.ts`**: Web Workerとの通信を抽象化するサービス。

### `systems/`

ECSアーキテクチャにおける **System** を実装するディレクトリです。各ファイルは単一の明確な責務を持ち、`World` からエンティティをクエリし、コンポーネントを操作してゲームのロジックを進行させます。

-   **`index.ts`**: すべてのシステムを `SystemNode` として定義し、それらの実行順序に関する依存関係を記述します。詳細は[システムスケジューラ](./system-scheduler.md)を参照してください。
-   **`chunk-loading.ts`**: プレイヤーの位置に基づき、`computation.worker.ts`にチャンク生成タスクを依頼します。
-   **`world-update.ts`**: Workerから`ChunkDataQueue`経由で届いた地形データを受け取り、`World`にブロックエンティティとして追加し、メッシュを`RenderQueue`に送信します。
-   **`collision.ts`**: `SpatialGrid`を利用して効率的に衝突検知と解決を行います。
-   その他、`player-movement.ts`, `physics.ts`, `block-interaction.ts` など、ゲームの各機能を担当するシステムが含まれます。

### `infrastructure/`

外部の世界（ブラウザAPI、Three.js、Web Worker）との具体的なやり取りを実装する層です。`runtime/` で定義されたサービスのインターフェースの具体的な実装を提供します。

-   **`renderer-three/`**: `Renderer` サービスのThree.jsを用いた実装。責務に応じてさらに分割されています。
    -   `render.ts`: レンダリングループとThree.jsの基本的なセットアップ。
    -   `context.ts`: `RendererContext`サービスの実装。Three.jsの`Scene`や`Camera`を管理します。
    -   `updates.ts`: `RenderQueue`からコマンドを受け取り、Three.jsのオブジェクトを更新します。
    -   `commands.ts`: レンダラが受け取るコマンドの型定義。
-   **`input-browser.ts`**: `Input` サービスのブラウザDOMイベントを用いた実装。
-   **`raycast-three.ts`**: `RaycastService` のThree.jsを用いた実装。
-   **`spatial-grid.ts`**: `SpatialGrid` サービスの実装。衝突検知を高速化するための空間グリッドを提供します。
-   **`computation-worker.ts`**: `Computation`サービスの実装。Web Workerのプールを管理し、重い計算タスクをオフロードします。
-   **`camera-three.ts`**: `Camera` サービスのThree.jsを用いた実装。
-   **`material-manager.ts`**: Three.jsのマテリアルとテクスチャを管理するサービス。
-   **`ui.ts`**: DOMイベントリスナーを登録し、UI操作に応じて `Resource` サービスの状態を更新します。

### `workers/`

メインスレッドをブロックしないように、重い計算処理をバックグラウンドで実行するためのWeb Workerスクリプトを配置します。

-   **`computation.worker.ts`**: プロシージャルな地形生成と、Greedy Meshingアルゴリズムによるメッシュ最適化を担当します。

### `utils/`

特定のドメインに属さない、プロジェクト全体で再利用可能な汎用ユーティリティ関数を配置します。（現在は空）
