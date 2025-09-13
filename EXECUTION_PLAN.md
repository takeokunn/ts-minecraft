# ドキュメント再構築実行計画

## 1. 目的

`@docs/**` ディレクトリ構造と内容を全面的に見直し、以下の点を改善する。

- **管理容易性:** AIコーディングエージェントや新しい開発者が理解しやすい、一貫性のある構造にする。
- **情報の品質:** 情報を劣化させず、重複を排除し（DRY）、内容を充実させることで、実装時の参照資料としての価値を高める。
- **網羅性:** 不足している重要機能の仕様書を追加し、プロジェクトの全体像をより明確にする。

## 2. 新しいディレクトリ構造

現在の複雑で一部重複のある構造を廃止し、以下の階層的で明確な構造に再編成する。

```
docs/
├── 00-introduction/
│   ├── 00-project-overview.md  # プロジェクトの全体像と目標
│   └── 01-getting-started.md   # 開発環境のセットアップと起動方法
├── 01-architecture/
│   ├── 00-overall-design.md      # DDD x ECS x Effect-TS 統合アーキテクチャ
│   ├── 01-design-principles.md   # 純粋性、不変性などの設計原則
│   ├── 02-technology-stack.md    # 技術選定と各ライブラリの役割
│   ├── 03-layered-architecture.md # 4層アーキテクチャ（Presentation, Application, Domain, Infrastructure）
│   ├── 04-ecs-integration.md     # ECSの設計思想、アーキタイプ、SoA最適化
│   └── 05-effect-ts-patterns.md  # プロジェクト固有のEffect-TS利用パターン
├── 02-specifications/
│   ├── 00-core-features/
│   │   ├── 00-overview.md
│   │   ├── 01-world-system.md
│   │   ├── 02-player-system.md
│   │   ├── 03-block-system.md
│   │   ├── 04-entity-system.md
│   │   ├── 05-rendering-system.md
│   │   ├── 06-physics-system.md
│   │   ├── 07-chunk-system.md
│   │   ├── 08-inventory-system.md
│   │   ├── 09-crafting-system.md
│   │   ├── 10-material-system.md
│   │   ├── 11-scene-management-system.md
│   │   ├── 12-health-hunger-system.md # (新規作成)
│   │   ├── 13-combat-system.md        # (新規作成)
│   │   ├── 14-sound-music-system.md
│   │   ├── 15-input-controls.md
│   │   ├── 16-food-agriculture-system.md
│   │   ├── 17-sign-book-system.md
│   │   └── 18-bed-sleep-system.md
│   └── 01-enhanced-features/
│       ├── 00-overview.md
│       ├── 01-redstone-system.md
│       ├── 02-weather-system.md
│       ├── 03-day-night-cycle.md
│       ├── 04-mob-ai-system.md
│       ├── 05-villager-trading.md
│       ├── 06-enchantment-system.md
│       ├── 07-potion-effects.md
│       ├── 08-nether-portals.md
│       ├── 09-structure-generation.md
│       ├── 10-multiplayer-architecture.md
│       ├── 11-ocean-underwater-system.md
│       ├── 12-extended-biome-system.md
│       ├── 13-the-end-dimension.md
│       └── 14-particle-system.md
├── 03-guides/
│   ├── 00-development-conventions.md # 命名規則、コーディングスタイル
│   ├── 01-entry-points.md            # アプリケーション起動フロー
│   ├── 02-testing-guide.md           # テスト戦略と作成方法
│   ├── 03-performance-optimization.md # パフォーマンス最適化手法
│   └── 04-error-resolution.md        # TypeScriptエラー解決ガイド
└── 04-appendix/
    ├── 00-glossary.md          # 用語集 (新規作成)
    └── 01-asset-sources.md     # フリーアセットの入手先 (新規作成)
```

## 3. 実行計画

### フェーズ1: 構造の再編成とファイルの移動

1.  **バックアップ:** (手動で実行済みと仮定)
2.  **ディレクトリ作成:** 新しいディレクトリ構造 (`00-introduction`から`04-appendix`まで) を作成します。
3.  **ファイル移動とリネーム:** 既存のマークダウンファイルを新しい構造に従って移動し、`XX-topic-name.md` の形式にリネームします。
    -   例: `docs/00-architecture/00-overview.md` -> `docs/01-architecture/00-overall-design.md`
    -   例: `docs/architecture/ddd-principles.md` -> `docs/01-architecture/01-design-principles.md`
    -   例: `docs/05-core-features/01-world-system.md` -> `docs/02-specifications/00-core-features/01-world-system.md`

### フェーズ2: 内容の統合とDRY化

1.  **アーキテクチャ文書の統合:**
    -   `docs/01-architecture/00-overall-design.md`: `docs/00-architecture/00-overview.md`, `docs/architecture/overview.md`, `docs/00-introduction/00-project-overview.md` のアーキテクチャ部分を統合・整理します。
    -   `docs/01-architecture/01-design-principles.md`: `docs/00-architecture/01-principles.md`, `docs/architecture/ddd-principles.md` の内容を統合します。
    -   `docs/01-architecture/03-layered-architecture.md`: `docs/layers/*.md` の内容を集約します。
    -   `docs/01-architecture/04-ecs-integration.md`: `docs/02-entity-component-system/00-ecs-fundamentals.md`, `docs/architecture/ecs-integration.md`, `docs/features/ecs-system.md` を統合します。
    -   `docs/01-architecture/05-effect-ts-patterns.md`: `docs/03-effect-ts-patterns/00-functional-core.md`, `docs/architecture/effect-patterns.md` を統合します。
2.  **技術スタック文書の作成:**
    -   `docs/01-architecture/02-technology-stack.md`: `README.md` や各所に散らばる技術スタック情報を集約し、選定理由を追記します。
3.  **開発ガイドの整理:**
    -   `docs/03-guides/` 以下に、`docs/guides/` や `docs/04-implementation-guide/` の内容を整理・統合します。

### フェーズ3: 内容の充実と新規作成

1.  **仕様書のテンプレート化:**
    -   `docs/02-specifications/` 以下の各機能仕様書に、以下のセクションを設けて内容を充実させます。
        -   概要 (Overview)
        -   ドメインモデル (Domain Model with Schema)
        -   主要ロジック (Core Logic with Services)
        -   ECS統合 (ECS Integration: Components & Systems)
        -   UI連携 (UI Integration)
        -   パフォーマンス考慮事項 (Performance Considerations)
2.  **新規仕様書の作成:**
    -   `docs/02-specifications/core-features/12-health-hunger-system.md`
    -   `docs/02-specifications/core-features/13-combat-system.md`
    -   上記のファイルを作成し、基本的な構造を記述します。
3.  **付録の作成:**
    -   `docs/04-appendix/00-glossary.md`: プロジェクト固有の用語集を作成します。
    -   `docs/04-appendix/01-asset-sources.md`: `docs/04-implementation-guide/00-setup.md` からアセット情報を分離・拡充します。

### フェーズ4: リンクの修正とクリーンアップ

1.  **内部リンクの修正:** ファイルの移動とリネームに伴い、ドキュメント間の内部リンクをすべて修正します。
2.  **旧ファイルの削除:** 統合・移動が完了した古いディレクトリとファイルを削除します。
3.  **READMEの更新:** `docs/README.md` を更新し、新しいドキュメント構造へのナビゲーションを提供します。
