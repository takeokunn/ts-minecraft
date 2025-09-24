#!/bin/bash

# =============================================================================
# Claude Agent専用ヘルパー関数
# AIエージェントとの連携を最適化
# =============================================================================

# 共通ライブラリをソース（SCRIPT_DIRが未定義の場合のみ設定）
if [ -z "${SCRIPT_DIR:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
    source "${SCRIPT_DIR}/common.sh"
fi

# -----------------------------------------------------------------------------
# Claude コマンド解析
# -----------------------------------------------------------------------------

# 自然言語コマンドからタスクタイプを判定
parse_claude_command() {
    local command=$1
    local command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

    # Issue作成パターン
    if echo "$command_lower" | grep -qE "(issue|イシュー).*(作|create|生成|作成)"; then
        echo "create-issue"
        return
    fi

    # Issue実装パターン
    if echo "$command_lower" | grep -qE "issue.*#[0-9]+.*(実装|implement)"; then
        echo "implement-issue"
        return
    fi

    # PR作成パターン
    if echo "$command_lower" | grep -qE "(pr|pull request).*(作|create|生成)"; then
        echo "create-pr"
        return
    fi

    # ROADMAP Issue作成パターン
    if echo "$command_lower" | grep -qE "roadmap.*phase.*[0-9]+.*issue"; then
        echo "create-phase-issues"
        return
    fi

    # デフォルト（Issue作成として扱う）
    echo "create-issue"
}

# コマンドから要望文を抽出
extract_request_from_command() {
    local command=$1

    # "Issue を作って" などの定型句を削除
    local request=$(echo "$command" | \
        sed -E 's/(issue|イシュー).*(を|の).*(作|create|生成|作成)[^[:space:]]*//gi' | \
        sed -E 's/^\s+|\s+$//g')

    echo "$request"
}

# コマンドからIssue番号を抽出
extract_issue_number() {
    local command=$1
    echo "$command" | grep -oE '#[0-9]+' | grep -oE '[0-9]+' | head -1
}

# -----------------------------------------------------------------------------
# Claude 用メッセージフォーマット
# -----------------------------------------------------------------------------

# Claude向けのプログレスメッセージ
claude_progress() {
    local step=$1
    local total=$2
    local message=$3

    echo "📊 進捗: [$step/$total] $message"
}

# Claude向けの結果サマリー
claude_summary() {
    cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 実行結果サマリー
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# Claude向けの次のステップ案内
claude_next_steps() {
    local issue_number=$1

    cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 次のステップ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Issue確認:
   gh issue view $issue_number --web

2️⃣  自動実装:
   claude "Issue #$issue_number を実装して"

3️⃣  PR作成:
   scripts/create-pr.sh $issue_number

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# -----------------------------------------------------------------------------
# Issue作成の最適化
# -----------------------------------------------------------------------------

# Claudeコンテキストに基づく複雑度推定
estimate_complexity_with_context() {
    local request=$1
    local context=$2  # 現在の会話コンテキスト（オプション）

    # 基本の複雑度推定
    local base_complexity=$(estimate_complexity "$request")

    # コンテキストに基づく調整
    if [ -n "$context" ]; then
        # 過去の会話から複雑度を推測
        if echo "$context" | grep -qE "簡単|simple|easy|シンプル"; then
            echo "3 - Easy (基本的な機能実装)"
        elif echo "$context" | grep -qE "複雑|complex|difficult|難しい"; then
            echo "7 - Hard (アーキテクチャ変更)"
        else
            echo "$base_complexity"
        fi
    else
        echo "$base_complexity"
    fi
}

# -----------------------------------------------------------------------------
# 実装支援
# -----------------------------------------------------------------------------

# Issue実装前のチェックリスト
pre_implementation_checklist() {
    local issue_number=$1

    echo "📋 実装前チェックリスト:"
    echo ""

    # Issue存在確認
    if issue_exists "$issue_number"; then
        echo "✅ Issue #$issue_number が存在します"
    else
        echo "❌ Issue #$issue_number が見つかりません"
        return 1
    fi

    # ブランチ状態確認
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
        echo "⚠️  現在のブランチ: $current_branch (mainではありません)"
    else
        echo "✅ 現在のブランチ: $current_branch"
    fi

    # 未コミット変更確認
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "⚠️  未コミットの変更があります"
    else
        echo "✅ 作業ディレクトリはクリーンです"
    fi

    echo ""
}

# -----------------------------------------------------------------------------
# 自動実行フロー
# -----------------------------------------------------------------------------

# Issue作成から実装までの完全自動化
claude_full_automation() {
    local request=$1
    local auto_implement=${2:-false}

    claude_progress 1 4 "要望を分析中..."

    # Issue作成
    claude_progress 2 4 "Issueを作成中..."
    local issue_output=$("${SCRIPT_DIR}/../create-issue.sh" "$request" 2>&1)
    local issue_number=$(echo "$issue_output" | grep -oE 'issues/[0-9]+' | grep -oE '[0-9]+')

    if [ -z "$issue_number" ]; then
        error "Issue作成に失敗しました"
        echo "$issue_output"
        return 1
    fi

    success "Issue #$issue_number を作成しました"

    # 自動実装フラグが有効な場合
    if [ "$auto_implement" = true ]; then
        claude_progress 3 4 "自動実装を開始中..."
        echo ""
        info "Issue #$issue_number の実装を開始します..."
        # ここで実装コマンドを呼び出す（別スクリプト）
    else
        claude_progress 3 4 "手動実装待機中..."
    fi

    claude_progress 4 4 "完了！"

    # サマリー表示
    claude_summary
    echo "✅ Issue作成: #$issue_number"
    echo "📝 タイトル: $(gh issue view "$issue_number" --json title -q .title)"
    echo "🔗 URL: $(gh issue view "$issue_number" --json url -q .url)"

    # 次のステップ
    claude_next_steps "$issue_number"
}

# -----------------------------------------------------------------------------
# エクスポート
# -----------------------------------------------------------------------------
export -f parse_claude_command
export -f extract_request_from_command
export -f extract_issue_number
export -f claude_progress
export -f claude_summary
export -f claude_next_steps
export -f estimate_complexity_with_context
export -f pre_implementation_checklist
export -f claude_full_automation

