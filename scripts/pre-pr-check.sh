#!/bin/bash

# PR作成前の品質チェックスクリプト
# Usage: ./scripts/pre-pr-check.sh

set -e

echo "🔍 Pre-PR Quality Check"
echo "======================="
echo ""

# 結果追跡
PASSED=0
FAILED=0
WARNINGS=0

# 1. TypeScript チェック
echo "1️⃣  TypeScript Check..."
if pnpm typecheck > /dev/null 2>&1; then
    echo "   ✅ TypeScript: PASSED"
    ((PASSED++))
else
    echo "   ❌ TypeScript: FAILED"
    echo "   Run: pnpm typecheck"
    ((FAILED++))
fi

# 2. Lint チェック
echo "2️⃣  Lint Check..."
if pnpm lint > /dev/null 2>&1; then
    echo "   ✅ Lint: PASSED"
    ((PASSED++))
else
    echo "   ❌ Lint: FAILED"
    echo "   Run: pnpm lint:fix"
    ((FAILED++))
fi

# 3. Format チェック
echo "3️⃣  Format Check..."
if pnpm format:check > /dev/null 2>&1; then
    echo "   ✅ Format: PASSED"
    ((PASSED++))
else
    echo "   ⚠️  Format: WARNING"
    echo "   Run: pnpm format"
    ((WARNINGS++))
fi

# 4. テスト実行
echo "4️⃣  Test Execution..."
if pnpm test > /dev/null 2>&1; then
    echo "   ✅ Tests: PASSED"
    ((PASSED++))
else
    echo "   ❌ Tests: FAILED"
    echo "   Run: pnpm test"
    ((FAILED++))
fi

# 5. テストカバレッジ
echo "5️⃣  Test Coverage..."
COVERAGE_OUTPUT=$(pnpm test:coverage 2>/dev/null | grep "All files" | awk '{print $10}' | sed 's/%//')
if [ -n "$COVERAGE_OUTPUT" ]; then
    COVERAGE=${COVERAGE_OUTPUT%.*}
    if [ "$COVERAGE" -ge 80 ]; then
        echo "   ✅ Coverage: ${COVERAGE}% (Target: 80%+)"
        ((PASSED++))
    else
        echo "   ⚠️  Coverage: ${COVERAGE}% (Target: 80%+)"
        ((WARNINGS++))
    fi
else
    echo "   ⚠️  Coverage: Unable to calculate"
    ((WARNINGS++))
fi

# 6. ビルドチェック
echo "6️⃣  Build Check..."
if pnpm build > /dev/null 2>&1; then
    echo "   ✅ Build: PASSED"
    ((PASSED++))
else
    echo "   ❌ Build: FAILED"
    echo "   Run: pnpm build"
    ((FAILED++))
fi

# 7. ドキュメントチェック
echo "7️⃣  Documentation Check..."
DOCS_UPDATED=$(git diff --name-only HEAD^ HEAD 2>/dev/null | grep -c "^docs/" || echo "0")
if [ "$DOCS_UPDATED" -gt 0 ]; then
    echo "   ✅ Docs: Updated ($DOCS_UPDATED files)"
    ((PASSED++))
else
    echo "   ⚠️  Docs: No updates detected"
    echo "   Consider updating relevant documentation"
    ((WARNINGS++))
fi

# 8. コミットメッセージ確認
echo "8️⃣  Commit Message Check..."
LAST_COMMIT=$(git log -1 --pretty=%B)
if echo "$LAST_COMMIT" | grep -E "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)" > /dev/null; then
    echo "   ✅ Commit: Conventional format"
    ((PASSED++))
else
    echo "   ⚠️  Commit: Non-conventional format"
    echo "   Use format: type(scope): description [task-id]"
    ((WARNINGS++))
fi

# 9. ブランチ名確認
echo "9️⃣  Branch Name Check..."
BRANCH_NAME=$(git branch --show-current)
if echo "$BRANCH_NAME" | grep -E "^(feat|fix|docs|test|refactor|perf)/P[0-9]+-[0-9]+" > /dev/null; then
    echo "   ✅ Branch: Valid naming"
    ((PASSED++))
else
    echo "   ⚠️  Branch: Non-standard naming"
    echo "   Use format: type/task-id-description"
    ((WARNINGS++))
fi

# 10. ファイルサイズチェック
echo "🔟 File Size Check..."
LARGE_FILES=$(find src -type f -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 300 {print $2}' | head -5)
if [ -z "$LARGE_FILES" ]; then
    echo "   ✅ Files: All within size limits"
    ((PASSED++))
else
    echo "   ⚠️  Files: Some files exceed 300 lines"
    echo "$LARGE_FILES" | sed 's/^/      - /'
    ((WARNINGS++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Passed:   $PASSED"
echo "  ⚠️  Warnings: $WARNINGS"
echo "  ❌ Failed:   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All critical checks passed!"
    echo ""
    echo "📝 PR Checklist:"
    echo "  □ Link to Issue"
    echo "  □ Update PR description"
    echo "  □ Add screenshots (if UI changes)"
    echo "  □ Request reviewers"
    echo "  □ Add to project board"
    echo ""
    echo "Ready to create PR! 🚀"
    exit 0
else
    echo "❌ Please fix the failed checks before creating a PR"
    exit 1
fi