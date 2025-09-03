# ts-minecraft

本プロジェクトは、TypeScriptと関数型プログラミングの原則を用いて、Minecraftライクな3Dサンドボックスゲームを構築する試みです。
アーキテクチャの根幹に **Entity Component System (ECS)** を据え、**[Effect-TS](https://effect.website/)** を全面的に採用することで、極めて堅牢で、テスト容易性が高く、ハイパフォーマンスなゲームの実現を目指します。

## コアコンセプト

- **データ指向設計 (ECS):** ゲームのすべての状態をプレーンなデータ（コンポーネント）として管理します。ロジック（システム）とデータを明確に分離することで、見通しが良く、パフォーマンスのボトルネックを特定しやすい構造を実現します。

- **純粋関数型プログラミング:** ゲームのロジックはすべて副作用のない純粋な関数として記述することを目指します。副作用（描画、入力、非同期処理など）は `Effect` データ型を用いて厳密に分離・管理し、コードの予測可能性とテスト容易性を最大限に高めます。

- **型安全性と不変性:** TypeScriptの強力な型システムと、`@effect/schema` を活用し、実行時エラーの撲滅を目指します。すべてのデータ構造は原則として不変（immutable）とし、状態変更を安全かつ予測可能にします。

## アーキテクチャ: Effect-TSネイティブなECS

ECSの各要素をEffect-TSの思想に基づいて再定義しています。

- **Entity (エンティティ):** 一意なIDを持つゲーム世界のすべての「モノ」。
- **Component (コンポーネント):** `@effect/schema` を用いて定義される、状態を持たない純粋なデータ。エンティティの特性を定義します（例: `Position`, `Velocity`）。
- **System (システム):** `Effect<void, E, R>` として表現される純粋なプログラム。コンポーネントを読み取り、ロジックを実行し、新しい状態を計算します。
  - `R` (Context): システムが必要とする依存関係（`World`, `Renderer`など）を型レベルで明示します。
- **World (ワールド):** すべてのエンティティとコンポーネントの状態を保持する唯一の信頼できる情報源（Source of Truth）です。

ゲームループも `Effect` のスケジューラによって駆動される宣言的なプログラムとして構築されており、これにより複雑な処理フローを安全かつシンプルに記述できます。

## なぜEffect-TSなのか？

従来のTypeScript開発が抱える副作用管理、暗黙的な依存関係、煩雑なエラー処理といった課題を、Effect-TSは包括的に解決します。本プロジェクトでは、Effect-TSを全面的に採用することで、`any`や`unknown`、`as`による型アサーションを撲滅し、アプリケーションの堅牢性を根本から高めることを目指します。

- **副作用の完全な分離 (`Effect`):** ファイルI/O、DOM操作、API呼び出しといった副作用を伴う処理はすべて `Effect` でラップされます。`Effect<A, E, R>` は、「成功時に`A`型、失敗時に`E`型を返し、`R`型の依存関係を必要とする処理」を記述した不変のデータ構造です。副作用の実行はアプリケーションの最上位層（`main.ts`）に一任され、ビジネスロジックを純粋に保ちます。

- **明示的な依存性注入 (DI):** `Context` と `Layer` の仕組みにより、コンポーネントが何に依存しているかが型シグネチャ（`R`）レベルで明確になります。これにより、テスト時に実装をモックに差し替えることが極めて容易になります。

- **型安全なエラーハンドリング:** `Effect` は、発生しうるエラーの型を `E` として表現します。`try...catch`文を`Effect.try`や`Effect.catchAll`に置き換えることで、どのようなエラーを処理する必要があるかがコンパイル時に強制され、エラーハンドリングの漏れを防ぎます。

- **`any`, `unknown`, `as` の撲滅:** `Effect` のパイプライン (`pipe`, `Effect.flatMap`, `Effect.map`) を活用し、型推論を最大限に活かすことで、これらの型を排除します。型が不明な値は `@effect/schema` を使って安全にデコード・バリデーションします。型アサーションが必要な場面では、`Effect.fromEither` や `Effect.fromOption` を用いて、失敗する可能性を型で表現します。

Effect-TSを採用することで、本作は単なる「TypeScriptで書かれたゲーム」ではなく、「型安全で、テスト容易性が高く、宣言的なコードで構築された、極めて堅牢なアプリケーション」となることを目指します。

---

## ドキュメント

### 1. プロジェクト概要

- [**使用技術 (Technologies)**](./technologies.md)
- [**プロジェクト規約 (Conventions)**](./conventions.md)
- [**パフォーマンス設計 (Performance)**](./performance.md)

### 2. アーキテクチャ

- [**ディレクトリ構成 (Directory Structure)**](./directory-structure.md)
- [**ECS設計 (Entity Component System)**](./ecs.md)
- [**World内部設計 (World Architecture)**](./world-performance.md)
- [**システム実行順序 (System Scheduler)**](./system-scheduler.md)

### 3. 機能仕様

#### データモデル

- [**コンポーネント一覧 (Components)**](./components-list.md)
- [**アーキタイプ一覧 (Archetypes)**](./archetypes-list.md)
- [**クエリ一覧 (Queries)**](./queries-list.md)

#### ワールドとプレイヤー

- [**World (API, ライフサイクル, etc)**](./world.md)
- [**Player (入力, 移動, etc)**](./player.md)
- [**Camera (カメラ制御)**](./camera.md)

#### 物理エンジン

- [**Physics (物理, 衝突検知)**](./physics.md)

#### レンダリングとUI

- [**Rendering (レンダリング, UI)**](./rendering.md)

### 4. 開発プロセス

- [**ブランチ戦略 (Branch Strategy)**](./branch-strategy.md)
- [**CI/CD パイプライン**](./cicd.md)
- [**テスト戦略 (Testing Strategy)**](./testing-strategy.md)
- [**テストガイド (Testing Guide)**](./testing.md)
