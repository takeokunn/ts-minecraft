#!/bin/bash

# Sprint全体のIssue一括作成スクリプト
# Usage: ./scripts/create-sprint-issues.sh <sprint_number>

set -e

SPRINT_NUMBER=$1

if [ -z "$SPRINT_NUMBER" ]; then
    echo "❌ Error: Sprint number required"
    echo "Usage: $0 <sprint_number>"
    exit 1
fi

echo "🚀 Creating Issues for Sprint $SPRINT_NUMBER"
echo "========================================"

# Sprint関連タスクを抽出
echo "📋 Finding tasks for Sprint $SPRINT_NUMBER..."

# Sprint関連タスクを動的に抽出
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/sprint-start.sh"

# sprint-start.shの関数を使用してタスクを抽出
section_start=$(find_sprint_section "$SPRINT_NUMBER") || {
    echo "❌ Sprint $SPRINT_NUMBER not found in ROADMAP.md"
    exit 1
}

section_end=$(get_section_end "$section_start")
TASKS=$(extract_tasks "$section_start" "$section_end" | sed 's/:.*$//' | sed 's/^#### //')

if [ -z "$TASKS" ]; then
    echo "❌ No tasks found for Sprint $SPRINT_NUMBER"
    exit 1
fi

# タスク数確認
TASK_COUNT=$(echo "$TASKS" | wc -l | tr -d ' ')
echo "✅ Found $TASK_COUNT tasks"
echo ""

# タスク一覧表示
echo "📝 Tasks to create:"
echo "-------------------"
echo "$TASKS" | while IFS= read -r task_id; do
    echo "  - $task_id"
done

echo ""
echo "⚠️  This will create $TASK_COUNT issues on GitHub"
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# 各タスクのIssue作成
CREATED=0
FAILED=0

echo ""
echo "🔄 Creating Issues..."
echo "--------------------"

echo "$TASKS" | while IFS= read -r task_id; do
    echo -n "Creating $task_id... "

    # create-issue.shを非対話モードで実行
    if ISSUE_URL=$(./scripts/create-issue.sh --force "$task_id" 2>/dev/null); then
        echo "✅ Created: $ISSUE_URL"
        ((CREATED++))
    else
        echo "❌ Failed"
        ((FAILED++))
    fi

    # GitHub APIレート制限対策
    sleep 2
done

echo ""
echo "📊 Summary:"
echo "-----------"
echo "  ✅ Created: $CREATED issues"
if [ $FAILED -gt 0 ]; then
    echo "  ❌ Failed: $FAILED issues"
fi

echo ""
echo "🎯 Next Steps:"
echo "--------------"
echo "1. Review issues at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/issues"
echo "2. Add to project board: gh project item-add <project-number> --owner <owner> --url <issue-url>"
echo "3. Start implementation: git checkout -b feat/<task-id>"

echo ""
echo "✅ Sprint $SPRINT_NUMBER issue creation complete!"