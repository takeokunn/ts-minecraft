# ドキュメント

このディレクトリには、ts-minecraftプロジェクトに関する全てのドキュメントが格納されています。

## 目次

### 1. プロジェクト全体の規約と仕様

- [**規約 (Conventions)**](./project/conventions.md): コーディングスタイル、Git/GitHubの運用ルール、コミットメッセージの規約などを定義しています。
- [**パフォーマンス設計 (Performance Design)**](./project/performance.md): GC負荷の削減やデータ指向設計など、パフォーマンスに関する設計思想をまとめています。
- [**使用技術 (Technologies)**](./project/technologies.md): プロジェクトで利用している主要なライブラリやフレームワークの概要と、その選定理由について説明しています。
- [**ブランチ戦略 (Branch Strategy)**](./project/branch-strategy.md): GitHub Flowをベースとした本プロジェクトのブランチ戦略について解説しています。

### 2. アーキテクチャ

- [**ディレクトリ構成 (Directory Structure)**](./architecture/directory_structure.md): プロジェクトの各ディレクトリがどのような役割を持っているかを解説しています。
- [**ECS (Entity Component System)**](./architecture/ecs.md): Effect-TSと深く統合された、本プロジェクト独自のECSアーキテクチャに関する詳細な設計思想と実装について説明しています。
- [**Worldアーキテクチャ (World Architecture)**](./architecture/world.md): ArchetypeとStructure of Arrays (SoA)を組み合わせた、高性能なECSワールドの実装について詳述しています。
- [**システムスケジューラ (System Scheduler)**](./architecture/system-scheduler.md): システム間の依存関係を解決し、実行順序を自動的に決定するスケジューラの仕様です。
- [**レンダリング (Rendering)**](./architecture/rendering.md): Three.jsを用いたレンダリングパイプライン、パフォーマンス最適化の手法について解説しています。

### 3. 機能仕様

#### 3.1 データモデル
- [**コンポーネント一覧 (Component List)**](./features/components-list.md): ゲーム内に存在する全コンポーネントの詳細です。
- [**アーキタイプ一覧 (Archetype List)**](./features/archetypes-list.md): エンティティを生成するためのテンプレートです。
- [**共通クエリ一覧 (Query List)**](./features/queries-list.md): システムがデータを取得するための共通クエリです。

#### 3.2 コア機能
- [**プレイヤー (Player)**](./features/player.md): プレイヤーの操作、物理挙動に関する仕様をまとめています。
- **インタラクション**:
  - [**レイキャスティング (Raycasting)**](./features/update-target-system.md): プレイヤーの視線の先のブロックを特定するシステムの仕様です。
  - [**ブロックインタラクション (Block Interaction)**](./features/block-interaction.md): ブロックの設置・破壊に関するシステムの仕様です。
- **ワールド**:
  - [**ワールド更新 (World Update)**](./features/world-update.md): ワールドの地形をプロシージャルに生成するアルゴリズムについて説明しています。
  - [**チャンクローディング (Chunk Loading)**](./features/chunk-loading.md): チャンクの動的なロード・アンロードに関する仕様です。
- **物理エンジン**:
  - [**物理 (Physics)**](./features/physics.md): エンティティに重力を適用するシステムの仕様です。
  - [**衝突検知・解決 (Collision)**](./features/collision.md): エンティティと地形の衝突を検知・解決するシステムの仕様です。
  - [**物理ワールド更新 (Update Physics World)**](./features/update-physics-world.md): 衝突検知を高速化するための空間グリッドを更新するシステムの仕様です。
- **レンダリングとUI**:
  - [**カメラ (Camera)**](./features/camera.md): ECSの状態をThree.jsのカメラに同期するシステムの仕様です。
  - [**シーンレンダリング (Scene Rendering)**](./features/scene.md): ECSの状態をThree.jsのシーンに描画するシステムの仕様です。
  - [**UI (User Interface)**](./features/ui.md): HUDなどのUIコンポーネントの構成と状態管理について解説しています。
- [**セーブ & ロード (Save & Load)**](./features/save_load.md): ゲームの状態を保存・復元するシステムの仕様とデータフォーマットについて説明しています。
