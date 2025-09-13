# TypeScript Minecraft

A modern, functional TypeScript implementation of a Minecraft-like 3D sandbox game, built with Domain-Driven Design (DDD), Entity Component System (ECS), and Effect-TS functional programming patterns.

## 概要

このプロジェクトは、TypeScriptとEffect-TSを用いてMinecraftライクな3Dサンドボックスゲームを構築する実験的プロジェクトです。純粋関数型プログラミング、DDDアーキテクチャ、そして高性能なECSパターンを統合し、保守性と拡張性に優れたゲームエンジンの実装を目指しています。

## 主要な特徴

- **🎯 純粋関数型プログラミング**: Effect-TSを用いた副作用の安全な管理
- **🏗️ Domain-Driven Design**: 4層アーキテクチャによる明確な責務分離
- **⚡ 高性能ECS**: Structure of Arrays (SoA)による最適化されたコンポーネントシステム
- **🔧 型安全性**: 厳格なTypeScript設定と@effect/schemaによる実行時バリデーション
- **🧪 テスト駆動開発**: Effect-TSベースの包括的なテストスイート

## 技術スタック

### コアフレームワーク
- **[Effect-TS](https://effect.website/)** - 関数型プログラミングエコシステム
- **[TypeScript](https://www.typescriptlang.org/)** - 型安全性とコンパイル時チェック
- **[@effect/schema](https://github.com/Effect-TS/schema)** - スキーマ定義と実行時バリデーション

### 3Dレンダリング
- **[Three.js](https://threejs.org/)** - WebGL 3Dレンダリングエンジン
- **WebGPU** - 次世代GPU API（実験的サポート）

### ビルドツール・開発環境
- **[Vite](https://vitejs.dev/)** - 高速バンドラー
- **[Vitest](https://vitest.dev/)** - テストランナー
- **[Oxlint](https://github.com/oxc-project/oxc)** - 高速リンター
- **[Prettier](https://prettier.io/)** - コードフォーマッター
- **[pnpm](https://pnpm.io/)** - パッケージマネージャー

### その他のライブラリ
- **simplex-noise** - プロシージャル地形生成
- **alea** - シード可能な乱数生成器
- **stats.js** - パフォーマンス監視
- **uuid** - ユニークID生成

## アーキテクチャ概要

本プロジェクトは **DDD (Domain-Driven Design) + ECS (Entity Component System) + Effect-TS** の統合モデルを採用しています。

### 4層アーキテクチャ

```
┌─────────────────────────────┐
│     Presentation Layer      │  ← ユーザーインターフェース
│  (Controllers, Views, CLI)  │
├─────────────────────────────┤
│     Application Layer       │  ← ユースケース・ワークフロー
│   (Use Cases, Workflows)    │
├─────────────────────────────┤
│       Domain Layer          │  ← ビジネスロジック・ルール
│ (Entities, Services, Ports) │
├─────────────────────────────┤
│    Infrastructure Layer     │  ← 技術的実装・外部システム
│  (Adapters, Repositories)   │
└─────────────────────────────┘
```

### 設計原則

1. **関数型ファースト**: `class`構文や`this`キーワードを使用しない純粋関数型設計
2. **不変性**: すべてのデータ構造をimmutableとして扱う
3. **Effect系統合**: すべての操作をEffect型でラップし、合成可能なプログラムを構築
4. **依存性注入**: Effect-TSのLayerシステムによる型安全なDI
5. **エラーハンドリング**: タグ付きエラーシステムによる明示的なエラー管理

## ディレクトリ構造

```
ts-minecraft/
├── src/
│   ├── domain/           # ドメインレイヤー
│   │   ├── entities/     # エンティティとコンポーネント
│   │   ├── value-objects/# 値オブジェクト
│   │   ├── services/     # ドメインサービス
│   │   └── ports/        # ポート（インターフェース）
│   ├── application/      # アプリケーションレイヤー
│   │   ├── use-cases/    # ユースケース
│   │   ├── workflows/    # ワークフロー
│   │   └── queries/      # ECSクエリシステム
│   ├── infrastructure/   # インフラストラクチャレイヤー
│   │   ├── adapters/     # アダプター実装
│   │   ├── repositories/ # リポジトリ実装
│   │   └── workers/      # Web Worker実装
│   ├── presentation/     # プレゼンテーションレイヤー
│   │   ├── controllers/  # コントローラー
│   │   ├── view-models/  # ビューモデル
│   │   └── cli/          # CLI開発者ツール
│   ├── config/           # 設定管理
│   └── shared/           # 共通ユーティリティ
├── docs/                 # ドキュメント
│   ├── architecture/     # アーキテクチャガイド
│   ├── guides/          # 開発ガイド
│   ├── features/        # 機能説明
│   └── layers/          # レイヤー別ドキュメント
└── tests/               # テストファイル
```

## クイックスタート

### 前提条件

- Node.js 18+ 
- pnpm 8+

### インストールと起動

```bash
# リポジトリをクローン
git clone https://github.com/takeokunn/ts-minecraft.git
cd ts-minecraft

# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm dev

# ブラウザで http://localhost:5173 にアクセス
```

### 開発用コマンド

```bash
# 型チェック
pnpm type-check

# テスト実行
pnpm test

# レイヤー別テスト
pnpm test:shared
pnpm test:infrastructure  
pnpm test:presentation

# カバレッジ付きテスト
pnpm test:coverage

# リント・フォーマット
pnpm lint
pnpm format

# プロダクションビルド
pnpm build
```

## ドキュメント

### アーキテクチャガイド

- [アーキテクチャ概要](./architecture/overview.md) - 全体設計と統合パターン
- [DDD実装原則](./architecture/ddd-principles.md) - Domain-Driven Designの適用方法
- [ECS統合](./architecture/ecs-integration.md) - Entity Component Systemとの統合
- [Effect-TSパターン](./architecture/effect-patterns.md) - 関数型プログラミングパターン

### 開発ガイド

- [開発入門](./guides/getting-started.md) - プロジェクトのセットアップと開発開始
- [開発規約](./guides/development-conventions.md) - コーディング規約とベストプラクティス
- [TypeScriptエラー解決](./guides/typescript-error-resolution.md) - コンパイルエラーの解決方法
- [テストガイド](./guides/testing-guide.md) - テスト戦略と実装方法
- [パフォーマンス最適化](./guides/performance-optimization.md) - 最適化手法とツール

### レイヤー別ドキュメント

- [Domain Layer](./layers/domain.md) - ドメインロジックの実装
- [Application Layer](./layers/application.md) - ユースケースとワークフロー
- [Infrastructure Layer](./layers/infrastructure.md) - 技術的実装とアダプター
- [Presentation Layer](./layers/presentation.md) - UIとコントローラー
- [Shared Layer](./layers/shared.md) - 共通ユーティリティ

### 機能説明

- [ECSシステム](./features/ecs-system.md) - Entity Component Systemの実装
- [ワールドシステム](./features/world-system.md) - ワールド生成と管理
- [物理エンジン](./features/physics-engine.md) - 衝突判定と物理シミュレーション
- [レンダリングパイプライン](./features/rendering-pipeline.md) - 3D描画システム
- [プレイヤー操作](./features/player-controls.md) - 入力処理と操作系

## 開発状況

### Phase 3 マイグレーション完了 ✅

- **95%関数型プログラミング化**: クラスベースパターンをほぼ完全に排除
- **レイヤー分離**: 厳格なDDD境界と依存性逆転の実現
- **統一クエリシステム**: 3つのシステムを1つに統合・最適化
- **パスエイリアス標準化**: 100%絶対インポートパスを採用
- **Effect-TS統合**: 包括的な型システムとタグ付きエラー
- **デッドコード削除**: 1,000行以上の未使用コードを削除

### 現在の指標

```typescript
クラス削除: 126 → ~15 (88%削減) 🎯
Effect-TS カバレッジ: ~30% → ~95% (317%向上) 🎯
クエリシステム: 3 → 1 (統合完了) ✅
デッドコード: 1,000+行 → 0行 ✅
パスエイリアス: 0% → 100% ✅
テストカバレッジ: ~5% → ~60% (1200%向上) 🎯
```

### Phase 4 目標（進行中）

- **TypeScriptエラー解決**: 残り約25個のコンパイルエラーを解決
- **完全関数型移行**: 残り約15個のクラスを排除
- **100% Effect-TS**: 残りのPromiseベースAPIを変換
- **テスト拡充**: 80%以上のテストカバレッジを達成

## 貢献

このプロジェクトは実験的なアーキテクチャの探求を目的としています。Issue報告やプルリクエストを歓迎します。

### 開発原則

- Effect-TSパターンの厳守
- 関数型プログラミングの原則に従う
- テストファーストアプローチ
- DDDの境界を尊重する
- パフォーマンスを意識した実装

## ライセンス

MIT License