# Quality Gates - 品質ゲート自動化

## 段階的品質保証

### Level 1: 構文チェック（即座）
```yaml
syntax:
  - typescript: strict mode
  - imports: 循環参照なし
  - naming: camelCase/PascalCase
  time: < 1s
```

### Level 2: 静的解析（高速）
```yaml
static:
  - effect-ts: 95%+ 採用率
  - classes: 0 (Data.Class除く)
  - async-await: 0
  - any-type: 0
  time: < 10s
```

### Level 3: テスト実行（中速）
```yaml
test:
  - unit: 全テスト成功
  - coverage: 80%+
  - pbt: 不変条件検証
  time: < 30s
```

### Level 4: パフォーマンス（低速）
```yaml
performance:
  - fps: 60 維持
  - memory: < 2GB
  - chunk-load: < 100ms
  time: < 60s
```

## 自動修正機能

### パターン違反の自動修正
```typescript
export const autoFix = (code: string) =>
  pipe(
    code,
    // クラス → 関数変換
    replaceClasses,
    // async/await → Effect.gen
    convertAsyncToEffect,
    // any → unknown
    replaceAnyTypes,
    // interface → Schema.Struct
    convertInterfaces,
    // format
    prettier.format
  )
```

### テスト自動生成
```typescript
export const generateTests = (service: Service) =>
  Effect.gen(function* () {
    // ユニットテスト
    const unitTest = generateUnitTest(service)

    // PBTテスト
    const pbtTest = generatePropertyTest(service)

    // パフォーマンステスト
    const perfTest = generatePerformanceTest(service)

    return {
      [`${service.name}.test.ts`]: unitTest,
      [`${service.name}.pbt.test.ts`]: pbtTest,
      [`${service.name}.perf.test.ts`]: perfTest
    }
  })
```

## CI統合

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  level1-syntax:
    runs-on: ubuntu-latest
    timeout-minutes: 1
    steps:
      - uses: actions/checkout@v3
      - run: pnpm typecheck

  level2-static:
    needs: level1-syntax
    timeout-minutes: 2
    steps:
      - run: |
          pnpm lint
          node .claude/scripts/check-patterns.js

  level3-test:
    needs: level2-static
    timeout-minutes: 5
    steps:
      - run: |
          pnpm test:unit
          pnpm test:coverage

  level4-performance:
    needs: level3-test
    timeout-minutes: 10
    steps:
      - run: |
          pnpm bench
          pnpm memory-check
```

## メトリクス追跡

### ダッシュボード指標
```typescript
export const metrics = {
  codeQuality: {
    effectTSAdoption: calculateEffectTSPercentage(),
    testCoverage: getCoverageReport(),
    codeComplexity: calculateCyclomaticComplexity(),
    duplicateCode: findDuplicates()
  },

  performance: {
    fps: measureFrameRate(),
    memory: getMemoryUsage(),
    loadTime: measureLoadTime(),
    renderTime: measureRenderTime()
  },

  productivity: {
    issuesCompleted: getCompletedIssues(),
    prMerged: getMergedPRs(),
    avgReviewTime: calculateAverageReviewTime(),
    bugRate: calculateBugRate()
  }
}
```

### トレンド分析
```typescript
export const analyzeTrends = (metrics: Metrics[]) => ({
  improving: metrics.filter(m => m.trend === "up"),
  degrading: metrics.filter(m => m.trend === "down"),
  stable: metrics.filter(m => m.trend === "stable"),

  alerts: generateAlerts(metrics),
  recommendations: generateRecommendations(metrics)
})
```

## 実行コマンド

```bash
# 品質チェック
claude check-quality

# 自動修正
claude auto-fix src/

# メトリクス表示
claude show-metrics

# トレンド分析
claude analyze-trends --days 30
```