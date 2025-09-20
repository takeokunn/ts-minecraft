#!/bin/bash
set -euo pipefail

# CI状態確認スクリプト
# Usage: ./scripts/check-ci.sh [PR番号] [--fix]

# カラー出力用の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PR番号の取得
PR_NUMBER="${1:-}"
FIX_MODE="${2:-}"

# PR番号が指定されていない場合は最新のPRを取得
if [ -z "$PR_NUMBER" ]; then
    PR_NUMBER=$(gh pr list --author @me --limit 1 --json number --jq '.[0].number' 2>/dev/null || echo "")
    if [ -z "$PR_NUMBER" ]; then
        echo -e "${RED}❌ PRが見つかりません。先にPRを作成してください。${NC}"
        exit 1
    fi
    echo -e "${BLUE}ℹ️  最新のPR #$PR_NUMBER を確認します${NC}"
fi

echo -e "${BLUE}🔍 PR #$PR_NUMBER のCI状態を確認中...${NC}"
echo ""

# CI状態の詳細を取得
echo "📊 CI実行状況:"
gh pr checks "$PR_NUMBER" --interval 0 2>/dev/null | while IFS=$'\t' read -r name status conclusion; do
    if [ -n "$name" ] && [ "$name" != "NAME" ]; then
        case "$conclusion" in
            "success")
                echo -e "  ${GREEN}✅ $name${NC}"
                ;;
            "failure")
                echo -e "  ${RED}❌ $name${NC}"
                ;;
            "skipped")
                echo -e "  ${YELLOW}⏭️  $name (スキップ)${NC}"
                ;;
            *)
                if [ "$status" = "IN_PROGRESS" ] || [ "$status" = "QUEUED" ]; then
                    echo -e "  ${YELLOW}⏳ $name (実行中)${NC}"
                else
                    echo -e "  ❓ $name ($status)${NC}"
                fi
                ;;
        esac
    fi
done

echo ""

# 全体のCI状態を確認
ALL_PASSED=$(gh pr checks "$PR_NUMBER" --json status,conclusion --jq '
    if all(.[] | .status == "COMPLETED") then
        if all(.[] | .conclusion == "SUCCESS" or .conclusion == "SKIPPED") then
            "true"
        else
            "false"
        end
    else
        "pending"
    end
' 2>/dev/null || echo "error")

case "$ALL_PASSED" in
    "true")
        echo -e "${GREEN}✅ 全てのCIチェックが成功しました！${NC}"
        echo ""
        PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq .url)
        echo -e "${GREEN}🎉 PRはマージ可能です: $PR_URL${NC}"
        ;;
    "false")
        echo -e "${RED}❌ CIチェックに失敗しています${NC}"
        echo ""

        # 失敗したジョブの詳細を表示
        echo "📋 失敗したチェック:"
        gh pr checks "$PR_NUMBER" --json name,conclusion,detailsUrl --jq '.[] | select(.conclusion == "FAILURE") | "  - \(.name): \(.detailsUrl)"' 2>/dev/null || true

        # 自動修正モード
        if [ "$FIX_MODE" = "--fix" ]; then
            echo ""
            echo -e "${YELLOW}🔧 自動修正を試みます...${NC}"

            # よくある問題の自動修正
            echo "  1. コードフォーマット修正..."
            pnpm format 2>/dev/null || true

            echo "  2. Lint修正..."
            pnpm lint:fix 2>/dev/null || true

            echo "  3. 型エラー確認..."
            pnpm typecheck 2>/dev/null || true

            # 変更があれば自動コミット
            if [ -n "$(git status --porcelain)" ]; then
                echo ""
                echo -e "${YELLOW}📝 修正をコミット中...${NC}"
                git add .
                git commit -m "fix: CI検証エラーの自動修正

- コードフォーマット修正
- Lintエラー修正
- 型エラー対応" 2>/dev/null || true

                echo -e "${BLUE}📤 修正をプッシュ中...${NC}"
                git push

                echo ""
                echo -e "${GREEN}✅ 修正をプッシュしました。CIが再実行されます。${NC}"
            else
                echo ""
                echo -e "${YELLOW}ℹ️  自動修正可能な問題は見つかりませんでした。${NC}"
                echo "手動での修正が必要です。"
            fi
        else
            echo ""
            echo -e "${YELLOW}💡 ヒント:${NC}"
            echo "  • 自動修正を試すには: ./scripts/check-ci.sh $PR_NUMBER --fix"
            echo "  • ローカルで検証: pnpm typecheck && pnpm lint && pnpm build"
            echo "  • 詳細ログ確認: gh run view"
        fi
        exit 1
        ;;
    "pending")
        echo -e "${YELLOW}⏳ CIは実行中です${NC}"
        echo ""
        echo "完了まで待機するには:"
        echo "  gh pr checks $PR_NUMBER --watch"
        ;;
    *)
        echo -e "${RED}❌ CI状態の取得に失敗しました${NC}"
        exit 1
        ;;
esac

# PR情報の表示
echo ""
echo "📌 PR情報:"
gh pr view "$PR_NUMBER" --json title,state,mergeable,mergeStateStatus --jq '
    "  タイトル: \(.title)
  状態: \(.state)
  マージ可能: \(.mergeable)
  マージ状態: \(.mergeStateStatus)"
' 2>/dev/null || echo "  情報取得失敗"