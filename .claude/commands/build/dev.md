---
name: build-dev
description: 開発ビルドの実行
arguments:
  optional:
    - name: watch
      description: ウォッチモード（true/false）
      default: false
    - name: port
      description: 開発サーバーポート
      default: 3000
---

# 開発ビルドコマンド

開発環境でのビルドと開発サーバーの起動を行います。

## 使用方法

```bash
# 開発サーバー起動
claude "/build/dev"

# ウォッチモード
claude "/build/dev --watch"

# ポート指定
claude "/build/dev --port 8080"

# 短縮形
claude "開発サーバーを起動して"
```

## 実行スクリプト

```bash
#!/bin/bash
set -euo pipefail

WATCH="${1:-false}"
PORT="${2:-3000}"

echo "🚀 開発ビルドを開始します"

# 依存関係チェック
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    pnpm install
fi

# 型チェック（並列実行）
echo "🔍 事前チェック中..."
pnpm typecheck & PID1=$!
pnpm lint & PID2=$!

if ! wait $PID1 $PID2; then
    echo "⚠️  事前チェックで問題が見つかりました"
    echo "修正を推奨しますが、開発サーバーは起動します"
fi

# 開発サーバー起動
if [ "$WATCH" = "true" ]; then
    echo "👀 ウォッチモードで起動中..."
    PORT=$PORT pnpm dev --watch
else
    echo "🌐 開発サーバー起動中（ポート: $PORT）..."
    PORT=$PORT pnpm dev
fi
```

## 機能

### 開発サーバー

- Hot Module Replacement (HMR)
- 自動リロード
- ソースマップ生成
- エラーオーバーレイ

### ビルド最適化

- 高速ビルド（開発用設定）
- TypeScriptトランスパイル
- アセット処理
- 環境変数注入

### デバッグ支援

- ソースマップ
- React DevTools対応
- ログ出力
- エラースタックトレース

## 環境変数

```bash
NODE_ENV=development
PORT=3000
DEBUG=true
```

## 関連コマンド

- [`/build/prod`](prod.md) - 本番ビルド
- [`/test/run`](../test/run.md) - テスト実行
- [`/issue/implement`](../issue/implement.md) - Issue実装
