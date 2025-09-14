# Issue Generator - GitHub Issue自動生成

## Issue生成パイプライン

### 1. コンテキスト収集
```typescript
const collectContext = (taskId: string) => ({
  docs: findRelatedDocs(taskId),
  patterns: findSimilarImplementations(taskId),
  dependencies: findDependencies(taskId),
  tests: findTestPatterns(taskId)
})
```

### 2. Issue本文生成

```markdown
## 🎯 {{TASK_NAME}}

### 概要
- ID: `{{PHASE}}-{{NUMBER}}`
- サイズ: `{{SIZE}}`
- 推定: `{{HOURS}}h`
- タイプ: `{{TYPE}}`

### 実装仕様
```typescript
// 既存パターンから自動生成
{{GENERATED_INTERFACE}}
```

### 実装手順
1. {{STEP_1}} - 参考: `{{REFERENCE_FILE_1}}`
2. {{STEP_2}} - 参考: `{{REFERENCE_FILE_2}}`
3. {{STEP_3}} - パターン: `{{PATTERN_NAME}}`

### テスト要件
- [ ] 単体テスト - カバレッジ80%+
- [ ] PBTテスト - 不変条件{{INVARIANT}}
- [ ] パフォーマンス - {{PERFORMANCE_TARGET}}

### 依存関係
- ブロック: {{BLOCKERS}}
- 並行可能: {{PARALLEL_TASKS}}

### 参考実装
```typescript
// 類似実装から抽出
{{SIMILAR_IMPLEMENTATION}}
```

### チェックリスト
- [ ] Effect-TSパターン適用
- [ ] Schema.Struct型定義
- [ ] エラーハンドリング
- [ ] ドキュメント更新
- [ ] レビュー準備
```

## 自動化スクリプト

```typescript
export const generateIssue = (task: Task) =>
  Effect.gen(function* () {
    // コンテキスト収集
    const context = yield* collectContext(task.id)

    // 仕様生成
    const spec = yield* generateSpec(task, context)

    // 実装手順生成
    const steps = yield* generateSteps(task, context.patterns)

    // Issue作成
    const issue = {
      title: formatTitle(task),
      body: renderTemplate({
        task,
        spec,
        steps,
        context
      }),
      labels: generateLabels(task),
      milestone: getCurrentSprint(),
      assignees: []
    }

    // GitHub API呼び出し
    return yield* createGitHubIssue(issue)
  })
```

## バッチ生成

```bash
#!/bin/bash
# generate-sprint-issues.sh

SPRINT=$1
PHASE=$2

# ROADMAPから抽出
TASKS=$(claude "Extract tasks for Sprint $SPRINT Phase $PHASE")

# Issue生成
for TASK in $TASKS; do
  ISSUE=$(claude "Generate issue for task: $TASK")

  # GitHub作成
  gh issue create \
    --title "$ISSUE.title" \
    --body "$ISSUE.body" \
    --label "sprint-$SPRINT,phase-$PHASE" \
    --milestone "Sprint $SPRINT"
done
```

## インテリジェント機能

### 類似実装の検索
```typescript
const findSimilarImplementations = (task: Task) =>
  Effect.gen(function* () {
    // パターンマッチング
    const patterns = yield* searchPatterns(task.type)

    // スコアリング
    const scored = patterns.map(p => ({
      pattern: p,
      score: calculateSimilarity(task, p)
    }))

    // 上位3件返却
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.pattern)
  })
```

### 依存関係の自動検出
```typescript
const findDependencies = (task: Task) =>
  Effect.gen(function* () {
    // インポート解析
    const imports = yield* analyzeImports(task.targetFile)

    // サービス依存
    const services = imports
      .filter(i => i.includes("Service"))
      .map(i => extractServiceName(i))

    // 未実装チェック
    const unimplemented = yield* checkUnimplemented(services)

    return {
      blockers: unimplemented,
      dependencies: services
    }
  })
```

## 実行例

```bash
# 単一Issue生成
claude "GameLoopServiceのIssueを生成"

# Sprint分生成
claude "Sprint 1のIssueを全て生成"

# 依存関係考慮
claude "ChunkSystemのIssueを依存関係含めて生成"
```