#!/bin/bash

# =============================================================================
# スクリプトテストスイート
#
# 使用方法:
#   scripts/test-all.sh [オプション]
#
# オプション:
#   --dry-run    実際の操作を行わずテストを実行
#   --verbose    詳細出力モード
#   --quick      基本的なテストのみ実行
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"

# テスト設定
DRY_RUN="${1:-false}"
VERBOSE="${2:-false}"
QUICK="${3:-false}"

# カラー設定
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_RED='\033[0;31m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# -----------------------------------------------------------------------------
# ヘルパー関数
# -----------------------------------------------------------------------------

test_pass() {
    echo -e "${COLOR_GREEN}✅ PASS${COLOR_RESET}: $1"
}

test_fail() {
    echo -e "${COLOR_RED}❌ FAIL${COLOR_RESET}: $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

test_skip() {
    echo -e "${COLOR_YELLOW}⏭️ SKIP${COLOR_RESET}: $1"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
}

test_info() {
    echo -e "${COLOR_BLUE}ℹ️ INFO${COLOR_RESET}: $1"
}

section_header() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# -----------------------------------------------------------------------------
# テスト: ライブラリ
# -----------------------------------------------------------------------------

test_libraries() {
    section_header "📚 ライブラリテスト"

    local libs=("common" "issue-analyzer" "claude-helpers" "pr-helpers")

    for lib in "${libs[@]}"; do
        if [ -f "${LIB_DIR}/${lib}.sh" ]; then
            # シンタックスチェック
            if bash -n "${LIB_DIR}/${lib}.sh" 2>/dev/null; then
                test_pass "Syntax check: ${lib}.sh"
            else
                test_fail "Syntax check: ${lib}.sh"
            fi

            # ソース可能性チェック
            if (source "${LIB_DIR}/${lib}.sh" 2>/dev/null); then
                test_pass "Source check: ${lib}.sh"
            else
                test_fail "Source check: ${lib}.sh"
            fi
        else
            test_fail "Library not found: ${lib}.sh"
        fi
    done
}

# -----------------------------------------------------------------------------
# テスト: create-issue.sh
# -----------------------------------------------------------------------------

test_create_issue() {
    section_header "📝 create-issue.sh テスト"

    local script="${SCRIPT_DIR}/create-issue.sh"

    if [ ! -f "$script" ]; then
        test_fail "Script not found: create-issue.sh"
        return
    fi

    # 実行権限チェック
    if [ -x "$script" ]; then
        test_pass "Executable: create-issue.sh"
    else
        test_fail "Not executable: create-issue.sh"
    fi

    # ヘルプ表示テスト
    if "$script" --help &>/dev/null; then
        test_pass "Help option: create-issue.sh"
    else
        test_fail "Help option: create-issue.sh"
    fi

    # DRY RUNテスト
    if [ "$DRY_RUN" = false ] && [ "$QUICK" = false ]; then
        test_info "Testing create-issue.sh with dry-run..."
        if "$script" "テストIssue" --dry-run 2>&1 | grep -q "DRY RUN"; then
            test_pass "Dry-run mode: create-issue.sh"
        else
            test_fail "Dry-run mode: create-issue.sh"
        fi
    else
        test_skip "Dry-run test: create-issue.sh (quick mode)"
    fi
}

# -----------------------------------------------------------------------------
# テスト: create-pr.sh
# -----------------------------------------------------------------------------

test_create_pr() {
    section_header "🔀 create-pr.sh テスト"

    # 両バージョンをテスト
    local scripts=("create-pr.sh" "create-pr-v2.sh")

    for script_name in "${scripts[@]}"; do
        local script="${SCRIPT_DIR}/${script_name}"

        if [ ! -f "$script" ]; then
            test_skip "Script not found: ${script_name}"
            continue
        fi

        # 実行権限チェック
        if [ -x "$script" ]; then
            test_pass "Executable: ${script_name}"
        else
            test_fail "Not executable: ${script_name}"
        fi

        # シンタックスチェック
        if bash -n "$script" 2>/dev/null; then
            test_pass "Syntax check: ${script_name}"
        else
            test_fail "Syntax check: ${script_name}"
        fi
    done
}

# -----------------------------------------------------------------------------
# テスト: create-phase-issues.sh
# -----------------------------------------------------------------------------

test_create_phase_issues() {
    section_header "📋 create-phase-issues.sh テスト"

    local script="${SCRIPT_DIR}/create-phase-issues.sh"

    if [ ! -f "$script" ]; then
        test_fail "Script not found: create-phase-issues.sh"
        return
    fi

    # 実行権限チェック
    if [ -x "$script" ]; then
        test_pass "Executable: create-phase-issues.sh"
    else
        test_fail "Not executable: create-phase-issues.sh"
    fi

    # ROADMAP.md存在確認
    if [ -f "${PROJECT_ROOT}/ROADMAP.md" ]; then
        test_pass "ROADMAP.md exists"
    else
        test_fail "ROADMAP.md not found"
    fi
}

# -----------------------------------------------------------------------------
# テスト: 統合テスト
# -----------------------------------------------------------------------------

test_integration() {
    section_header "🔗 統合テスト"

    # GitHub CLI確認
    if command -v gh &>/dev/null; then
        test_pass "GitHub CLI installed"

        if gh auth status &>/dev/null; then
            test_pass "GitHub CLI authenticated"
        else
            test_fail "GitHub CLI not authenticated"
        fi
    else
        test_fail "GitHub CLI not installed"
    fi

    # jq確認
    if command -v jq &>/dev/null; then
        test_pass "jq installed"
    else
        test_fail "jq not installed"
    fi

    # pnpm確認
    if command -v pnpm &>/dev/null; then
        test_pass "pnpm installed"
    else
        test_skip "pnpm not installed (optional)"
    fi

    # Git確認
    if git rev-parse --git-dir &>/dev/null; then
        test_pass "Inside git repository"
    else
        test_fail "Not inside git repository"
    fi
}

# -----------------------------------------------------------------------------
# テスト: コマンド構造
# -----------------------------------------------------------------------------

test_commands_structure() {
    section_header "📂 コマンド構造テスト"

    local commands_dir="${PROJECT_ROOT}/.claude/commands"

    if [ -d "$commands_dir" ]; then
        test_pass "Commands directory exists"

        # 必須サブディレクトリ確認
        local subdirs=("issue" "pr" "test" "build")
        for subdir in "${subdirs[@]}"; do
            if [ -d "${commands_dir}/${subdir}" ]; then
                test_pass "Subdir exists: ${subdir}/"
            else
                test_fail "Subdir missing: ${subdir}/"
            fi
        done

        # インデックスファイル確認
        if [ -f "${commands_dir}/index.md" ]; then
            test_pass "Commands index.md exists"
        else
            test_fail "Commands index.md missing"
        fi
    else
        test_fail "Commands directory not found"
    fi
}

# -----------------------------------------------------------------------------
# メイン処理
# -----------------------------------------------------------------------------

main() {
    # カウンター初期化
    FAILED_TESTS=0
    SKIPPED_TESTS=0
    TOTAL_TESTS=0

    echo ""
    echo "=========================================="
    echo "     スクリプトテストスイート開始"
    echo "=========================================="
    echo ""
    test_info "Mode: DRY_RUN=$DRY_RUN, VERBOSE=$VERBOSE, QUICK=$QUICK"

    # テスト実行
    test_libraries
    test_create_issue
    test_create_pr
    test_create_phase_issues

    if [ "$QUICK" = false ]; then
        test_integration
        test_commands_structure
    else
        test_skip "Integration tests (quick mode)"
        test_skip "Commands structure tests (quick mode)"
    fi

    # 結果サマリー
    echo ""
    echo "=========================================="
    echo "     テスト結果サマリー"
    echo "=========================================="
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ すべてのテストが成功しました！${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}❌ $FAILED_TESTS 個のテストが失敗しました${COLOR_RESET}"
    fi

    if [ $SKIPPED_TESTS -gt 0 ]; then
        echo -e "${COLOR_YELLOW}⏭️ $SKIPPED_TESTS 個のテストがスキップされました${COLOR_RESET}"
    fi

    echo ""

    # 終了コード
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# スクリプト実行
main