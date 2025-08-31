# ドキュメント

このディレクトリには、ts-minecraftプロジェクトに関する全てのドキュメントが格納されています。

## 目次

### 1. プロジェクト全体の規約と仕様

- [**規約 (Conventions)**](./project/conventions.md): コーディングスタイル、Git/GitHubの運用ルール、コミットメッセージの規約などを定義しています。
- [**使用技術 (Technologies)**](./project/technologies.md): プロジェクトで利用している主要なライブラリやフレームワークの概要と、その選定理由について説明しています。

### 2. アーキテクチャ

- [**ディレクトリ構成 (Directory Structure)**](./architecture/directory_structure.md): プロジェクトの各ディレクトリがどのような役割を持っているかを解説しています。
- [**ECS (Entity Component System)**](./architecture/ecs.md): Effect-TSと組み合わせた独自のECSアーキテクチャに関する詳細な設計思想と実装について説明しています。
- [**システムスケジューラ (System Scheduler)**](./architecture/system-scheduler.md): システム間の依存関係を解決し、実行順序を自動的に決定するスケジューラの仕様です。
- [**レンダリング (Rendering)**](./architecture/rendering.md): Three.jsを用いたレンダリングパイプライン、パフォーマンス最適化の手法について解説しています。

### 3. 機能仕様

- [**プレイヤー (Player)**](./features/player.md): プレイヤーの操作、物理挙動に関する仕様をまとめています。
- [**ワールド (World)**](./features/world.md): ワールドの状態を管理する`World`サービスの仕様について説明しています。
- **インタラクション**:
  - [**レイキャスティング (Raycasting)**](./features/raycasting.md): プレイヤーの視線の先のブロックを特定するシステムの仕様です。
  - [**ブロックインタラクション (Block Interaction)**](./features/block-interaction.md): ブロックの設置・破壊に関するシステムの仕様です。
- **レンダリング**:
  - [**カメラ (Camera)**](./features/camera.md): ECSの状態をThree.jsのカメラに同期するシステムの仕様です。
  - [**シーンレンダリング (Scene Rendering)**](./features/scene.md): ECSの状態をThree.jsのシーンに描画するシステムの仕様です。
- [**物理 (Physics)**](./features/physics.md): 重力に関するシステムの仕様です。
- [**衝突検知 (Collision)**](./features/collision.md): エンティティと地形の衝突検知・解決に関するシステムの仕様です。
- [**ワールド生成 (Generation)**](./features/generation.md): ワールドの地形をプロシージャルに生成するアルゴリズムについて説明しています。
- [**チャンクローディング (Chunk Loading)**](./features/chunk-loading.md): チャンクの動的なロード・アンロードに関する仕様です。
- [**UI (User Interface)**](./features/ui.md): HUDなどのUIコンポーネントの構成と状態管理について解説しています。
- [**セーブ & ロード (Save & Load)**](./features/save_load.md): ゲームの状態を保存・復元するシステムの仕様とデータフォーマットについて説明しています。
