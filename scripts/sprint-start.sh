#!/bin/bash

# Sprint開始スクリプト - TypeScript Minecraft Clone
# Usage: ./scripts/sprint-start.sh <sprint_number>

set -e

# 設定
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ROADMAP_FILE="$PROJECT_ROOT/ROADMAP.md"

# 色付きメッセージ関数
print_success() { echo -e "\033[32m✅ $1\033[0m"; }
print_error() { echo -e "\033[31m❌ $1\033[0m"; }
print_info() { echo -e "\033[34mℹ️ $1\033[0m"; }
print_warning() { echo -e "\033[33m⚠️ $1\033[0m"; }

# 引数チェック
validate_input() {
    local sprint_number="$1"

    if [ -z "$sprint_number" ]; then
        print_error "Sprint number required"
        echo "Usage: $0 <sprint_number>"
        echo "Example: $0 1"
        exit 1
    fi

    if ! [[ "$sprint_number" =~ ^[0-9]+$ ]]; then
        print_error "Sprint number must be a positive integer"
        exit 1
    fi

    if [ ! -f "$ROADMAP_FILE" ]; then
        print_error "ROADMAP.md not found at $ROADMAP_FILE"
        exit 1
    fi
}

# Sprintセクションを検索
find_sprint_section() {
    local sprint_number="$1"
    local section_pattern

    # パターン1: Sprint X (Week Y)
    section_pattern="^### Sprint $sprint_number \\(Week [0-9]+\\):"
    local section_line=$(grep -n -E "$section_pattern" "$ROADMAP_FILE" | head -1 | cut -d: -f1)

    if [ -n "$section_line" ]; then
        echo "$section_line"
        return 0
    fi

    # パターン2: Sprint X-Y (Week X-Y) で指定されたスプリント番号が範囲に含まれる
    while IFS= read -r line; do
        if [ -z "$line" ]; then continue; fi

        local line_num=$(echo "$line" | cut -d: -f1)
        # シンプルなパターンに変更
        local start_sprint=$(echo "$line" | sed -n 's/^.*Sprint \([0-9]\+\)-[0-9]\+.*/\1/p')
        local end_sprint=$(echo "$line" | sed -n 's/^.*Sprint [0-9]\+-\([0-9]\+\).*/\1/p')

        if [ -n "$start_sprint" ] && [ -n "$end_sprint" ]; then
            if [ "$sprint_number" -ge "$start_sprint" ] && [ "$sprint_number" -le "$end_sprint" ]; then
                echo "$line_num"
                return 0
            fi
        fi
    done < <(grep -n -E "^### Sprint [0-9]+-[0-9]+ \\(" "$ROADMAP_FILE")

    return 1
}

# セクション終了位置を取得
get_section_end() {
    local start_line="$1"
    local next_sprint_line=$(grep -n "^### Sprint" "$ROADMAP_FILE" | \
        awk -F: -v start="$start_line" '$1 > start {print $1; exit}')

    if [ -n "$next_sprint_line" ]; then
        echo "$((next_sprint_line - 1))"
    else
        wc -l < "$ROADMAP_FILE"
    fi
}

# タスクを抽出
extract_tasks() {
    local start_line="$1"
    local end_line="$2"

    sed -n "${start_line},${end_line}p" "$ROADMAP_FILE" | \
        grep "^#### P[0-9]\\+-[0-9]\\+:" | \
        sed 's/^#### //'
}

# タスク情報を解析
parse_task_info() {
    local task_line="$1"
    local task_id=$(echo "$task_line" | grep -oE "P[0-9]+-[0-9]+")
    local task_name=$(echo "$task_line" | sed "s/$task_id: //" | sed 's/ ⭐️.*//')
    local is_priority=$(echo "$task_line" | grep -q "⭐️" && echo "true" || echo "false")

    echo "$task_id|$task_name|$is_priority"
}

# Sprint目標を動的に抽出
extract_sprint_goals() {
    local start_line="$1"
    local end_line="$2"

    # セクションの最初の段落から目標を推測
    local section_content=$(sed -n "${start_line},${end_line}p" "$ROADMAP_FILE")
    local section_title=$(echo "$section_content" | head -1 | sed 's/^### Sprint [0-9-]* ([^)]*): //')

    echo "  - $section_title"

    # 優先タスクから目標を抽出
    local priority_tasks=$(echo "$section_content" | grep "#### P[0-9]\\+-[0-9]\\+:.*⭐️" | head -3)
    while IFS= read -r task; do
        if [ -n "$task" ]; then
            local goal=$(echo "$task" | sed 's/^#### P[0-9]\\+-[0-9]\\+: //' | sed 's/ ⭐️.*//')
            echo "  - $goal"
        fi
    done <<< "$priority_tasks"
}

# メイン処理
main() {
    local sprint_number="$1"

    validate_input "$sprint_number"

    echo "🚀 TypeScript Minecraft Clone - Sprint $sprint_number"
    echo "================================================="
    echo ""

    print_info "Searching for Sprint $sprint_number in ROADMAP..."

    local section_start
    if ! section_start=$(find_sprint_section "$sprint_number"); then
        print_error "Sprint $sprint_number section not found in ROADMAP.md"
        print_info "Available sprints:"
        grep "^### Sprint" "$ROADMAP_FILE" | sed 's/^### /  - /'
        exit 1
    fi

    local section_end=$(get_section_end "$section_start")
    print_success "Found Sprint $sprint_number section (lines $section_start-$section_end)"

    local tasks=$(extract_tasks "$section_start" "$section_end")
    if [ -z "$tasks" ]; then
        print_error "No tasks found for Sprint $sprint_number"
        exit 1
    fi

    local task_count=$(echo "$tasks" | wc -l | tr -d ' ')
    local priority_count=0
    if [ -n "$(echo "$tasks" | grep "⭐️")" ]; then
        priority_count=$(echo "$tasks" | grep -c "⭐️")
    fi

    print_success "Found $task_count tasks ($priority_count priority)"
    echo ""

    # タスク一覧表示
    echo "📝 Task List:"
    echo "-------------"
    local task_num=1
    while IFS= read -r task; do
        if [ -n "$task" ]; then
            local task_info=$(parse_task_info "$task")
            local task_id=$(echo "$task_info" | cut -d'|' -f1)
            local task_name=$(echo "$task_info" | cut -d'|' -f2)
            local is_priority=$(echo "$task_info" | cut -d'|' -f3)

            local priority_mark=""
            [ "$is_priority" = "true" ] && priority_mark=" ⭐️"

            printf "  %2d. [%s] %s%s\n" "$task_num" "$task_id" "$task_name" "$priority_mark"
            task_num=$((task_num + 1))
        fi
    done <<< "$tasks"

    echo ""
    echo "🎯 Sprint Goals:"
    echo "----------------"
    extract_sprint_goals "$section_start" "$section_end"

    echo ""
    echo "📊 Sprint Metrics:"
    echo "-----------------"
    echo "  Duration: 1 week"
    echo "  Total Tasks: $task_count"
    echo "  Priority Tasks: $priority_count"
    echo "  Estimated Story Points: $((task_count * 3))"

    echo ""
    echo "🔗 Next Steps:"
    echo "--------------"
    echo "1. Create GitHub Issues:"
    echo "   ./scripts/create-issues.sh $sprint_number"
    echo ""
    echo "2. Start Development:"
    echo "   git checkout -b sprint-$sprint_number"
    echo ""
    echo "3. Track Progress:"
    echo "   gh issue list --milestone \"Sprint $sprint_number\""

    echo ""
    print_success "Sprint $sprint_number initialized successfully!"

    # 警告表示
    if [ "$priority_count" -gt 0 ] && [ "$priority_count" -gt 5 ]; then
        print_warning "High priority task count ($priority_count). Consider splitting the sprint."
    fi
}

main "$@"