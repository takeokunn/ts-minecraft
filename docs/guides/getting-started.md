# はじめに

このガイドでは、ts-minecraftプロジェクトの環境セットアップから基本的な開発ワークフローまでを説明します。

## 前提条件

以下のツールがインストールされていることを確認してください：

- **Node.js**: v18.0.0以上（推奨：v20以上）
- **pnpm**: v8.0.0以上（パッケージマネージャー）
- **Git**: バージョン管理用

## 環境セットアップ

### 1. Node.jsのインストール

公式サイトまたはnvm（Node Version Manager）を使用してNode.jsをインストール：

```bash
# nvmを使用する場合
nvm install 20
nvm use 20
```

### 2. pnpmのインストール

```bash
# npmを使用してpnpmをグローバルインストール
npm install -g pnpm

# または、Homebrewを使用（macOS）
brew install pnpm
```

### 3. プロジェクトのクローン

```bash
git clone https://github.com/your-username/ts-minecraft.git
cd ts-minecraft
```

### 4. 依存関係のインストール

```bash
pnpm install
```

## 開発サーバーの起動

### 基本的な開発サーバー起動

```bash
# 開発サーバーを起動（ホットリロード有効）
pnpm dev
```

ブラウザで `http://localhost:5173` を開くと、アプリケーションが表示されます。

### Webアプリケーションエントリーポイント

プロジェクトには複数のエントリーポイントがあります：

- **メインエントリー**: `src/main.ts` - ゲームエンジン全体の初期化
- **Webアプリエントリー**: `src/presentation/web/main.ts` - Webブラウザ向けUI

## ビルドとテスト

### 型チェック

```bash
# TypeScriptの型チェックを実行
pnpm type-check
```

### テスト実行

```bash
# 全テストを実行
pnpm test

# カバレッジ付きテスト
pnpm test:coverage

# レイヤー別テスト実行
pnpm test:shared          # 共通ライブラリのテスト
pnpm test:infrastructure  # インフラストラクチャレイヤーのテスト
pnpm test:presentation    # プレゼンテーションレイヤーのテスト
```

### ビルド

```bash
# 本番用ビルド
pnpm build
```

### リンティングとフォーマット

```bash
# コードリンティング（oxlint使用）
pnpm lint

# リンティングエラーの自動修正
pnpm lint:fix

# コードフォーマット（Prettier + oxlint）
pnpm format

# フォーマットチェック
pnpm format:check
```

## 開発ワークフロー

### 1. 開発の開始

```bash
# 新しいfeatureブランチを作成
git checkout -b feature/your-feature-name

# 開発サーバーを起動
pnpm dev
```

### 2. コード品質チェック

開発中は以下のコマンドを定期的に実行：

```bash
# 型チェック
pnpm type-check

# リンティング
pnpm lint

# テスト実行
pnpm test
```

### 3. コミット前の最終確認

```bash
# 全体的な品質チェック
pnpm format && pnpm lint && pnpm type-check && pnpm test:all
```

### 4. 本番ビルドテスト

```bash
# 本番ビルドが正常に作成できることを確認
pnpm build
```

## プロジェクト構成

```
src/
├── main.ts                    # メインエントリーポイント
├── application/               # アプリケーション層
├── domain/                    # ドメイン層
├── infrastructure/            # インフラストラクチャ層
├── presentation/              # プレゼンテーション層
│   └── web/
│       └── main.ts           # Webアプリエントリーポイント
├── shared/                    # 共通ライブラリ
└── config/                    # 設定管理
```

## トラブルシューティング

### よくある問題

#### 1. pnpm installが失敗する

```bash
# キャッシュをクリア
pnpm store prune
pnpm install
```

#### 2. 型エラーが発生する

```bash
# TypeScriptの設定を確認
pnpm type-check

# node_modulesを再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 3. テストが失敗する

```bash
# 特定のテストファイルを実行
pnpm test path/to/test.test.ts

# Vitestのデバッグモード
pnpm test --reporter=verbose
```

## 次のステップ

環境が正常にセットアップできたら、以下のガイドも参照してください：

- [開発規約](./development-conventions.md) - コーディング規約とアーキテクチャの詳細
- [エントリーポイント解説](./entry-points.md) - アプリケーションの起動フローの理解
- [テスティングガイド](./testing-guide.md) - Effect-TSを使ったテスト作成方法
- [パフォーマンス最適化](./performance-optimization.md) - 最適化とプロファイリング