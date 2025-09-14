#!/bin/bash

# GitHub Issue作成スクリプト
# Usage: ./scripts/create-issue.sh <task_id>

set -e

TASK_ID=$1

if [ -z "$TASK_ID" ]; then
    echo "❌ Error: Task ID required"
    echo "Usage: $0 <task_id>"
    echo "Example: $0 P0-001"
    exit 1
fi

echo "📝 Creating Issue for task: $TASK_ID"
echo "====================================="

# ROADMAPからタスク情報抽出
TASK_INFO=$(grep -A 20 "#### $TASK_ID:" ROADMAP.md)

if [ -z "$TASK_INFO" ]; then
    echo "❌ Task $TASK_ID not found in ROADMAP.md"
    exit 1
fi

# タスク名抽出
TASK_NAME=$(echo "$TASK_INFO" | grep "^#### $TASK_ID:" | sed "s/#### $TASK_ID: //" | sed 's/ ⭐️//')

# サイズ抽出
SIZE=$(echo "$TASK_INFO" | grep "^\*\*サイズ\*\*:" | sed 's/.*サイズ\*\*: //' | cut -d' ' -f1)

# タイプ抽出
TYPE=$(echo "$TASK_INFO" | grep "^\*\*タイプ\*\*:" | sed 's/.*タイプ\*\*: //' | cut -d' ' -f1)

# 優先度抽出
PRIORITY=$(echo "$TASK_INFO" | grep "^\*\*優先度\*\*:" | sed 's/.*優先度\*\*: //' | cut -d' ' -f1)

# 依存関係抽出
DEPENDENCIES=$(echo "$TASK_INFO" | grep "^\*\*依存\*\*:" | sed 's/.*依存\*\*: //' || echo "なし")

echo "📋 Task Details:"
echo "  Name: $TASK_NAME"
echo "  Size: $SIZE"
echo "  Type: $TYPE"
echo "  Priority: $PRIORITY"
echo "  Dependencies: $DEPENDENCIES"

# Issue本文生成
ISSUE_BODY=$(cat <<EOF
## 📌 タスク概要

**ID**: \`$TASK_ID\`
**サイズ**: \`$SIZE\`
**タイプ**: \`$TYPE\`
**優先度**: \`$PRIORITY\`

$TASK_NAME の実装タスクです。

## 🎯 成功基準

$(echo "$TASK_INFO" | sed -n '/# 成功基準/,/^#[^#]/p' | grep "^- \[" || echo "- [ ] 実装完了
- [ ] テスト作成
- [ ] ドキュメント更新")

## 📁 実装ファイル

$(echo "$TASK_INFO" | sed -n '/# 実装ファイル/,/^#[^#]/p' | grep "^-" || echo "- ROADMAPを参照")

## 🔗 依存関係

- 依存タスク: $DEPENDENCIES

## 💻 AI Agent実装指示

\`\`\`
$(echo "$TASK_INFO" | sed -n '/# AI.*指示/,/^```/p' | grep -v "^#" | grep -v "^\`\`\`" || echo "ROADMAPの詳細を参照してください")
\`\`\`

## ✅ 検証方法

\`\`\`bash
$(echo "$TASK_INFO" | sed -n '/# 検証/,/^#[^#]/p' | grep -v "^#" || echo "pnpm test
pnpm typecheck
pnpm lint")
\`\`\`

## 📊 メトリクス

- 推定時間: $SIZE
- カバレッジ目標: 80%+
- パフォーマンス: 60FPS維持

---

**PR作成時のチェックリスト**:
- [ ] Effect-TSパターンに従っている
- [ ] Schema.Structで型定義している
- [ ] エラーハンドリングが適切
- [ ] テストカバレッジ80%以上
- [ ] TypeScript strictモード通過
- [ ] Lintエラーなし
- [ ] ドキュメント更新済み
EOF
)

# ラベル決定
LABELS="task"

case $SIZE in
    XS) LABELS="$LABELS,size/XS" ;;
    S) LABELS="$LABELS,size/S" ;;
    M) LABELS="$LABELS,size/M" ;;
    L) LABELS="$LABELS,size/L" ;;
    XL) LABELS="$LABELS,size/XL" ;;
esac

case $TYPE in
    setup) LABELS="$LABELS,type:setup" ;;
    config) LABELS="$LABELS,type:config" ;;
    service) LABELS="$LABELS,type:feature" ;;
    interface) LABELS="$LABELS,type:feature" ;;
    test) LABELS="$LABELS,type:test" ;;
    docs) LABELS="$LABELS,type:docs" ;;
    infrastructure) LABELS="$LABELS,type:infrastructure" ;;
esac

case $PRIORITY in
    Critical) LABELS="$LABELS,priority:critical" ;;
    High) LABELS="$LABELS,priority:high" ;;
    Medium) LABELS="$LABELS,priority:medium" ;;
    Low) LABELS="$LABELS,priority:low" ;;
esac

# Phase判定
PHASE=$(echo "$TASK_ID" | cut -d'-' -f1)
LABELS="$LABELS,phase:${PHASE#P}"

echo ""
echo "🏷️  Labels: $LABELS"

# GitHub CLI確認
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install: https://cli.github.com/"
    exit 1
fi

# Issue作成コマンド表示
echo ""
echo "📦 Creating Issue with GitHub CLI..."
echo ""
echo "Command:"
echo "gh issue create \\"
echo "  --title \"[$TASK_ID] $TASK_NAME\" \\"
echo "  --body \"$ISSUE_BODY\" \\"
echo "  --label \"$LABELS\""

# 確認プロンプト
echo ""
read -p "Create this issue? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh issue create \
        --title "[$TASK_ID] $TASK_NAME" \
        --body "$ISSUE_BODY" \
        --label "$LABELS"

    echo "✅ Issue created successfully!"
else
    echo "❌ Issue creation cancelled"
fi