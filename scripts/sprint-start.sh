#!/bin/bash

# Sprint開始スクリプト
# Usage: ./scripts/sprint-start.sh <sprint_number>

set -e

SPRINT_NUMBER=$1

if [ -z "$SPRINT_NUMBER" ]; then
    echo "❌ Error: Sprint number required"
    echo "Usage: $0 <sprint_number>"
    exit 1
fi

echo "🚀 Starting Sprint $SPRINT_NUMBER"
echo "================================"

# ROADMAPからタスク抽出
echo "📋 Extracting tasks from ROADMAP..."
TASKS=$(grep -E "^#### P[0-9]+-" ROADMAP.md | grep -A 10 "Sprint $SPRINT_NUMBER" | grep -E "^#### P[0-9]+-" | head -10)

if [ -z "$TASKS" ]; then
    echo "❌ No tasks found for Sprint $SPRINT_NUMBER"
    exit 1
fi

# タスク数カウント
TASK_COUNT=$(echo "$TASKS" | wc -l | tr -d ' ')
echo "✅ Found $TASK_COUNT tasks"
echo ""

# タスク一覧表示
echo "📝 Task List:"
echo "-------------"
echo "$TASKS" | while IFS= read -r line; do
    TASK_ID=$(echo "$line" | grep -oE "P[0-9]+-[0-9]+")
    TASK_NAME=$(echo "$line" | sed 's/#### //' | sed "s/$TASK_ID: //" | sed 's/ ⭐️//')
    echo "  - [$TASK_ID] $TASK_NAME"
done

echo ""
echo "🎯 Sprint Goals:"
echo "----------------"

# Sprint目標設定
case $SPRINT_NUMBER in
    1)
        echo "  - プロジェクト基盤構築"
        echo "  - 開発環境セットアップ"
        echo "  - CI/CD基礎構築"
        ;;
    2)
        echo "  - Effect-TS設定完了"
        echo "  - 基本サービス実装"
        echo "  - テスト環境構築"
        ;;
    3|4)
        echo "  - ゲームループ実装"
        echo "  - シーン管理システム"
        echo "  - 基本レンダリング"
        ;;
    *)
        echo "  - ROADMAPに従った実装"
        ;;
esac

echo ""
echo "📊 Sprint Metrics:"
echo "-----------------"
echo "  Duration: 1 week"
echo "  Tasks: $TASK_COUNT"
echo "  Story Points: $(($TASK_COUNT * 3))"

# GitHub Project Board作成提案
echo ""
echo "🔗 Next Steps:"
echo "--------------"
echo "1. Create GitHub Project Board:"
echo "   gh project create \"Sprint $SPRINT_NUMBER\" --owner \$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | cut -d'/' -f1)"
echo ""
echo "2. Create Issues:"
echo "   ./scripts/create-sprint-issues.sh $SPRINT_NUMBER"
echo ""
echo "3. Start first task:"
echo "   ./scripts/create-issue.sh <task_id>"

echo ""
echo "✅ Sprint $SPRINT_NUMBER initialized successfully!"