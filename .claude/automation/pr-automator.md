# PR Automator - プルリクエスト自動化

## PR作成フロー

### 1. 実装前準備
```bash
# Issue確認
ISSUE_NUMBER=$1
ISSUE=$(gh issue view $ISSUE_NUMBER --json title,body,labels)

# ブランチ作成
BRANCH="feature/issue-$ISSUE_NUMBER"
git checkout -b $BRANCH

# コンテキスト設定
echo "$ISSUE" > .claude/current-issue.json
```

### 2. 実装ガイダンス

```typescript
export const implementIssue = (issueNumber: number) =>
  Effect.gen(function* () {
    const issue = yield* fetchIssue(issueNumber)

    // 実装計画生成
    const plan = yield* generateImplementationPlan(issue)

    // ファイル生成
    for (const file of plan.files) {
      yield* generateFile(file)
    }

    // テスト生成
    for (const test of plan.tests) {
      yield* generateTest(test)
    }

    // ドキュメント更新
    yield* updateDocumentation(plan.docs)

    return plan
  })
```

### 3. 品質チェック

```yaml
pre-commit:
  - typecheck: pnpm typecheck
  - lint: pnpm lint
  - test: pnpm test:unit
  - coverage: pnpm test:coverage

pre-push:
  - integration: pnpm test:integration
  - performance: pnpm bench
  - build: pnpm build
```

### 4. PR本文生成

```markdown
## 🚀 PR #{{PR_NUMBER}}: {{TITLE}}

Closes #{{ISSUE_NUMBER}}

### 📝 変更内容
{{CHANGES_SUMMARY}}

### 🎯 実装内容
- ✅ {{IMPLEMENTATION_1}}
- ✅ {{IMPLEMENTATION_2}}
- ✅ {{IMPLEMENTATION_3}}

### 📊 テスト結果
```
Coverage: {{COVERAGE}}%
Tests: {{PASSED}}/{{TOTAL}} passed
Performance: {{FPS}} FPS
Memory: {{MEMORY}} MB
```

### 📸 スクリーンショット
{{SCREENSHOTS}}

### ✅ チェックリスト
- [x] Effect-TSパターン適用
- [x] テストカバレッジ80%以上
- [x] パフォーマンス目標達成
- [x] ドキュメント更新
- [x] レビュー準備完了

### 🔗 関連
- Issue: #{{ISSUE_NUMBER}}
- Docs: {{DOC_LINKS}}
- Design: {{DESIGN_LINKS}}
```

## 自動レビュー

### コード品質チェック
```typescript
const reviewCode = (pr: PullRequest) =>
  Effect.gen(function* () {
    const checks = yield* Effect.all([
      checkEffectTSPatterns(pr),
      checkTestCoverage(pr),
      checkPerformance(pr),
      checkDocumentation(pr)
    ])

    return {
      approved: checks.every(c => c.passed),
      comments: checks.flatMap(c => c.comments),
      suggestions: generateSuggestions(checks)
    }
  })
```

### 自動修正提案
```typescript
const suggestFixes = (issues: Issue[]) =>
  issues.map(issue =>
    Match.value(issue.type).pipe(
      Match.when("missing-test", () => ({
        suggestion: "テスト追加",
        code: generateTest(issue.context)
      })),
      Match.when("pattern-violation", () => ({
        suggestion: "パターン修正",
        code: fixPattern(issue.context)
      })),
      Match.when("performance", () => ({
        suggestion: "最適化",
        code: optimizeCode(issue.context)
      })),
      Match.exhaustive
    )
  )
```

## CI/CD統合

```yaml
# .github/workflows/pr-automation.yml
name: PR Automation

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup
        run: pnpm install

      - name: Validate
        run: |
          pnpm typecheck
          pnpm lint
          pnpm test:unit

      - name: Coverage
        run: |
          pnpm test:coverage
          if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 80 ]; then
            echo "Coverage below 80%"
            exit 1
          fi

      - name: Performance
        run: |
          pnpm bench
          # Check 60 FPS maintained

      - name: Auto Review
        run: |
          claude review-pr ${{ github.event.pull_request.number }}

      - name: Comment
        uses: actions/github-script@v6
        with:
          script: |
            const review = require('./pr-review.json')
            github.rest.pulls.createReview({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
              body: review.comment,
              event: review.approved ? 'APPROVE' : 'REQUEST_CHANGES'
            })
```

## 実行コマンド

```bash
# Issue実装
claude implement-issue 123

# PR作成
claude create-pr 123

# 自動レビュー
claude review-pr 456

# 修正提案適用
claude apply-suggestions 456
```