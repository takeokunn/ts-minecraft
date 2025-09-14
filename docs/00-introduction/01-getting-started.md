---
title: "スタートガイド - 開発環境セットアップ"
description: "TypeScript Minecraft Clone開発環境の構築手順とワークフロー。Node.js、pnpmセットアップからコマンド実行まで完全ガイド。"
category: "introduction"
difficulty: "beginner"
tags: ["setup", "development-environment", "nodejs", "pnpm", "workflow"]
prerequisites: ["basic-terminal-knowledge"]
estimated_reading_time: "12分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# スタートガイド

このガイドでは、TypeScript Minecraft Cloneプロジェクトの開発環境をセットアップし、基本的な開発ワークフローを開始するまでの手順を説明します。

## 1. 前提条件

開発を始める前に、以下のツールがシステムにインストールされていることを確認してください。

### 必須環境
- **Node.js**: `v20.0.0` 以上 (LTS版を推奨)
- **pnpm**: `v9.0.0` 以上 (最新版を推奨)
- **Git**: `v2.30.0` 以上

## 2. セットアップ手順

### ステップ1: リポジトリのクローン
まず、プロジェクトのソースコードをローカルマシンにクローンします。

```bash
# SSH (推奨)
git clone git@github.com:takeokunn/ts-minecraft.git

# HTTPS
# git clone https://github.com/takeokunn/ts-minecraft.git

cd ts-minecraft
```

### ステップ2: 依存関係のインストール
`pnpm` を使って、プロジェクトに必要なライブラリをインストールします。

```bash
pnpm install
```
このコマンドは、`node_modules`に必要なパッケージをインストールし、Gitのpre-commitフックを設定します。

### ステップ3: 環境変数の設定
プロジェクトルートにある環境変数のサンプルファイル (`.env.example`) をコピーして、ローカル用の設定ファイル (`.env.local`) を作成します。

```bash
cp .env.example .env.local
```
必要に応じて `.env.local` ファイルを編集し、開発設定をカスタマイズしてください。

```env
# .env.local の設定例
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_RENDER_DISTANCE=8
VITE_ENABLE_WEBGPU=false
```

## 3. 主要な開発コマンド

プロジェクトの操作には、以下の `pnpm` スクリプトを使用します。

| コマンド | 説明 |
|:---|:---|
| `pnpm dev` | 開発サーバーを起動します。ホットリロードが有効です。 |
| `pnpm test` | ユニットテストを実行します。 |
| `pnpm type-check` | TypeScriptの型チェックを実行します。 |
| `pnpm lint` | ESLintによる静的コード解析を実行します。 |
| `pnpm format` | Prettierによるコードフォーマットを適用します。 |
| `pnpm build` | 本番環境向けのビルドを生成します。 |

### 開発サーバーの起動
以下のコマンドで開発サーバーを起動し、ブラウザで `http://localhost:5173` を開いてください。

```bash
pnpm dev
```

## 5. 基本的な開発フロー

1. **ブランチの作成**: `feature/my-new-feature` のような名前で新しいブランチを作成します。
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. **コードの実装**: 機能追加やバグ修正を行います。
3. **テストの作成**: 必要に応じて、新しいテストケースを追加または更新します。
4. **検証**: 型チェック、リンティング、テストをパスすることを確認します。
   ```bash
   pnpm type-check
   pnpm lint
   pnpm test
   ```
5. **コミット**: 変更内容をコミットします。pre-commitフックが自動で検証を実行します。
   ```bash
   git commit -m "feat: 新機能を追加"
   ```
6. **プルリクエストの作成**: GitHub上でプルリクエストを作成し、レビューを依頼します。

## 6. トラブルシューティング

### 依存関係のインストールで問題が発生した場合
キャッシュをクリアし、`node_modules` を削除してから再インストールを試してください。

```bash
# node_modulesを削除してクリーンインストール
rm -rf node_modules
pnpm install --force

# または、pnpmストアのキャッシュもクリアする場合
pnpm store prune
rm -rf node_modules
pnpm install
```

### TypeScriptの型エラーが発生した場合
お使いのエディタでTypeScriptサーバーを再起動してみてください。多くのエディタでは、コマンドパレットから「TypeScript: Restart TS Server」や類似のコマンドを実行できます。

## 7. 次のステップ

セットアップが完了したら、以下のドキュメントを読むことをお勧めします。

- [**プロジェクト概要**](./00-project-overview.md): プロジェクト全体の目標とアーキテクチャについて。
- [**開発規約**](../03-guides/00-development-conventions.md): コーディングスタイルや設計パターンについて。
- [**アーキテクチャ設計**](../01-architecture/README.md): システムの構造に関する詳細な説明。
