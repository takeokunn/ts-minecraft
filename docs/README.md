# ドキュメント

このディレクトリには、ts-minecraftプロジェクトに関する全てのドキュメントが格納されています。

## 目次

### 1. プロジェクト全体の規約と仕様

- [**規約 (Conventions)**](./project/conventions.md): コーディングスタイル、Git/GitHubの運用ルール、コミットメッセージの規約などを定義しています。
- [**使用技術 (Technologies)**](./project/technologies.md): プロジェクトで利用している主要なライブラリやフレームワークの概要と、その選定理由について説明しています。

### 2. アーキテクチャ

- [**ディレクトリ構成 (Directory Structure)**](./architecture/directory_structure.md): プロジェクトの各ディレクトリがどのような役割を持っているかを解説しています。
- [**ECS (Entity Component System)**](./architecture/ecs.md): Effect-TSと組み合わせた独自のECSアーキテクチャに関する詳細な設計思想と実装について説明しています。
- [**レンダリング (Rendering)**](./architecture/rendering.md): Three.jsを用いたレンダリングパイプライン、パフォーマンス最適化の手法について解説しています。

### 3. 機能仕様

- [**プレイヤー (Player)**](./features/player.md): プレイヤーの操作、物理挙動、カメラ制御に関する仕様をまとめています。
- [**ワールド (World)**](./features/world.md): ワールドの生成アルゴリズム、チャンク管理、バイオームの仕様について説明しています。
- [**インタラクション (Interaction)**](./features/interaction.md): ブロックの設置・破壊などのプレイヤーによるワールドへの干渉に関する仕様です。
- [**UI (User Interface)**](./features/ui.md): タイトル画面、HUD、メニューなどのUIコンポーネントの構成と状態管理について解説しています。
- [**セーブ & ロード (Save & Load)**](./features/save_load.md): ゲームの状態を保存・復元するシステムの仕様とデータフォーマットについて説明しています。
