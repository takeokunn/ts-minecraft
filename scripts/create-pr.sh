#!/bin/bash

# =============================================================================
# PR自動作成スクリプト
#
# 使用方法:
#   scripts/create-pr.sh <issue_number> [オプション]
#
# 例:
#   scripts/create-pr.sh 123
#   scripts/create-pr.sh 123 --draft
#   scripts/create-pr.sh 123 --no-checks
#
# 機能:
#   - GitHub Issueから情報自動取得
#   - ブランチ自動作成・切り替え
#   - 品質チェック（並列実行）
#   - コミット作成
#   - PR作成（テンプレート使用）
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"

# デフォルト設定
readonly DEFAULT_BRANCH_PREFIX="feat"
readonly TEMPLATE_PATH=".github/pull_request_template.md"

# -----------------------------------------------------------------------------
# ライブラリ読み込み
# -----------------------------------------------------------------------------

load_library() {
    local lib_name="$1"
    local lib_path="${LIB_DIR}/${lib_name}.sh"

    if [ ! -f "$lib_path" ]; then
        echo "Error: Required library ${lib_name}.sh not found" >&2
        exit 1
    fi

    source "$lib_path"
}

# 必須ライブラリ読み込み
load_library "common"
load_library "pr-helpers"

# -----------------------------------------------------------------------------
# ヘルプ
# -----------------------------------------------------------------------------

usage() {
    cat << EOF
使用方法: $SCRIPT_NAME <issue_number> [オプション]

引数:
    issue_number       関連するGitHub Issue番号

オプション:
    -h, --help        このヘルプを表示
    -d, --draft       ドラフトPRとして作成
    -n, --no-checks   品質チェックをスキップ
    -b, --branch      ブランチ名を指定
    -m, --message     コミットメッセージを指定
    -v, --verbose     詳細出力モード
    --dry-run         実際のPR作成をスキップ

例:
    $SCRIPT_NAME 123
    $SCRIPT_NAME 123 --draft
    $SCRIPT_NAME 123 --branch "feature/custom-branch"
    $SCRIPT_NAME 123 --no-checks --draft

Claude経由での使用:
    claude "Issue #123 のPRを作成して"
    claude "/pr/create 123"
EOF
    exit 0
}

# -----------------------------------------------------------------------------
# 引数解析
# -----------------------------------------------------------------------------

parse_arguments() {
    ISSUE_NUMBER=""
    DRAFT=false
    NO_CHECKS=false
    BRANCH_NAME=""
    COMMIT_MESSAGE=""
    VERBOSE=false
    DRY_RUN=false

    # 引数なしの場合
    if [ $# -eq 0 ]; then
        usage
    fi

    # 引数解析
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -d|--draft)
                DRAFT=true
                shift
                ;;
            -n|--no-checks)
                NO_CHECKS=true
                shift
                ;;
            -b|--branch)
                BRANCH_NAME="$2"
                shift 2
                ;;
            -m|--message)
                COMMIT_MESSAGE="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -*)
                error "不明なオプション: $1"
                usage
                ;;
            *)
                if [ -z "$ISSUE_NUMBER" ]; then
                    ISSUE_NUMBER="$1"
                else
                    error "複数のIssue番号が指定されました"
                    usage
                fi
                shift
                ;;
        esac
    done

    # 必須引数チェック
    if [ -z "$ISSUE_NUMBER" ]; then
        error "Issue番号を指定してください"
        usage
    fi

    # Issue番号の妥当性チェック
    if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
        error "Issue番号は数値で指定してください: $ISSUE_NUMBER"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# 環境検証
# -----------------------------------------------------------------------------

validate_environment() {
    # 必要なコマンドの確認
    require_command "gh" || {
        error "GitHub CLI (gh) がインストールされていません"
        info "インストール方法: https://cli.github.com/"
        exit 1
    }

    require_command "jq" || {
        error "jq がインストールされていません"
        exit 1
    }

    require_command "git" || {
        error "git がインストールされていません"
        exit 1
    }

    # GitHub CLI認証確認
    check_gh_auth || {
        error "GitHub CLIが認証されていません"
        info "実行: gh auth login"
        exit 1
    }

    # Gitリポジトリ確認
    check_git_repo || {
        error "Gitリポジトリ内で実行してください"
        exit 1
    }

    # 未コミットの変更確認
    if [ -z "$(git status --porcelain)" ]; then
        warning "コミットする変更がありません"
        if ! confirm "変更がありませんが続行しますか？"; then
            exit 0
        fi
    fi
}

# -----------------------------------------------------------------------------
# メイン処理
# -----------------------------------------------------------------------------

process_pr_creation() {
    local issue_number="$1"

    # Issue情報取得
    info "📋 Issue #$issue_number の情報を取得中..."
    local issue_info
    issue_info=$(fetch_issue_info "$issue_number") || exit 1

    local issue_metadata
    issue_metadata=$(extract_issue_metadata "$issue_info")

    if [ "$VERBOSE" = true ]; then
        debug "Issue metadata:"
        echo "$issue_metadata" | jq '.'
    fi

    # メタデータ抽出
    local issue_title=$(echo "$issue_metadata" | jq -r '.title')
    local task_id=$(echo "$issue_metadata" | jq -r '.task_id')

    # ブランチ作成/切り替え
    if [ -z "$BRANCH_NAME" ]; then
        BRANCH_NAME=$(create_feature_branch "$issue_number" "$issue_title")
    else
        info "指定されたブランチに切り替え: $BRANCH_NAME"
        git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    fi

    # 変更をステージング
    info "📦 変更をステージング中..."
    git add -A

    # 変更解析
    local changes_info
    changes_info=$(analyze_changes)

    if [ "$VERBOSE" = true ]; then
        debug "Changes analysis:"
        echo "$changes_info" | jq '.'
    fi

    local pr_type=$(echo "$changes_info" | jq -r '.type')
    local pr_size=$(echo "$changes_info" | jq -r '.size')

    # 品質チェック
    local check_results="[]"
    if [ "$NO_CHECKS" = false ]; then
        check_results=$(run_quality_checks) || true
    else
        info "⏭️ 品質チェックをスキップ"
        check_results='["⏭️ Checks: Skipped by user"]'
    fi

    # コミット作成
    if [ -n "$COMMIT_MESSAGE" ]; then
        info "💾 指定されたメッセージでコミット作成中..."
        git commit -m "$COMMIT_MESSAGE" || true
    else
        create_commit "$issue_number" "$pr_type" "$issue_title" "$task_id" || true
    fi

    # ブランチプッシュ
    info "📤 リモートにプッシュ中..."
    git push -u origin "$BRANCH_NAME" || {
        error "プッシュに失敗しました"
        exit 1
    }

    if [ "$DRY_RUN" = true ]; then
        info "🔍 DRY RUNモード - 実際のPR作成はスキップします"
        success "=== PR Preview ==="
        echo "Branch: $BRANCH_NAME"
        echo "Type: $pr_type"
        echo "Size: $pr_size"
        echo "Draft: $DRAFT"
        echo "===================="
        return 0
    fi

    # PR本文生成
    local pr_body
    pr_body=$(generate_pr_body \
        "$issue_number" \
        "$task_id" \
        "$pr_type" \
        "$pr_size" \
        "$(echo "$changes_info" | jq -r '.files_changed') files, +$(echo "$changes_info" | jq -r '.lines_added')/-$(echo "$changes_info" | jq -r '.lines_deleted')" \
        "$(echo "$check_results" | jq -r '.[]' | paste -sd '\n')")

    # PRデータ構築
    local pr_data
    pr_data=$(cat << EOF
{
  "title": "[$task_id] $issue_title",
  "body": $(echo "$pr_body" | jq -Rs .),
  "labels": "$(echo "$issue_metadata" | jq -r '.labels // ""')",
  "draft": $DRAFT
}
EOF
)

    # PR作成
    local pr_url
    pr_url=$(create_pull_request "$issue_number" "$pr_data")

    if [ -n "$pr_url" ]; then
        echo ""
        success "🎉 PR作成完了！"
        echo "$pr_url"

        # Issue更新
        info "📝 Issue #$issue_number を更新中..."
        local update_comment="## ✅ PR作成完了

PR: $pr_url

### 検証結果:
$(echo "$check_results" | jq -r '.[]')

---
*このコメントは自動生成されました*"

        gh issue comment "$issue_number" --body "$update_comment" || true
    fi
}

# -----------------------------------------------------------------------------
# メイン関数
# -----------------------------------------------------------------------------

main() {
    # 引数解析
    parse_arguments "$@"

    # 環境検証
    validate_environment

    # PR作成処理
    process_pr_creation "$ISSUE_NUMBER"

    success "✨ 完了！"
}

# スクリプト実行
main "$@"
