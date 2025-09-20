#!/bin/bash

# =============================================================================
# 共通ライブラリ - スクリプト間で共有される関数群
# =============================================================================

# -----------------------------------------------------------------------------
# カラー定義
# -----------------------------------------------------------------------------
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_MAGENTA='\033[0;35m'
readonly COLOR_RESET='\033[0m'

# -----------------------------------------------------------------------------
# ロギング関数
# -----------------------------------------------------------------------------

# エラーメッセージ表示
error() {
    echo -e "${COLOR_RED}❌ Error: $1${COLOR_RESET}" >&2
}

# 情報メッセージ表示
info() {
    echo -e "${COLOR_BLUE}ℹ️  $1${COLOR_RESET}"
}

# 成功メッセージ表示
success() {
    echo -e "${COLOR_GREEN}✅ $1${COLOR_RESET}"
}

# 警告メッセージ表示
warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_RESET}"
}

# プロンプト表示
prompt() {
    echo -e "${COLOR_CYAN}❓ $1${COLOR_RESET}"
}

# デバッグメッセージ（DEBUG環境変数が設定されている場合のみ）
debug() {
    if [ -n "${DEBUG:-}" ]; then
        echo -e "${COLOR_MAGENTA}🔍 Debug: $1${COLOR_RESET}" >&2
    fi
}

# -----------------------------------------------------------------------------
# バリデーション関数
# -----------------------------------------------------------------------------

# コマンドの存在確認
require_command() {
    local cmd=$1
    if ! command -v "$cmd" &> /dev/null; then
        error "必要なコマンド '$cmd' がインストールされていません"
        return 1
    fi
}

# GitHub CLI認証確認
check_gh_auth() {
    if ! gh auth status &>/dev/null; then
        error "GitHub CLIの認証が必要です。'gh auth login' を実行してください"
        return 1
    fi
}

# Git リポジトリ確認
check_git_repo() {
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Gitリポジトリ内で実行してください"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# GitHub関連関数
# -----------------------------------------------------------------------------

# Task ID生成（既存のIssueから最新番号を取得）
generate_task_id() {
    local prefix="${1:-P0}"

    debug "Task ID生成中 (prefix: $prefix)"

    local existing_issues
    existing_issues=$(gh issue list --limit 1000 --json number,title 2>/dev/null | \
                     jq -r '.[].title' | \
                     grep -oP "${prefix}-\d+" | \
                     sort -u | \
                     tail -1)

    if [ -z "$existing_issues" ]; then
        echo "${prefix}-001"
    else
        local last_number
        last_number=$(echo "$existing_issues" | grep -oP '\d+$' | sort -n | tail -1)
        printf "%s-%03d" "$prefix" $((last_number + 1))
    fi
}

# Issue存在確認
issue_exists() {
    local issue_number=$1
    gh issue view "$issue_number" &>/dev/null
}

# -----------------------------------------------------------------------------
# 文字列処理関数
# -----------------------------------------------------------------------------

# 文字列のサニタイズ（ブランチ名用）
sanitize_for_branch() {
    local text=$1
    echo "$text" | \
        tr '[:upper:]' '[:lower:]' | \
        tr -cs '[:alnum:]' '-' | \
        sed 's/^-//;s/-$//' | \
        cut -c1-50
}

# Markdownエスケープ
escape_markdown() {
    local text=$1
    echo "$text" | \
        sed 's/\\/\\\\/g' | \
        sed 's/\*/\\*/g' | \
        sed 's/_/\\_/g' | \
        sed 's/\[/\\[/g' | \
        sed 's/\]/\\]/g'
}

# -----------------------------------------------------------------------------
# プロジェクト関連関数
# -----------------------------------------------------------------------------

# package.jsonのスクリプト存在確認
has_npm_script() {
    local script_name=$1
    if [ -f "package.json" ]; then
        jq -e ".scripts[\"$script_name\"]" package.json &>/dev/null
    else
        return 1
    fi
}

# プロジェクトタイプ判定
detect_project_type() {
    if [ -f "package.json" ]; then
        echo "node"
    elif [ -f "Cargo.toml" ]; then
        echo "rust"
    elif [ -f "go.mod" ]; then
        echo "go"
    elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
        echo "python"
    else
        echo "unknown"
    fi
}

# -----------------------------------------------------------------------------
# 確認プロンプト
# -----------------------------------------------------------------------------

# Yes/No確認
confirm() {
    local message=$1
    local default=${2:-n}  # デフォルトは No

    local prompt_text
    if [ "$default" = "y" ]; then
        prompt_text="$message [Y/n]: "
    else
        prompt_text="$message [y/N]: "
    fi

    read -r -p "$(echo -e "${COLOR_CYAN}$prompt_text${COLOR_RESET}")" response

    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        [nN][oO]|[nN])
            return 1
            ;;
        "")
            [ "$default" = "y" ] && return 0 || return 1
            ;;
        *)
            return 1
            ;;
    esac
}

# -----------------------------------------------------------------------------
# プログレス表示
# -----------------------------------------------------------------------------

# スピナー表示（バックグラウンドプロセス用）
show_spinner() {
    local pid=$1
    local message=$2
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

    while kill -0 "$pid" 2>/dev/null; do
        for ((i=0; i<${#spinstr}; i++)); do
            printf "\r${COLOR_BLUE}%s${COLOR_RESET} %s" "${spinstr:i:1}" "$message"
            sleep 0.1
        done
    done
    printf "\r%*s\r" $((${#message} + 2)) ""  # 行をクリア
}

# -----------------------------------------------------------------------------
# エクスポート
# -----------------------------------------------------------------------------

# 関数のエクスポート（他のスクリプトから利用可能にする）
export -f error info success warning prompt debug
export -f require_command check_gh_auth check_git_repo
export -f generate_task_id issue_exists
export -f sanitize_for_branch escape_markdown
export -f has_npm_script detect_project_type
export -f confirm show_spinner
