#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/issue-core.sh"
source "$SCRIPT_DIR/lib/ai-execution-plan.sh"

# Usage
usage() {
    cat << EOF
Usage: $0 [options] <task_id>

Create high-quality GitHub issue with AI Agent execution plan.

Arguments:
    task_id     Task ID (e.g., P0-001, P1-042)

Options:
    --dry-run   Preview issue without creating
    --force     Skip confirmation
    --plan-only Generate execution plan only
    --help      Show help

Examples:
    $0 P0-001
    $0 --dry-run P1-042
    $0 --plan-only P2-015
EOF
}

# Parse arguments
DRY_RUN=false
FORCE=false
PLAN_ONLY=false
TASK_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --force) FORCE=true; shift ;;
        --plan-only) PLAN_ONLY=true; shift ;;
        --help) usage; exit 0 ;;
        P[0-8]-[0-9][0-9][0-9]) TASK_ID="$1"; shift ;;
        *) echo "❌ Unknown option: $1"; usage; exit 1 ;;
    esac
done

# Validate arguments
if [[ -z "$TASK_ID" ]]; then
    echo "❌ Task ID required"
    usage
    exit 1
fi

# Generate AI-optimized issue body
format_ai_issue() {
    local task_section="$1"
    local success_criteria implementation_files ai_instructions verification_commands

    success_criteria=$(get_success_criteria "$task_section")
    implementation_files=$(get_implementation_files "$task_section")
    ai_instructions=$(get_ai_instructions "$task_section")
    verification_commands=$(get_verification_commands "$task_section")

    cat << EOF
## 📌 タスク概要

**ID**: \`$TASK_ID\`  **サイズ**: \`$TASK_SIZE\` (${TASK_HOURS}h)  **タイプ**: \`$TASK_TYPE\`  **優先度**: \`$TASK_PRIORITY\`  **複雑度**: ${TASK_COMPLEXITY}/10

**目標**: $TASK_NAME

$(generate_ai_comprehensive_plan)

## 📁 実装ファイル

$(format_implementation_files "$implementation_files")

## ✅ 検証手順

\`\`\`bash
$verification_commands
\`\`\`

## 🎯 最終成功基準

$(format_success_criteria "$success_criteria")

---

## 📋 AI Agent向け完了チェック

### 🏗️ アーキテクチャ準拠
- [ ] Effect-TS 3.17+パターン使用 (Context.GenericTag)
- [ ] Schema.Struct全型定義
- [ ] クラス使用なし、純関数のみ
- [ ] var/let/any/async/await禁止遵守

### 🔧 実装品質
- [ ] TypeScript strictモード通過
- [ ] テストカバレッジ80%以上
- [ ] Lintエラーなし
- [ ] 60FPS維持、メモリ2GB以下

### 📚 ドキュメント・統合
- [ ] API仕様書更新
- [ ] 実装パターンドキュメント
- [ ] E2Eテスト通過
- [ ] CI/CD正常動作

**🚀 AI Agent: このプランに従って段階的に実装し、各Phase完了時に検証を実行してください！**
EOF
}

# Format implementation files (helper function)
format_implementation_files() {
    local files="$1"
    if [[ -n "$files" ]]; then
        echo "$files" | sed 's/^/- /'
    else
        echo "- ROADMAPの実装ファイル一覧を参照"
    fi
}

# Format success criteria (helper function)
format_success_criteria() {
    local criteria="$1"
    if [[ -n "$criteria" ]]; then
        echo "$criteria" | sed 's/^/- [ ] /'
    else
        echo "- [ ] 実装完了"
        echo "- [ ] テスト作成・実行"
        echo "- [ ] ドキュメント更新"
        echo "- [ ] 品質ゲート通過"
    fi
}

# Main execution
main() {
    log_info "Creating AI-optimized issue for $TASK_ID"

    # Check prerequisites
    check_prerequisites || exit 1

    # Parse task data
    parse_task "$TASK_ID" || exit 1
    log_success "Task data parsed: $TASK_NAME"

    # Get task section for formatting
    task_section=$(get_task_section "$TASK_ID")

    if [[ "$PLAN_ONLY" == true ]]; then
        echo "## 🤖 AI Agent 実行計画プレビュー"
        echo "Task: $TASK_NAME ($TASK_TYPE)"
        echo ""
        generate_ai_comprehensive_plan
        return 0
    fi

    # Format issue
    issue_body=$(format_ai_issue "$task_section")
    issue_title="[$TASK_ID] $TASK_NAME"
    labels=$(generate_labels)

    # Add AI-specific labels
    labels="$labels,ai-agent,execution-plan"

    # Show preview
    echo ""
    echo "📋 AI Issue Preview:"
    echo "Title: $issue_title"
    echo "Labels: $labels"
    echo ""

    if [[ "$DRY_RUN" == true ]]; then
        echo "--- Issue Body ---"
        echo "$issue_body"
        echo "--- End ---"
        log_info "Dry run completed"
        return 0
    fi

    # Confirmation
    if [[ "$FORCE" == false ]]; then
        echo "Create this AI-optimized issue? (y/n): "
        read -r response
        [[ "$response" =~ ^[Yy]$ ]] || { echo "Cancelled"; exit 0; }
    fi

    # Create issue
    log_info "Creating AI-optimized GitHub issue..."
    issue_url=$(gh issue create \
        --title "$issue_title" \
        --body "$issue_body" \
        --label "$labels")

    log_success "AI-optimized issue created: $issue_url"
    echo ""
    echo "🤖 AI Agent can now use this issue as an execution plan!"
}

main "$@"