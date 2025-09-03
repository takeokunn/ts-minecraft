# ts-minecraft

[![CI](https://github.com/takeokunn/ts-minecraft/actions/workflows/ci.yml/badge.svg)](https://github.com/takeokunn/ts-minecraft/actions/workflows/ci.yml)

**ts-minecraft** は、TypeScript、[Effect-TS](https://effect.website/)、[Three.js](https://threejs.org/) を用いて構築されたMinecraftライクなボクセルエンジンです。

このプロジェクトは単なるクローンではなく、関数型プログラミングとデータ指向設計（ECS/SoA）の原則をWebゲーム開発に適用するための、モダンなアーキテクチャの探求と実践の場です。

# ts-minecraft

[![CI](https://github.com/takeokunn/ts-minecraft/actions/workflows/ci.yml/badge.svg)](https://github.com/takeokunn/ts-minecraft/actions/workflows/ci.yml)

**ts-minecraft** は、TypeScript、[Effect](https://effect.website/)、[Three.js](https://threejs.org/) を用いて構築されたMinecraftライクなボクセルエンジンです。

このプロジェクトは単なるクローンではなく、関数型プログラミングとデータ指向設計（ECS/SoA）の原則をWebゲーム開発に適用するための、モダンなアーキテクチャの探求と実践の場です。

## 🎮 プレイグラウンド

最新版はGitHub Pagesで公開されています。

**[https://minecraft.takeokunn.org/](https://minecraft.takeokunn.org/)**

## ✨ 主な特徴

- **関数型プログラミング**: 副作用管理、依存性注入、構造化された並行処理など、アプリケーションのあらゆる側面を [Effect](https.effect.website/) で制御。
- **データ指向設計**: パフォーマンスを最大化するため、ArchetypeベースのECSとStructure of Arrays (SoA) を採用。GC負荷を最小限に抑えます。
- **宣言的なシステムスケジューラ**: システム間の依存関係を定義するだけで、実行順序を自動的に解決。
- **Web Workerによる並行処理**: 負荷の高い地形生成とメッシュ生成をメインスレッドから完全に分離し、スムーズなフレームレートを維持。

最新版はGitHub Pagesで公開されています。

**[https://minecraft.takeokunn.org/](https://minecraft.takeokunn.org/)**

## ✨ 主な特徴

- **関数型プログラミング**: 副作用管理、依存性注入、構造化された並行処理など、アプリケーションのあらゆる側面を [Effect-TS](https://effect.website/) で制御。
- **データ指向設計**: パフォーマンスを最大化するため、ArchetypeベースのECSとStructure of Arrays (SoA) を採用。GC負荷を最小限に抑えます。
- **宣言的なシステムスケジューラ**: システム間の依存関係を定義するだけで、実行順序を自動的に解決。
- **Web Workerによる並行処理**: 負荷の高い地形生成とメッシュ生成をメインスレッドから完全に分離し、スムーズなフレームレートを維持。
- **型安全なデータモデリング**: `effect/Schema` を用いてコンポーネントやセーブデータを定義し、静的・動的な一貫性を保証。
- **無限のワールド生成**: Simplex Noiseを用いたプロシージャルな地形生成。
- **基本的なゲーム機能**: ブロックの設置/破壊、物理演算と衝突検知、セーブ＆ロード機能など。

## 🛠️ 使用技術

- **言語**: TypeScript
- **コアアーキテクチャ**: Effect
- **レンダリング**: Three.js
- **ビルドツール**: Vite
- **テスティング**: @effect/vitest
- **リンター**: Oxlint
- **フォーマッタ**: Prettier, Oxlint

## 🚀 開発を始めるには

### 1. 前提条件

- [Node.js](https://nodejs.org/) (v18.x or later)
- [pnpm](https://pnpm.io/)

### 2. インストールと起動

```bash
# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm dev
```

### 3. 主要なスクリプト

| スクリプト    | 説明                                                 |
| :------------ | :--------------------------------------------------- |
| `pnpm dev`    | 開発サーバーを起動します。                           |
| `pnpm build`  | 本番用にプロジェクトをビルドします。                 |
| `pnpm test`   | Vitestですべてのテストを実行します。                 |
| `pnpm lint`   | Oxlintで静的解析を実行します。                       |
| `pnpm format` | PrettierとOxlintでコードをフォーマット・修正します。 |

## 📂 プロジェクト構造

ソースコードは `src/` ディレクトリにあり、責務に応じて明確に分割されています。

- `src/domain/`: ゲームの核となるデータ構造（コンポーネント、エンティティ、アーキタイプ）。
- `src/runtime/`: ゲームの実行環境（World、ゲームループ、各種サービス）。
- `src/systems/`: ゲームロジック（ECSのシステム）。
- `src/infrastructure/`: 外部API（Three.js, ブラウザAPI）との境界。

詳細については [ディレクトリ構成ドキュメント](./docs/architecture/directory-structure.md) を参照してください。

## 📚 ドキュメント

プロジェクトのアーキテクチャ、設計思想、規約、各機能の詳細については、[`docs/`](./docs/README.md) ディレクトリを参照してください。

## 🙌 貢献

バグ報告、機能提案、プルリクエストを歓迎します。貢献する際は、以下のドキュメントを一読してください。

- [プロジェクト規約](./docs/project/conventions.md)
- [ブランチ戦略](./docs/project/branch-strategy.md)

## 📄 ライセンス

[MIT](./LICENSE)
