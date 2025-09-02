# ts-minecraft

本プロジェクトは、TypeScriptと関数型プログラミングの原則を用いて、Minecraftライクな3Dサンドボックスゲームを構築する試みです。
アーキテクチャの根幹に **Entity Component System (ECS)** を据え、**[Effect-TS](https://effect.website/)** を全面的に採用することで、極めて堅牢で、テスト容易性が高く、ハイパフォーマンスなゲームの実現を目指します。

## コアコンセプト

- **データ指向設計 (ECS):** ゲームのすべての状態をプレーンなデータ（コンポーネント）として管理します。ロジック（システム）とデータを明確に分離することで、見通しが良く、パフォーマンスのボトルネックを特定しやすい構造を実現します。

- **純粋関数型プログラミング:** ゲームのロジックはすべて副作用のない純粋な関数として記述します。副作用（描画、入力、非同期処理など）は `Effect` データ型を用いて厳密に分離・管理し、コードの予測可能性とテスト容易性を最大限に高めます。

- **型安全性と不変性:** TypeScriptの強力な型システムと、`@effect/schema` を活用し、実行時エラーを撲滅します。すべてのデータ構造は原則として不変（immutable）とし、状態変更を安全かつ予測可能にします。

## アーキテクチャ: Effect-TSネイティブなECS

ECSの各要素をEffect-TSの思想に基づいて再定義しています。

- **Entity (エンティティ):** 一意なIDを持つゲーム世界のすべての「モノ」。
- **Component (コンポーネント):** `@effect/schema` を用いて定義される、状態を持たない純粋なデータ。エンティティの特性を定義します（例: `Position`, `Velocity`）。
- **System (システム):** `Effect<R, E, void>` として表現される純粋なプログラム。コンポーネントを読み取り、ロジックを実行し、新しい状態を計算します。
  - `R` (Context): システムが必要とする依存関係（`World`, `Renderer`など）を型レベルで明示します。
- **World (ワールド):** すべてのエンティティとコンポーネントの状態を保持する唯一の信頼できる情報源（Source of Truth）です。

ゲームループも `Effect` のスケジューラによって駆動される宣言的なプログラムとして構築されており、これにより複雑な処理フローを安全かつシンプルに記述できます。

## なぜEffect-TSなのか？

従来のTypeScript開発が抱える副作用管理、暗黙的な依存関係、煩雑なエラー処理といった課題を、Effect-TSは包括的に解決します。

- **副作用の完全な分離:** `Effect` は、「何を実行したいか」を記述した不変のデータ構造です。これによりロジックは純粋に保たれ、副作用の実行はアプリケーションの最上位層（`main.ts`）に一任されます。

- **明示的な依存性注入 (DI):** `Context` と `Layer` の仕組みにより、コンポーネントが何に依存しているかが型シグネチャレベルで明確になります。これにより、テスト時に実装をモックに差し替えることが極めて容易になります。

- **型安全なエラーハンドリング:** `Effect` は、発生しうるエラーの型を `E` として表現します。これにより、どのようなエラーを処理する必要があるかがコンパイル時に強制され、エラーハンドリングの漏れを防ぎます。

Effect-TSを採用することで、本作は単なる「TypeScriptで書かれたゲーム」ではなく、「型安全で、テスト容易性が高く、宣言的なコードで構築された、極めて堅牢なアプリケーション」となることを目指します。

---

## ドキュメント

### 1. プロジェクト概要

- [**使用技術 (Technologies)**](./project/technologies.md)
- [**プロジェクト規約 (Conventions)**](./project/conventions.md)
- [**パフォーマンス設計 (Performance)**](./project/performance.md)

### 2. アーキテクチャ

- [**ディレクトリ構成 (Directory Structure)**](./architecture/directory_structure.md)
- [**ECS設計 (Entity Component System)**](./architecture/ecs.md)
- [**World設計 (World Architecture)**](./architecture/world.md)
- [**システム実行順序 (System Scheduler)**](./architecture/system-scheduler.md)

### 3. 機能仕様

#### データモデル

- [**コンポーネント一覧 (Components)**](./features/components-list.md)
- [**アーキタイプ一覧 (Archetypes)**](./features/archetypes-list.md)
- [**クエリ一覧 (Queries)**](./features/queries-list.md)

#### ワールドとプレイヤー

- [**Worldサービス API (World Service)**](./features/world.md)
- [**ワールド生成 (World Generation)**](./features/world-generation.md)
- [**チャンクローディング (Chunk Loading)**](./features/chunk-loading.md)
- [**プレイヤー (Player)**](./features/player.md)
- [**入力処理 (Input Polling)**](./features/input-polling.md)
- [**カメラ制御 (Camera Control)**](./features/camera-control.md)
- [**プレイヤー移動 (Player Movement)**](./features/player-movement.md)
- [**ブロック操作 (Block Interaction)**](./features/block-interaction.md)
- [**セーブ & ロード (Save & Load)**](./features/save_load.md)

#### 物理エンジン

- [**物理システム (Physics)**](./features/physics.md)
- [**衝突検知 (Collision)**](./features/collision.md)
- [**空間グリッド更新 (Update Physics World)**](./features/update-physics-world.md)

#### レンダリングとUI

- [**レンダリングパイプライン (Rendering)**](./features/rendering.md)
- [**ターゲット更新 (Update Target System)**](./features/update-target-system.md)
- [**UIシステム (User Interface)**](./features/ui.md)

### 4. 開発プロセス

- [**ブランチ戦略 (Branch Strategy)**](./project/branch-strategy.md)
- [**CI/CD パイプライン**](./project/cicd.md)
- [**テスト戦略 (Testing Strategy)**](./project/testing-strategy.md)
- [**テストガイド (Testing Guide)**](./project/testing.md)