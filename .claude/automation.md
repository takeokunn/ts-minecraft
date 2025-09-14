# 自動化システム
## Issue実装コマンド
### 基本パターン

```yaml
# Issue実装
issue_implement:
  pattern: "Issue #?(\d+).*実装"
  script: "claude 'Issue #$1を実装してください。GitHub Issueから仕様を確認し、Effect-TSパターンで実装してください'"

# Issue作成
phase_issue_create:
  pattern: "ROADMAP Phase (\d+).*Issue.*作成"
  script: "./scripts/create-phase-issues.sh $1"

# 品質チェック（GitHub Actions自動実行）
```

## GitHub Issue実行計画ベースフロー
### 1. Issue実行計画解析

**AI Task Issueテンプレート**（`.github/ISSUE_TEMPLATE/ai-task.yml`）を使用

```
GitHub Issueから自動抽出:
- [ ] 実行フェーズ設計（Phase 1, 2, 3...）
- [ ] AI実装コンテキスト（参照実装・技術制約）
- [ ] 成功基準（自動検証項目・性能基準）
- [ ] 検証コマンド（pnpm typecheck/test/lint/build）
- [ ] エラーハンドリング（よくある問題と対処法）
```

### 2. 実行計画に沿った自動実装

```
8段階実行ステップ（80分）:
Step 1: 事前調査・分析（10分） → 既存パターン検索
Step 2: ディレクトリ構造作成（5分） → src/domain/[feature]/
Step 3: 型定義・データ構造（15分） → Schema.Struct実装
Step 4: Service実装（20分） → Context.GenericTag/Layer.effect
Step 5: ECSシステム統合（15分） → 必要に応じて
Step 6: テスト実装（20分） → vitest/80%カバレッジ
Step 7: 統合・エクスポート（5分） → MainLayer統合
Step 8: 品質確認・最適化（10分） → 自動検証実行
```

### 3. Acceptance Criteria検証

```
Issue記載の完了条件を自動検証:
- [ ] Effect-TSパターンでの実装完了
- [ ] 指定されたテストケース全通過
- [ ] ドキュメント更新完了
- [ ] GitHub Actions品質ゲート通過
```

### 4. 実行計画完了報告

```
✅ Issue #123: 実行計画完了
📋 実行済み: Step 1✅ Step 2✅ Step 3✅ Step 4✅
📊 品質: GitHub Actions品質ゲート通過
🎯 Acceptance Criteria: 全項目達成
💡 次: PR作成・GitHub Actions実行
```
