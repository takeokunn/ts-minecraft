#!/bin/bash

# =============================================================================
# Claude Agent専用 Issue作成エントリーポイント
# Claude から直接実行されることを想定
# =============================================================================

set -euo pipefail

# スクリプトディレクトリ
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# -----------------------------------------------------------------------------
# メイン処理
# -----------------------------------------------------------------------------
main() {
    local request="$*"

    # 引数チェック
    if [ -z "$request" ]; then
        echo "❌ Error: 要望文を指定してください"
        echo "例: claude-issue.sh editorconfig lintを導入したい"
        exit 1
    fi

    # Issue作成スクリプトを実行
    "${SCRIPT_DIR}/create-issue.sh" "$request"

    # 成功時は次のステップを案内
    if [ $? -eq 0 ]; then
        echo ""
        echo "📝 次のステップ:"
        echo "1. 作成されたIssueを確認"
        echo "2. 'claude \"Issue #[番号] を実装して\"' で自動実装"
        echo "3. 実装完了後、'scripts/create-pr.sh [番号]' でPR作成"
    fi
}

# 実行
main "$@"