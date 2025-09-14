#!/bin/bash

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase Issue自動作成スクリプト
# ROADMAP.mdからタスクを抽出して、ai-task.ymlテンプレートを使用してIssue作成
#
# 使用方法:
#   ./scripts/create-phase-issues.sh [PHASE_NUMBER]
#   DRY_RUN=true ./scripts/create-phase-issues.sh [PHASE_NUMBER]
#
# 必要条件:
#   - GitHub CLI (gh) がインストール・認証済み
#   - .github/ISSUE_TEMPLATE/ai-task.yml テンプレート
#   - ROADMAP.md にPhaseタスクが記載
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

#──────────────────────────────────────────────────────────────────────────────
# 定数定義
#──────────────────────────────────────────────────────────────────────────────

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 設定値
readonly PHASE="${1:-}"
readonly DRY_RUN="${DRY_RUN:-false}"
readonly ROADMAP_FILE="${PROJECT_ROOT}/ROADMAP.md"
readonly TEMPLATE_FILE="${PROJECT_ROOT}/.github/ISSUE_TEMPLATE/ai-task.yml"

# Issue設定
readonly DEFAULT_LABELS="ai-agent,task,execution-plan,auto-executable"
readonly DEFAULT_ASSIGNEE="@me"

#──────────────────────────────────────────────────────────────────────────────
# ユーティリティ関数
#──────────────────────────────────────────────────────────────────────────────

# カラー出力
print_info() {
    echo -e "\033[0;34m📋\033[0m $*"
}

print_success() {
    echo -e "\033[0;32m✅\033[0m $*"
}

print_warning() {
    echo -e "\033[0;33m⚠️\033[0m $*" >&2
}

print_error() {
    echo -e "\033[0;31m❌\033[0m $*" >&2
}

print_processing() {
    echo -e "\033[0;36m🔄\033[0m $*"
}

# 使用方法表示
show_usage() {
    cat << EOF
使用方法: $SCRIPT_NAME [PHASE_NUMBER]

ROADMAP.mdから指定されたPhaseのタスクを抽出し、GitHub Issueを自動作成します。

オプション:
  PHASE_NUMBER    作成するPhase番号 (0-9)
  DRY_RUN=true    実際のIssue作成をスキップ（テスト用）

例:
  $SCRIPT_NAME 0                  # Phase 0のIssueを作成
  DRY_RUN=true $SCRIPT_NAME 1     # Phase 1のIssueをDRY RUNモードで確認
EOF
    exit 0
}

# エラー処理
fail() {
    print_error "$1"
    exit 1
}

#──────────────────────────────────────────────────────────────────────────────
# メタデータ処理関数
#──────────────────────────────────────────────────────────────────────────────

# サイズから複雑度を判定
get_complexity() {
    local size="${1:-M}"

    case "${size^^}" in
        XS*) echo "1 - Very Simple (設定変更レベル)" ;;
        S*)  echo "2 - Simple (単純な関数実装)" ;;
        M*)  echo "5 - Medium (標準的な機能実装)" ;;
        L*)  echo "7 - Hard (アーキテクチャ変更)" ;;
        XL*) echo "9 - Expert (新技術・パターン導入)" ;;
        *)   echo "3 - Easy (基本的な機能実装)" ;;
    esac
}

# 複雑度からガイダンスレベルを判定
get_guidance_level() {
    local complexity="$1"

    case "$complexity" in
        "1 - Very Simple"*)
            echo "Minimal - 基本要件のみ" ;;
        "2 - Simple"*|"3 - Easy"*)
            echo "Standard - 通常レベルの指示" ;;
        "5 - Medium"*)
            echo "Detailed - 詳細な実装指示" ;;
        "7 - Hard"*|"9 - Expert"*)
            echo "Expert - 高度な技術指示と制約" ;;
        *)
            echo "Standard - 通常レベルの指示" ;;
    esac
}

# タスク名から機能名を抽出
extract_feature_name() {
    local task_name="$1"

    # 英単語を抽出して小文字化（最初の単語のみ）
    echo "$task_name" | \
        grep -oE '[A-Za-z]+' | \
        head -1 | \
        tr '[:upper:]' '[:lower:]' || echo "feature"
}

# メタデータ行から情報を抽出
parse_metadata() {
    local meta_line="$1"

    # デフォルト値
    local size="M"
    local type="feature"
    local priority="Medium"

    # メタデータ抽出（存在する場合）
    if [[ -n "$meta_line" ]]; then
        size="$(echo "$meta_line" | grep -oP 'サイズ\**: \K[^|]+' | xargs || echo "M")"
        type="$(echo "$meta_line" | grep -oP 'タイプ\**: \K[^|]+' | xargs || echo "feature")"
        priority="$(echo "$meta_line" | grep -oP '優先度\**: \K[^|]+' | xargs || echo "Medium")"
    fi

    echo "$size|$type|$priority"
}

#──────────────────────────────────────────────────────────────────────────────
# GitHub Issue作成
#──────────────────────────────────────────────────────────────────────────────

# Issue作成（テンプレート使用）
create_github_issue() {
    local task_id="$1"
    local task_name="$2"
    local complexity="$3"
    local guidance="$4"

    local title="[$task_id] $task_name"
    local labels="${DEFAULT_LABELS},phase-${PHASE}"

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY-RUN] Issue作成予定:"
        printf "  タイトル: %s\n" "$title"
        printf "  Task ID: %s\n" "$task_id"
        printf "  複雑度: %s\n" "$complexity"
        printf "  ガイダンス: %s\n" "$guidance"
        printf "  ラベル: %s\n\n" "$labels"
        return 0
    fi

    # GitHub CLI実行
    if gh issue create \
        --title "$title" \
        --template "ai-task.yml" \
        --field "task-id=$task_id" \
        --field "complexity=$complexity" \
        --field "ai-guidance=$guidance" \
        --label "$labels" \
        --assignee "$DEFAULT_ASSIGNEE" 2>/dev/null; then
        print_success "Issue作成完了: $task_id - $task_name"
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 1 ]]; then
            print_warning "Issue作成スキップ: $task_id (既存の可能性)"
        else
            print_error "Issue作成失敗: $task_id (エラーコード: $exit_code)"
        fi
        return 1
    fi
}

#──────────────────────────────────────────────────────────────────────────────
# タスク処理
#──────────────────────────────────────────────────────────────────────────────

# 単一タスクの処理
process_single_task() {
    local task_line="$1"
    local meta_line="$2"

    # タスクIDとタスク名を抽出（正規表現でマッチ）
    if [[ ! $task_line =~ ^####[[:space:]]+(P[0-9]+-[0-9]+):[[:space:]](.+) ]]; then
        return 1
    fi

    local task_id="${BASH_REMATCH[1]}"
    local task_name="${BASH_REMATCH[2]}"

    # ⭐️マークを削除（優先タスクマーカー）
    task_name="${task_name% ⭐️}"

    print_processing "処理中: $task_id - $task_name"

    # メタデータ解析
    local metadata
    metadata="$(parse_metadata "$meta_line")"
    IFS='|' read -r size type priority <<< "$metadata"

    # 複雑度とガイダンス判定
    local complexity
    complexity="$(get_complexity "$size")"
    local guidance
    guidance="$(get_guidance_level "$complexity")"

    # Issue作成
    create_github_issue "$task_id" "$task_name" "$complexity" "$guidance"
}

# Phaseのタスクを全て処理
process_phase_tasks() {
    local phase="$1"
    local task_count=0
    local success_count=0

    print_info "Phase $phase のタスクを検索中..."

    # ROADMAP.mdから該当Phaseのタスクを抽出して処理
    local in_task=false
    local task_line=""

    while IFS= read -r line; do
        # タスク行の検出
        if [[ $line =~ ^####[[:space:]]+P${phase}-[0-9]+ ]]; then
            # 前のタスクを処理（存在する場合）
            if [[ -n "$task_line" ]] && [[ "$in_task" == "true" ]]; then
                process_single_task "$task_line" ""
                [[ $? -eq 0 ]] && ((success_count++))
            fi

            task_line="$line"
            in_task=true
            ((task_count++))
        elif [[ "$in_task" == "true" ]] && [[ $line =~ ^\*\*サイズ\*\* ]]; then
            # メタデータ行を見つけたら、タスクを処理
            process_single_task "$task_line" "$line"
            [[ $? -eq 0 ]] && ((success_count++))
            in_task=false
            task_line=""
        elif [[ "$in_task" == "true" ]] && [[ $line =~ ^#### ]] && [[ ! $line =~ ^####[[:space:]]+P${phase}- ]]; then
            # 別のタスクセクションに入った場合、前のタスクを処理
            process_single_task "$task_line" ""
            [[ $? -eq 0 ]] && ((success_count++))
            in_task=false
            task_line=""
        fi
    done < "$ROADMAP_FILE"

    # 最後のタスクを処理（必要な場合）
    if [[ -n "$task_line" ]] && [[ "$in_task" == "true" ]]; then
        process_single_task "$task_line" ""
        [[ $? -eq 0 ]] && ((success_count++))
    fi

    # 結果サマリー
    if [[ $task_count -eq 0 ]]; then
        print_warning "Phase $phase のタスクが見つかりませんでした"
        return 1
    else
        print_success "Phase $phase の処理完了: ${success_count}/${task_count} 件成功"

        if [[ "$DRY_RUN" == "false" ]] && [[ $success_count -gt 0 ]]; then
            print_info "作成されたIssueを確認: gh issue list --label \"phase-${phase}\""
        fi
        return 0
    fi
}

#──────────────────────────────────────────────────────────────────────────────
# 検証関数
#──────────────────────────────────────────────────────────────────────────────

# 前提条件チェック
validate_prerequisites() {
    local has_error=false

    # GitHub CLI確認
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) がインストールされていません"
        print_info "インストール: https://cli.github.com/"
        has_error=true
    fi

    # GitHub認証確認
    if command -v gh &> /dev/null && ! gh auth status &> /dev/null; then
        print_error "GitHub CLIが認証されていません"
        print_info "実行: gh auth login"
        has_error=true
    fi

    # テンプレートファイル確認
    if [[ ! -f "$TEMPLATE_FILE" ]]; then
        print_error "Issueテンプレートが見つかりません: $TEMPLATE_FILE"
        print_info "ai-task.ymlテンプレートを配置してください"
        has_error=true
    fi

    # ROADMAPファイル確認
    if [[ ! -f "$ROADMAP_FILE" ]]; then
        print_error "ROADMAPファイルが見つかりません: $ROADMAP_FILE"
        has_error=true
    fi

    [[ "$has_error" == "true" ]] && return 1
    return 0
}

# 引数検証
validate_arguments() {
    # ヘルプオプション
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_usage
    fi

    # Phase番号チェック
    if [[ -z "$1" ]]; then
        print_error "Phase番号を指定してください"
        echo ""
        show_usage
    fi

    if ! [[ "$1" =~ ^[0-9]$ ]]; then
        print_error "Phase番号は0-9の数字である必要があります: $1"
        exit 1
    fi
}

#──────────────────────────────────────────────────────────────────────────────
# メイン処理
#──────────────────────────────────────────────────────────────────────────────

main() {
    # 引数検証
    validate_arguments "$@"

    print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_info "Phase $PHASE Issue作成スクリプト"
    print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # DRY_RUNモード通知
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY-RUNモード: 実際のIssue作成は行いません"
        echo ""
    fi

    # 前提条件チェック
    print_info "環境チェック中..."
    if ! validate_prerequisites; then
        fail "必要な環境が整っていません"
    fi
    print_success "環境チェック完了"
    echo ""

    # タスク処理実行
    process_phase_tasks "$PHASE"

    echo ""
    print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_info "処理完了"
    print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# エントリーポイント
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi