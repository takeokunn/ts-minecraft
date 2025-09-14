#!/bin/bash

# =============================================================================
# Issue自動作成スクリプト
#
# 使用方法:
#   scripts/create-issue.sh "<要望文>" [オプション]
#
# 例:
#   scripts/create-issue.sh "editorconfig lintを導入したい"
#   scripts/create-issue.sh "難しいタスク" --complexity 8
#   scripts/create-issue.sh "Effect-TS改善" --guidance "Detailed"
#
# Claude経由:
#   claude "editorconfig lintを導入したい Issue を作って"
#   claude "/issue/create ブロック破壊アニメーション追加"
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"

# デフォルト値
readonly DEFAULT_COMPLEXITY="5 - Medium (標準的な機能実装)"
readonly DEFAULT_AI_GUIDANCE="Standard - 通常レベルの指示"
readonly GITHUB_REPO="${GITHUB_REPOSITORY:-}"

# -----------------------------------------------------------------------------
# ライブラリ読み込み
# -----------------------------------------------------------------------------

# 必須ライブラリのチェックと読み込み
load_library() {
    local lib_name="$1"
    local lib_path="${LIB_DIR}/${lib_name}.sh"

    if [ ! -f "$lib_path" ]; then
        echo "Error: Required library ${lib_name}.sh not found" >&2
        echo "Please ensure all library files are present in ${LIB_DIR}/" >&2
        exit 1
    fi

    source "$lib_path"
}

# ライブラリ読み込み
load_library "common"
load_library "issue-analyzer"

# Claude ヘルパー（オプション）
if [ -f "${LIB_DIR}/claude-helpers.sh" ]; then
    source "${LIB_DIR}/claude-helpers.sh"
    CLAUDE_INTEGRATION=true
else
    CLAUDE_INTEGRATION=false
fi

# -----------------------------------------------------------------------------
# ヘルプ関数
# -----------------------------------------------------------------------------

usage() {
    cat << EOF
使用方法: $SCRIPT_NAME "<要望文>" [オプション]

引数:
    要望文              実装したい機能の説明（自然言語）

オプション:
    -h, --help         このヘルプを表示
    -g, --guidance     AIガイダンスレベルを指定
    -l, --labels       追加ラベル（カンマ区切り）
    -a, --assignee     アサイン先（デフォルト: @me）
    -d, --dry-run      実際のIssue作成をスキップ
    -v, --verbose      詳細出力モード

AIガイダンスレベル:
    Minimal   - 基本要件のみ
    Standard  - 通常レベルの指示
    Detailed  - 詳細な実装指示
    Expert    - 高度な技術指示と制約

複雑度の自動判定:
    キーワードに基づいて以下のように自動判定されます：
    - 「導入」「追加」「設定」 → Easy (基本的な機能実装)
    - 「改善」「修正」「リファクタリング」 → Medium (標準的な機能実装)
    - 「設計」「アーキテクチャ」「統合」 → Hard (複雑な変更)
    - 「新技術」「大規模」「全面」 → Expert (新技術導入)

例:
    $SCRIPT_NAME "editorconfig lintを導入したい"
    $SCRIPT_NAME "Effect-TS改善" --guidance Detailed --labels "performance,refactor"
    $SCRIPT_NAME "テスト追加" --dry-run --verbose

Claude経由での使用:
    claude "editorconfig lintを導入したい Issue を作って"
    claude "/issue/create ブロック破壊アニメーション追加"
EOF
    exit 0
}

# -----------------------------------------------------------------------------
# 引数解析
# -----------------------------------------------------------------------------

parse_arguments() {
    # デフォルト値
    REQUEST=""
    AI_GUIDANCE=""
    LABELS="ai-agent,task,execution-plan,auto-executable"
    ASSIGNEE="@me"
    DRY_RUN=false
    VERBOSE=false

    # 引数がない場合はヘルプ表示
    if [ $# -eq 0 ]; then
        usage
    fi

    # 引数解析
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -g|--guidance)
                AI_GUIDANCE="$2"
                shift 2
                ;;
            -l|--labels)
                LABELS="${LABELS},$2"
                shift 2
                ;;
            -a|--assignee)
                ASSIGNEE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -*)
                error "不明なオプション: $1"
                usage
                ;;
            *)
                if [ -z "$REQUEST" ]; then
                    REQUEST="$1"
                else
                    REQUEST="$REQUEST $1"
                fi
                shift
                ;;
        esac
    done

    # 必須引数チェック
    if [ -z "$REQUEST" ]; then
        error "要望文を指定してください"
        usage
    fi
}

# -----------------------------------------------------------------------------
# Issue データ構築
# -----------------------------------------------------------------------------

build_issue_data() {
    local request="$1"
    local ai_guidance="$2"

    # デバッグ出力
    if [ "$VERBOSE" = true ]; then
        debug "Building issue data for: $request"
        debug "AI Guidance: $ai_guidance"
    fi

    # Task ID生成
    local task_id
    task_id=$(generate_task_id "P0")

    # タイトル生成
    local title="[$task_id] $request"

    # 複雑度を常に自動推定
    local complexity
    complexity=$(estimate_complexity "$request")

    # AIガイダンス（指定がなければ自動推定）
    [ -z "$ai_guidance" ] && ai_guidance=$(estimate_ai_guidance "$request")

    # JSON形式でデータを返す
    cat << EOF
{
  "title": "$title",
  "task_id": "$task_id",
  "request": "$request",
  "complexity": "$complexity",
  "ai_guidance": "$ai_guidance",
  "labels": "$LABELS",
  "assignee": "$ASSIGNEE"
}
EOF
}

# -----------------------------------------------------------------------------
# Issue本文生成
# -----------------------------------------------------------------------------

generate_issue_body() {
    local issue_data="$1"

    # JSONからデータ抽出
    local task_id=$(echo "$issue_data" | jq -r '.task_id')
    local request=$(echo "$issue_data" | jq -r '.request')
    local complexity=$(echo "$issue_data" | jq -r '.complexity')
    local ai_guidance=$(echo "$issue_data" | jq -r '.ai_guidance')

    # 関連ドキュメント
    local context
    context=$(suggest_documentation "$request")

    # 実行ステップ
    local execution_steps
    execution_steps=$(generate_execution_steps "$request")

    # 成功条件
    local success_criteria
    success_criteria=$(generate_success_criteria "$request")

    # 検証コマンド
    local verification_commands
    verification_commands=$(generate_verification_commands)

    # Issue本文組み立て
    cat << EOF
## 🤖 AI Coding Agent自動実行タスク

このタスクはClaude Agentが \`claude "Issue #N を実装して"\` で自動実行できる構造化タスクです。

**実行コマンド**: \`claude "Issue #[番号] を実装して"\`

### Task ID
$task_id

### 実装複雑度
$complexity

### AI実装ガイダンスレベル
$ai_guidance

### 要望内容
$request

### AI実装コンテキスト
$context

### 実行ステップ（AI Agent自動実行用）
$execution_steps

### Acceptance Criteria（自動検証）
$success_criteria

### 自動実行コマンドシーケンス
\`\`\`bash
$verification_commands
\`\`\`

---
*このIssueは \`create-issue.sh\` により自動生成されました*
*生成日時: $(date -u +"%Y-%m-%d %H:%M:%S UTC")*
EOF
}

# -----------------------------------------------------------------------------
# 実行ステップ生成
# -----------------------------------------------------------------------------
generate_execution_steps() {
    local request=$1
    local steps=""

    steps+="## Phase 1: 調査・分析\n"
    steps+="1. 既存実装の確認\n"
    steps+="   - 参照: docs/reference/architecture/project-structure.md\n"
    steps+="2. 関連パターンの調査\n"
    steps+="   - 参照: docs/explanations/design-patterns/README.md\n\n"

    steps+="## Phase 2: 実装\n"

    if echo "$request" | grep -qiE "lint|format|editorconfig"; then
        steps+="1. 設定ファイルの作成・更新\n"
        steps+="2. package.jsonへのスクリプト追加\n"
        steps+="3. CI/CDパイプラインへの統合\n"
    elif echo "$request" | grep -qiE "test|テスト"; then
        steps+="1. テストファイルの作成\n"
        steps+="2. テストケースの実装\n"
        steps+="3. カバレッジ確認\n"
    else
        steps+="1. 必要なモジュールの作成\n"
        steps+="2. Effect-TSパターンでの実装\n"
        steps+="3. 既存コードとの統合\n"
    fi

    steps+="\n## Phase 3: 検証\n"
    steps+="1. TypeCheckの実行\n"
    steps+="2. Lintチェック\n"
    steps+="3. ビルド確認\n"
    steps+="4. 手動テスト（必要に応じて）"

    echo "$steps"
}

# -----------------------------------------------------------------------------
# 成功条件生成
# -----------------------------------------------------------------------------
generate_success_criteria() {
    local request=$1
    local criteria=""

    criteria+="## 必須条件\n"
    criteria+="- [ ] すべての型チェックがパス（\`pnpm typecheck\`）\n"
    criteria+="- [ ] Lintエラーなし（\`pnpm lint\`）\n"
    criteria+="- [ ] ビルド成功（\`pnpm build\`）\n\n"

    criteria+="## 機能要件\n"

    if echo "$request" | grep -qiE "lint|format|editorconfig"; then
        criteria+="- [ ] 設定ファイルが適切に配置されている\n"
        criteria+="- [ ] フォーマット/Lintルールが動作する\n"
        criteria+="- [ ] CI/CDで自動実行される\n"
    elif echo "$request" | grep -qiE "test|テスト"; then
        criteria+="- [ ] テストが正常に実行される\n"
        criteria+="- [ ] カバレッジ基準を満たす\n"
        criteria+="- [ ] エッジケースがカバーされている\n"
    else
        criteria+="- [ ] 要求された機能が実装されている\n"
        criteria+="- [ ] Effect-TSパターンに準拠している\n"
        criteria+="- [ ] 既存機能への影響がない\n"
    fi

    criteria+="\n## ドキュメント\n"
    criteria+="- [ ] 実装内容がドキュメント化されている（必要に応じて）\n"
    criteria+="- [ ] コードコメントが適切（複雑なロジックのみ）"

    echo "$criteria"
}

# -----------------------------------------------------------------------------
# 検証コマンド生成
# -----------------------------------------------------------------------------
generate_verification_commands() {
    cat << 'EOF'
# 基本検証コマンドシーケンス
pnpm typecheck    # TypeScript型チェック
pnpm lint         # Lintチェック
pnpm build        # ビルド確認

# テスト実行（存在する場合）
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    pnpm test
fi

# 開発サーバー起動確認
timeout 10 pnpm dev || true
EOF
}

# -----------------------------------------------------------------------------
# Issue作成
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
        info "インストール方法: brew install jq (macOS) または apt-get install jq (Linux)"
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
}

create_github_issue() {
    local issue_data="$1"

    # JSONからデータ抽出
    local title=$(echo "$issue_data" | jq -r '.title')
    local labels=$(echo "$issue_data" | jq -r '.labels')
    local assignee=$(echo "$issue_data" | jq -r '.assignee')

    # Issue本文生成
    local body
    body=$(generate_issue_body "$issue_data")

    if [ "$DRY_RUN" = true ]; then
        info "🔍 DRY RUNモード - 実際のIssue作成はスキップします"
        echo ""
        success "=== Issue Preview ==="
        echo "Title: $title"
        echo "Labels: $labels"
        echo "Assignee: $assignee"
        echo ""
        echo "Body:"
        echo "$body"
        echo "===================="
        return 0
    fi

    # GitHub Issue作成
    info "📤 GitHub Issue作成中..."
    local issue_url
    issue_url=$(gh issue create \
        --title "$title" \
        --body "$body" \
        --label "$labels" \
        --assignee "$assignee" \
        2>&1) || {
        error "Issue作成に失敗しました: $issue_url"
        exit 1
    }

    success "Issue作成完了！"
    echo -e "${COLOR_GREEN}$issue_url${COLOR_RESET}"

    # Issue番号を抽出
    local issue_number
    issue_number=$(echo "$issue_url" | grep -oE '[0-9]+$')

    if [ -n "$issue_number" ]; then
        echo ""
        info "次のステップ:"
        echo -e "  1. Issue確認: ${COLOR_CYAN}gh issue view $issue_number --web${COLOR_RESET}"
        echo -e "  2. 実装: ${COLOR_CYAN}claude \"Issue #$issue_number を実装して\"${COLOR_RESET}"
        echo -e "  3. PR作成: ${COLOR_CYAN}claude \"/pr/create $issue_number\"${COLOR_RESET}"
    fi
}

# -----------------------------------------------------------------------------
# メイン処理
# -----------------------------------------------------------------------------

main() {
    # 引数解析
    parse_arguments "$@"

    # 環境検証
    validate_environment

    # プログレス表示
    if [ "$CLAUDE_INTEGRATION" = true ]; then
        claude_progress 1 4 "要望を分析中..."
    else
        info "🔍 要望を分析中: \"$REQUEST\""
    fi

    # Issueデータ構築
    local issue_data
    issue_data=$(build_issue_data "$REQUEST" "$AI_GUIDANCE")

    if [ "$VERBOSE" = true ]; then
        debug "Issue data:"
        echo "$issue_data" | jq '.'
    fi

    # Task ID表示
    local task_id
    task_id=$(echo "$issue_data" | jq -r '.task_id')
    success "Task ID: $task_id"

    # 複雑度とガイダンス表示
    local complexity
    local ai_guidance
    complexity=$(echo "$issue_data" | jq -r '.complexity')
    ai_guidance=$(echo "$issue_data" | jq -r '.ai_guidance')

    info "複雑度: $complexity"
    info "AIガイダンス: $ai_guidance"

    # Issue作成
    if [ "$CLAUDE_INTEGRATION" = true ]; then
        claude_progress 2 4 "Issueを作成中..."
    fi

    create_github_issue "$issue_data"

    # 完了
    if [ "$CLAUDE_INTEGRATION" = true ]; then
        claude_progress 4 4 "完了！"
        claude_summary
    fi
}

# スクリプト実行
main "$@"