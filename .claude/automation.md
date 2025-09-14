# 自動化システム
## Issue実装コマンド

```yaml
# Issue実装
issue_implement:
  pattern: "Issue #?(\d+).*実装"
  script: "claude 'Issue #$1を実装してください'"

# Issue作成
phase_issue_create:
  pattern: "ROADMAP Phase (\d+).*Issue.*作成"
  script: "./scripts/create-phase-issues.sh $1"
```

## GitHub Issue実行フロー

**AI Task Issueテンプレート**（`.github/ISSUE_TEMPLATE/ai-task.yml`）参照

実装詳細は以下のドキュメントに定義:
- 実装ステップ: `docs/how-to/development/implementation-steps.md`
- 品質基準: `docs/reference/quality/acceptance-criteria.md`
- 検証手順: `docs/how-to/development/quality-checks.md`
