# ディレクトリ構成 (Directory Structure)

プロジェクトのソースコードは `src/` ディレクトリ以下に配置され、責務に応じて明確に分割されています。この構成は、[関心の分離 (Separation of Concerns)](https://en.wikipedia.org/wiki/Separation_of_concerns) とデータ駆動設計の原則に強く従っており、コードの保守性、再利用性、テスト容易性を高めることを目的としています。

```
src/
├── main.ts               # アプリケーションのエントリーポイント、依存関係の注入
├── index.ts              # CSSのインポートなど、副作用を持つ初期化処理
├── domain/               # ドメインモデル（データ構造、型定義、ECSのコア要素）
├── systems/              # ゲームロジック（ECSのシステム）
├── runtime/              # ゲームの実行環境（ゲームループ、World操作）
├── infrastructure/       # 外部ライブラリ・APIとの境界（レンダリング、入力）
└── workers/              # Web Workerとして実行されるスクリプト
```

---

## 各ディレクトリの詳細

### `src/` トップレベル

- **`main.ts`**: アプリケーション全体の起動と、依存関係の解決を担当するエントリーポイントです。Three.jsのセットアップ、ゲームループの初期化、そしてシステムが発行した`SystemCommand`を処理する`onCommand`ハンドラ（Workerへのメッセージ送信など）の具体的な実装を定義し、ゲームループに注入します。
- **`index.ts`**: 主にアプリケーションのスタイルシート（CSS）をインポートするためのファイルです。
- **`main.test.ts`, `vitest.setup.ts`**: テストのエントリーポイントと設定ファイルです。

### `domain/`

ゲーム世界の核となる概念（ドメインモデル）を定義するディレクトリです。フレームワークやライブラリに依存しない、純粋なデータ構造と型が含まれます。

- **`world.ts`**: ECSの`World`データ構造そのものを定義します。エンティティとコンポーネントの集合、およびグローバルな状態を保持します。
- **`components.ts`**: `Position`, `Velocity` といった、すべてのコンポーネントのデータ構造を定義します。コンポーネントは純粋なデータであり、ロジックを持ちません。
- **`archetypes.ts`**: `createPlayer`, `createBlock`など、特定のコンポーネントの組み合わせを持つエンティティを生成するためのファクトリ関数を定義します。
- **`queries.ts`**: `playerQuery`など、特定のコンポーネントを持つエンティティの集合を効率的に取得するためのクエリ定義です。
- **`types.ts`**: `EntityId`のブランド型や、システムとランタイム間の通信に使われる`SystemCommand`型など、ドメイン全体で使われる重要な型を定義します。
- **`camera-logic.ts`**: カメラの状態やロジックに関する純粋なデータと関数を定義します。
- **`world-constants.ts`**: `CHUNK_SIZE`や`RENDER_DISTANCE`など、ワールドに関する不変の定数を定義します。

### `systems/`

ECSアーキテクチャにおける **System** を実装するディレクトリです。各ファイルは単一の明確な責務を持ちます。Systemは `(World, SystemDependencies) => [World, SystemCommand[]]` というシグネチャを持つ純粋な関数として実装されます。現在の`World`の状態と外部の入力（`SystemDependencies`）に基づき、更新された`World`と、実行されるべき副作用を表す`SystemCommand`の配列を返します。

- **`index.ts`**: すべてのシステムを定義し、実行順序を決定します。
- **`player-movement.ts`**: プレイヤーの入力に基づき、プレイヤーエンティティの`Velocity`コンポーネントを更新します。
- **`chunk-loading.ts`**: プレイヤーの位置を監視し、必要に応じて`GenerateChunk`コマンドを発行します。
- **`world-update.ts`**: Workerから受け取ったチャンクデータを`World`に反映させます。
- その他、`collision.ts`, `physics.ts`, `block-interaction.ts` など、ゲームの各機能を担当するシステムが含まれます。

### `runtime/`

ゲームを実行するための環境（ランタイム）を提供します。

- **`loop.ts`**: ゲームループの心臓部。`requestAnimationFrame`を利用して、フレームごとに`systems/`で定義された全システムを順番に実行します。システムが返した`SystemCommand`を受け取り、`main.ts`から注入された`onCommand`ハンドラに渡して処理を依頼します。
- **`world.ts`**: `World`を操作するためのヘルパー関数群（`addEntity`, `removeEntity`, `query`など）を提供します。`domain/world.ts`がデータ構造そのものの定義であるのに対し、こちらはそのデータ構造を操作するためのAPIを提供します。

### `infrastructure/`

外部の世界（ブラウザAPI、Three.js、Web Worker）との具体的なやり取りを実装する層です。

- **`renderer-three/`**: Three.jsを用いたレンダリング処理の具体的な実装。シーンのセットアップ、オブジェクトの更新、実際の描画命令などを担当します。
- **`input-browser.ts`**: ブラウザのDOMイベント（キーボード、マウス）をリッスンし、`systems/`が解釈しやすい形式の入力状態 (`BrowserInputState`) に変換します。
- **`camera-three.ts`**: `domain/camera-logic.ts`で計算されたカメラの状態を、実際のThree.jsの`Camera`オブジェクトに反映させます。
- **`raycast-three.ts`**: Three.jsを用いてレイキャスト計算を行います。
- **`material-manager.ts`**: Three.jsのマテリアルとテクスチャを管理します。
- **`spatial-grid.ts`**: 衝突検知を高速化するための空間グリッドデータ構造の実装。

### `workers/`

メインスレッドをブロックしないように、重い計算処理をバックグラウンドで実行するためのWeb Workerスクリプトを配置します。

- **`computation.worker.ts`**: `GenerateChunk`コマンドに応じて、プロシージャルな地形生成と、Greedy Meshingアルゴリズムによるメッシュ最適化を担当します。メインスレッドとは`postMessage`を通じて通信します。
