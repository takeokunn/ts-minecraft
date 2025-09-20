#!/bin/bash

# =============================================================================
# PR作成ヘルパー関数
# =============================================================================

# 共通ライブラリをソース（SCRIPT_DIRが未定義の場合のみ設定）
if [ -z "${SCRIPT_DIR:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
    source "${SCRIPT_DIR}/common.sh"
fi

# -----------------------------------------------------------------------------
# Issue情報取得
# -----------------------------------------------------------------------------

fetch_issue_info() {
    local issue_number=$1

    debug "Fetching issue #$issue_number info..."

    local issue_info
    issue_info=$(gh issue view "$issue_number" --json title,body,labels 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$issue_info" ]; then
        error "Issue #$issue_number が見つかりません"
        return 1
    fi

    echo "$issue_info"
}

extract_issue_metadata() {
    local issue_info=$1

    local title=$(echo "$issue_info" | jq -r '.title')
    local body=$(echo "$issue_info" | jq -r '.body')
    local labels=$(echo "$issue_info" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')

    # Task ID抽出
    local task_id
    task_id=$(echo "$body" | grep -oE 'P[0-9]+-[0-9]+' | head -1 || echo "P0-000")

    cat << EOF
{
  "title": $(echo "$title" | jq -Rs .),
  "body": $(echo "$body" | jq -Rs .),
  "labels": "$labels",
  "task_id": "$task_id"
}
EOF
}

# -----------------------------------------------------------------------------
# 変更解析
# -----------------------------------------------------------------------------

analyze_changes() {
    local changes_stats
    changes_stats=$(git diff --cached --numstat 2>/dev/null)

    if [ -z "$changes_stats" ]; then
        changes_stats=$(git diff HEAD~1 --numstat 2>/dev/null)
    fi

    local added=0
    local deleted=0
    local files_changed=0

    if [ -n "$changes_stats" ]; then
        while IFS=$'\t' read -r add del file; do
            added=$((added + add))
            deleted=$((deleted + del))
            files_changed=$((files_changed + 1))
        done <<< "$changes_stats"
    fi

    local total=$((added + deleted))

    # サイズ判定
    local size
    if [ "$total" -eq 0 ]; then
        size="XS"
    elif [ "$total" -le 10 ]; then
        size="XS"
    elif [ "$total" -le 50 ]; then
        size="S"
    elif [ "$total" -le 200 ]; then
        size="M"
    elif [ "$total" -le 500 ]; then
        size="L"
    else
        size="XL"
    fi

    # タイプ判定
    local type
    local changed_files=$(git diff --cached --name-only 2>/dev/null || git diff HEAD~1 --name-only 2>/dev/null)

    if echo "$changed_files" | grep -q "test"; then
        type="test"
    elif echo "$changed_files" | grep -q "^docs/"; then
        type="docs"
    elif echo "$changed_files" | grep -q "fix"; then
        type="fix"
    elif echo "$changed_files" | grep -q "refactor"; then
        type="refactor"
    else
        type="feat"
    fi

    cat << EOF
{
  "size": "$size",
  "type": "$type",
  "files_changed": $files_changed,
  "lines_added": $added,
  "lines_deleted": $deleted,
  "total_changes": $total
}
EOF
}

# -----------------------------------------------------------------------------
# ブランチ管理
# -----------------------------------------------------------------------------

create_feature_branch() {
    local issue_number=$1
    local issue_title=$2

    # ブランチ名生成
    local clean_title
    clean_title=$(sanitize_for_branch "$issue_title")
    local branch_name="feat/issue-${issue_number}-${clean_title}"

    debug "Creating branch: $branch_name"

    # 現在のブランチ確認
    local current_branch
    current_branch=$(git branch --show-current)

    # main/masterブランチでない場合は警告
    if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
        warning "現在のブランチ: $current_branch (mainではありません)"
        if ! confirm "このブランチから新しいブランチを作成しますか？"; then
            return 1
        fi
    fi

    # ブランチ作成/切り替え
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        info "既存のブランチに切り替え: $branch_name"
        git checkout "$branch_name"
    else
        info "新しいブランチを作成: $branch_name"
        git checkout -b "$branch_name"
    fi

    echo "$branch_name"
}

# -----------------------------------------------------------------------------
# 品質チェック
# -----------------------------------------------------------------------------

run_quality_checks() {
    info "🔍 品質チェック実行中..."

    local results=()
    local has_errors=false

    # TypeCheck
    if has_npm_script "typecheck"; then
        info "TypeCheck実行中..."
        if pnpm typecheck &>/dev/null; then
            results+=("✅ TypeCheck: Pass")
        else
            results+=("❌ TypeCheck: Failed")
            has_errors=true
            warning "TypeCheckエラーがあります"
        fi
    else
        results+=("⏭️ TypeCheck: Skipped")
    fi

    # Lint
    if has_npm_script "lint"; then
        info "Lint実行中..."
        if pnpm lint &>/dev/null; then
            results+=("✅ Lint: Pass")
        else
            results+=("❌ Lint: Failed")
            has_errors=true
            warning "Lintエラーがあります"
        fi
    else
        results+=("⏭️ Lint: Skipped")
    fi

    # Build
    if has_npm_script "build"; then
        info "Build実行中..."
        if pnpm build &>/dev/null; then
            results+=("✅ Build: Pass")
        else
            results+=("❌ Build: Failed")
            has_errors=true
            warning "ビルドエラーがあります"
        fi
    else
        results+=("⏭️ Build: Skipped")
    fi

    # Test
    if has_npm_script "test"; then
        info "Test実行中..."
        if timeout 30 pnpm test &>/dev/null; then
            results+=("✅ Test: Pass")
        else
            results+=("⚠️ Test: Failed or Timeout")
        fi
    else
        results+=("⏭️ Test: Skipped")
    fi

    # 結果表示
    echo ""
    echo "品質チェック結果:"
    for result in "${results[@]}"; do
        echo "  $result"
    done
    echo ""

    # エラーがある場合の処理
    if [ "$has_errors" = true ]; then
        warning "品質チェックで問題が見つかりました"
        if ! confirm "問題がありますが続行しますか？"; then
            return 1
        fi
    fi

    # 結果をJSON形式で返す
    printf '%s\n' "${results[@]}" | jq -Rs 'split("\n")[:-1]'
}

# -----------------------------------------------------------------------------
# コミット作成
# -----------------------------------------------------------------------------

create_commit() {
    local issue_number=$1
    local type=$2
    local title=$3
    local task_id=$4

    info "💾 コミット作成中..."

    # コミットメッセージ作成
    local commit_message="${type}: ${title}

Issue: #${issue_number}
Task ID: ${task_id}"

    # 変更をステージング
    if ! git diff --cached --quiet; then
        debug "既にステージングされた変更があります"
    elif ! git diff --quiet; then
        info "変更をステージング中..."
        git add -A
    else
        warning "コミットする変更がありません"
        return 1
    fi

    # コミット作成
    git commit -m "$commit_message" || {
        error "コミット作成に失敗しました"
        return 1
    }

    success "コミットを作成しました"
}

# -----------------------------------------------------------------------------
# PR作成
# -----------------------------------------------------------------------------

create_pull_request() {
    local issue_number=$1
    local pr_data=$2

    info "📝 Pull Request作成中..."

    # データ抽出
    local title=$(echo "$pr_data" | jq -r '.title')
    local body=$(echo "$pr_data" | jq -r '.body')
    local labels=$(echo "$pr_data" | jq -r '.labels // ""')
    local draft=$(echo "$pr_data" | jq -r '.draft // false')

    # PR作成コマンド構築
    local pr_cmd="gh pr create --title \"$title\" --body \"$body\""

    if [ -n "$labels" ]; then
        pr_cmd="$pr_cmd --label \"$labels\""
    fi

    if [ "$draft" = "true" ]; then
        pr_cmd="$pr_cmd --draft"
    fi

    # PR作成実行
    local pr_url
    pr_url=$(eval "$pr_cmd" 2>&1)

    if [ $? -ne 0 ]; then
        error "PR作成に失敗しました: $pr_url"
        return 1
    fi

    success "PR作成完了！"
    echo "$pr_url"
}

# -----------------------------------------------------------------------------
# PRテンプレート生成
# -----------------------------------------------------------------------------

generate_pr_body() {
    local issue_number=$1
    local task_id=$2
    local type=$3
    local size=$4
    local changes=$5
    local check_results=$6

    cat << 'EOF'
## 📋 概要

Issue #${issue_number} の実装を完了しました。

## 🏷️ メタデータ

- **Task ID**: ${task_id}
- **Type**: ${type}
- **Size**: ${size}
- **Issue**: Closes #${issue_number}

## 📝 変更内容

${changes}

## ✅ チェックリスト

- [x] コードレビュー準備完了
- [x] テスト追加/更新
- [x] ドキュメント更新（必要に応じて）
- [x] 品質チェック通過

## 🔍 品質チェック結果

${check_results}

## 📸 スクリーンショット

<!-- 必要に応じてスクリーンショットを追加 -->

## 🧪 テスト手順

1. 開発サーバーを起動: `pnpm dev`
2. http://localhost:3000 にアクセス
3. 実装した機能が動作することを確認

## 💭 レビュアーへのコメント

自動生成されたPRです。詳細はIssue #${issue_number} を参照してください。

---
*このPRは `create-pr.sh` により自動生成されました*
EOF
}

# エクスポート
export -f fetch_issue_info
export -f extract_issue_metadata
export -f analyze_changes
export -f create_feature_branch
export -f run_quality_checks
export -f create_commit
export -f create_pull_request
export -f generate_pr_body
