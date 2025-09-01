# ドキュメント

このディレクトリには、ts-minecraftプロジェクトに関する全てのドキュメントが格納されています。

## はじめに

- [**設計思想 (v2)**](./design.md): プロジェクトのコアコンセプト、アーキテクチャの概要、採用技術の選定理由などをまとめた高レベルな設計書です。

---

## 1. プロジェクト規約・仕様

プロジェクト全体の方針、規約、CI/CDパイプラインについて説明します。

- [**ブランチ戦略 (Branch Strategy)**](./project/branch-strategy.md): GitHub Flowをベースとしたブランチ戦略について解説しています。
- [**CI/CD パイプライン**](./project/cicd.md): GitHub Actionsを用いたCI/CDの仕組みについて説明しています。
- [**プロジェクト規約 (Conventions)**](./project/conventions.md): コーディングスタイル、命名規則、アーキテクチャの原則などを定義しています。
- [**パフォーマンス設計 (Performance Design)**](./project/performance.md): データ指向設計やGC負荷削減など、パフォーマンスに関する設計思想をまとめています。
- [**使用技術 (Technologies)**](./project/technologies.md): プロジェクトで利用している主要なライブラリやフレームワークの概要と、その選定理由について説明しています。
- [**テスティング (Testing)**](./project/testing.md): Vitestとfast-checkを用いたテスト戦略について解説しています。

---

## 2. アーキテクチャ

システムの設計と構造に関する詳細なドキュメントです。

- [**ディレクトリ構成 (Directory Structure)**](./architecture/directory_structure.md): プロジェクトの各ディレクトリがどのような役割を持っているかを解説しています。
- [**ECS (Entity Component System)**](./architecture/ecs.md): Effect-TSと深く統合された、本プロジェクト独自のECSアーキテクチャに関する詳細な設計思想と実装について説明しています。
- [**レンダリングアーキテクチャ (Rendering Architecture)**](./architecture/rendering.md): ゲームロジックとレンダリングエンジンを分離する設計について解説しています。
- [**システムスケジューラ (System Scheduler)**](./architecture/system-scheduler.md): システム間の依存関係を解決し、実行順序を自動的に決定するスケジューラの仕様です。
- [**Worldアーキテクチャ (World Architecture)**](./architecture/world.md): ArchetypeとStructure of Arrays (SoA)を組み合わせた、高性能なECSワールドの実装について詳述しています。

---

## 3. 機能仕様

ゲームの各機能に関する詳細な仕様書です。

### 3.1 データモデル

- [**コンポーネント一覧 (Component List)**](./features/components-list.md): ゲーム内に存在する全コンポーネントの詳細です。
- [**アーキタイプ一覧 (Archetype List)**](./features/archetypes-list.md): エンティティを生成するためのテンプレートです。
- [**共通クエリ一覧 (Query List)**](./features/queries-list.md): システムがデータを取得するための共通クエリです。

### 3.2 ワールド

- [**Worldサービス**](./features/world.md): ECSの中核となる`World`サービスのAPIと設計について解説しています。
- [**ワールド生成 (World Generation)**](./features/world-generation.md): ワールドの地形をプロシージャルに生成するアルゴリズムについて説明しています。
- [**チャンクローディング (Chunk Loading)**](./features/chunk-loading.md): チャンクの動的なロード・アンロードに関する仕様です。
- [**ワールド更新 (World Update)**](./features/world-update.md): Workerから受け取ったデータでワールドを更新するシステムの仕様です。
- [**セーブ & ロード (Save & Load)**](./features/save_load.md): ゲームの状態を保存・復元するシステムの仕様とデータフォーマットについて説明しています。

### 3.3 プレイヤーとインタラクション

- [**プレイヤー (Player)**](./features/player.md): プレイヤーの操作が複数のシステムによってどのように実現されているかを解説しています。
- [**入力ポーリング (Input Polling)**](./features/input-polling.md): 物理的な入力をゲーム内状態に変換するシステムの仕様です。
- [**カメラ制御 (Camera Control)**](./features/camera-control.md): マウス入力による視点操作のシステムの仕様です。
- [**プレイヤー移動 (Player Movement)**](./features/player-movement.md): 入力とカメラの状態に基づき、プレイヤーの移動速度を計算するシステムの仕様です。
- [**ターゲット更新 (Update Target System)**](./features/update-target-system.md): プレイヤーの視線の先のブロックを特定するシステムの仕様です。
- [**ブロックインタラクション (Block Interaction)**](./features/block-interaction.md): ブロックの設置・破壊に関するシステムの仕様です。

### 3.4 物理エンジン

- [**物理 (Physics)**](./features/physics.md): エンティティに重力を適用するシステムの仕様です。
- [**衝突検知・解決 (Collision)**](./features/collision.md): エンティティと地形の衝突を検知・解決するシステムの仕様です。
- [**物理ワールド更新 (Update Physics World)**](./features/update-physics-world.md): 衝突検知を高速化するための空間グリッドを更新するシステムの仕様です。

### 3.5 レンダリングとUI

- [**レンダリングの最適化**](./features/rendering.md): Greedy MeshingやInstancedMeshを用いたレンダリングの最適化手法について解説しています。
- [**カメラ (Camera)**](./features/camera.md): ECSの状態をThree.jsのカメラに同期するシステムの仕様です。
- [**UI (User Interface)**](./features/ui.md): HUDなどのUIコンポーネントの構成と状態管理について解説しています。
