---
name: test-run
description: テストの実行
arguments:
  optional:
    - name: type
      description: テストタイプ（unit/integration/e2e/all）
      default: all
    - name: watch
      description: ウォッチモード（true/false）
      default: false
---

# テスト実行コマンド

プロジェクトのテストを実行します。

## 使用方法

```bash
# 全テスト実行
claude "/test/run"

# ユニットテストのみ
claude "/test/run unit"

# ウォッチモード
claude "/test/run --watch"

# 短縮形
claude "テストを実行して"
```

## 実行スクリプト

```bash
#!/bin/bash
set -euo pipefail

TYPE="${1:-all}"
WATCH="${2:-false}"

echo "🧪 テスト実行を開始します（$TYPE）"

# テストタイプ別実行
case "$TYPE" in
    unit)
        echo "📦 ユニットテスト実行中..."
        if [ "$WATCH" = "true" ]; then
            pnpm test:unit --watch
        else
            pnpm test:unit
        fi
        ;;
    integration)
        echo "🔗 統合テスト実行中..."
        pnpm test:integration
        ;;
    e2e)
        echo "🌐 E2Eテスト実行中..."
        pnpm test:e2e
        ;;
    all|*)
        echo "🎯 全テスト実行中..."
        pnpm test
        ;;
esac

# カバレッジレポート
if [ "$WATCH" != "true" ]; then
    echo "📊 カバレッジレポート生成中..."
    pnpm test:coverage || true
fi

echo "✅ テスト完了！"
```

## テスト戦略

### ユニットテスト
- 個別関数・モジュールの検証
- Effect-TSパターンのテスト
- モック使用による独立性確保

### 統合テスト
- モジュール間連携の検証
- API統合テスト
- データフロー検証

### E2Eテスト
- ユーザーシナリオの検証
- ブラウザ自動化テスト
- パフォーマンステスト

## 関連コマンド

- [`/test/coverage`](coverage.md) - カバレッジ確認
- [`/build/dev`](../build/dev.md) - 開発ビルド
- [`/pr/create`](../pr/create.md) - PR作成