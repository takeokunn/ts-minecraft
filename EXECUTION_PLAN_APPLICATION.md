# Application Layer Refactoring Execution Plan

## Executive Summary
Application層のリファクタリング実行計画書。Effect-TSへの完全準拠、型安全性の向上、命名規則の統一、未使用コードの削除、そして100%のテストカバレッジを目指す。

## Current State Analysis

### ✅ Positive Findings
- クラスベースの実装は存在しない（既に関数型）
- Effect-TSのパターンを既に採用
- Context.GenericTagとLayerパターンを使用
- @deprecatedコードは存在しない

### ⚠️ Issues to Address
1. **命名規則の不統一**
   - `.service.ts` (system-scheduler.service.ts)
   - `.use-case.ts` (player-move.use-case.ts)
   - 単純な `.ts` (queries.ts, ui-update.ts)

2. **型の厳密性**
   - 一部でanyやunknownの使用
   - Effect-TSの型パラメータが不完全な箇所

3. **未使用エクスポート**
   - queries/内の複数の実装ファイル
   - di/container.tsの一部

4. **テストカバレッジ**
   - 現在テストファイルが存在しない

## Execution Phases

### Phase 1: File Naming Standardization (並列実行可能)
**目的**: ファイル命名規則の統一

#### Task 1.1: Use Cases
```bash
# サブエージェント1で実行
mv player-move.use-case.ts player-move.usecase.ts
mv block-place.use-case.ts block-place.usecase.ts
mv chunk-load.use-case.ts chunk-load.usecase.ts
mv world-generate.use-case.ts world-generate.usecase.ts
```

#### Task 1.2: Services to Functions
```bash
# サブエージェント2で実行
mv system-scheduler.service.ts system-scheduler.ts
# 内部のServiceサフィックスも削除
```

#### Task 1.3: Handlers
```bash
# サブエージェント3で実行
mv command-handlers.ts command.handler.ts
mv query-handlers.ts query.handler.ts
```

### Phase 2: Type Strictness Enhancement (並列実行可能)

#### Task 2.1: Use Cases Type Enhancement
```typescript
// サブエージェント4で実行
// Before
Effect.Effect<void, ValidationError | SystemError, PlayerMoveUseCase>

// After
Effect.Effect<
  void,
  ValidationError | SystemExecutionError | EntityNotFoundError,
  PlayerMoveUseCaseService
>
```

#### Task 2.2: Query System Type Enhancement
```typescript
// サブエージェント5で実行
// queries/unified-query-system.ts
// 全てのanyをジェネリック型パラメータに置換
```

#### Task 2.3: Workflow Type Enhancement
```typescript
// サブエージェント6で実行
// workflows/内の全ファイル
// Effect-TSの型パラメータを完全に指定
```

### Phase 3: Unused Code Removal (順次実行)

#### Task 3.1: Analyze Dependencies
```bash
# メインエージェントで実行
# 依存関係グラフの作成
npx madge --circular src/application
```

#### Task 3.2: Remove Unused Query Implementations
```typescript
// サブエージェント7で実行
// 削除対象:
// - queries/optimized-query.ts (未使用)
// - queries/optimized-query-functional.ts (未使用)
// - queries/archetype-query.ts (未使用)
// - queries/cache.ts (直接使用されていない)
```

#### Task 3.3: Clean DI Container
```typescript
// サブエージェント8で実行
// di/container.tsから未使用のインポートと定義を削除
```

### Phase 4: Effect-TS Full Compliance (並列実行可能)

#### Task 4.1: Service Pattern Standardization
```typescript
// サブエージェント9で実行
// 全サービスを以下のパターンに統一:
export interface XxxService {
  readonly methodName: (params: T) => Effect.Effect<R, E, Dependencies>
}

export const XxxService = Context.GenericTag<XxxService>('XxxService')

export const XxxServiceLive = Layer.effect(
  XxxService,
  Effect.gen(function* () {
    // 依存性の取得
    const dep = yield* DependencyService
    
    return {
      methodName: (params) => Effect.gen(function* () {
        // 実装
      })
    } satisfies XxxService
  })
)
```

#### Task 4.2: Error Handling Standardization
```typescript
// サブエージェント10で実行
// 全てのエラーをタグ付きユニオン型に
export class ApplicationError extends Data.TaggedError<ApplicationError>(
  'ApplicationError'
) {
  constructor(
    readonly message: string,
    readonly cause?: unknown
  ) {
    super()
  }
}
```

#### Task 4.3: Pipeline Optimization
```typescript
// サブエージェント11で実行
// pipe使用箇所をEffect.genに統一
// Effect.flatMap, Effect.map連鎖をEffect.genに変換
```

### Phase 5: Test Implementation (並列実行可能)

#### Task 5.1: Unit Test Structure
```typescript
// サブエージェント12で実行
// tests/unit/application/構造作成
tests/unit/application/
├── use-cases/
│   ├── player-move.usecase.test.ts
│   ├── block-place.usecase.test.ts
│   ├── chunk-load.usecase.test.ts
│   └── world-generate.usecase.test.ts
├── handlers/
│   ├── command.handler.test.ts
│   └── query.handler.test.ts
├── workflows/
│   ├── ui-update.test.ts
│   ├── world-update.test.ts
│   ├── chunk-loading.test.ts
│   └── system-scheduler.test.ts
└── queries/
    ├── unified-query-system.test.ts
    └── query-utils.test.ts
```

#### Task 5.2: Test Implementation Template
```typescript
// サブエージェント13で実行
import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, TestContext, TestClock } from 'effect'
import { XxxService, XxxServiceLive } from '../xxx'

describe('XxxService', () => {
  const testEnv = TestContext.TestContext

  describe('methodName', () => {
    it('should handle success case', async () => {
      const program = Effect.gen(function* () {
        const service = yield* XxxService
        const result = yield* service.methodName(params)
        return result
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(XxxServiceLive),
          Effect.provide(testEnv)
        )
      )

      expect(result).toEqual(expected)
    })

    it('should handle error case', async () => {
      const program = Effect.gen(function* () {
        const service = yield* XxxService
        return yield* service.methodName(invalidParams)
      })

      await expect(
        Effect.runPromise(
          program.pipe(
            Effect.provide(XxxServiceLive),
            Effect.provide(testEnv)
          )
        )
      ).rejects.toThrow()
    })
  })
})
```

#### Task 5.3: Integration Tests
```typescript
// サブエージェント14で実行
// tests/integration/application/
// レイヤー統合テスト
describe('ApplicationLayer Integration', () => {
  it('should compose all layers correctly', async () => {
    const program = Effect.gen(function* () {
      const commandHandlers = yield* CommandHandlers
      const queryHandlers = yield* QueryHandlers
      // 統合テスト
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ApplicationLayer))
    )
  })
})
```

### Phase 6: Performance Optimization (順次実行)

#### Task 6.1: Query Cache Implementation
```typescript
// サブエージェント15で実行
// Effect-TSのCache機能を使用
import { Cache, Duration } from 'effect'

const queryCache = yield* Cache.make({
  capacity: 100,
  timeToLive: Duration.minutes(5),
  lookup: (key: string) => Effect.succeed(queryResult)
})
```

#### Task 6.2: Layer Composition Optimization
```typescript
// メインエージェントで実行
// 依存関係を分析し、最適な順序でLayerを合成
```

## Parallel Execution Matrix

| Phase | Tasks | Parallelizable | Dependencies |
|-------|-------|---------------|--------------|
| 1 | 1.1, 1.2, 1.3 | ✅ Yes | None |
| 2 | 2.1, 2.2, 2.3 | ✅ Yes | Phase 1 |
| 3 | 3.1, 3.2, 3.3 | ❌ No | Phase 2 |
| 4 | 4.1, 4.2, 4.3 | ✅ Yes | Phase 3 |
| 5 | 5.1, 5.2, 5.3 | ✅ Yes | Phase 4 |
| 6 | 6.1, 6.2 | ❌ No | Phase 5 |

## Vitest Configuration

```typescript
// vitest.application.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/application/**/*.ts'],
      exclude: [
        'src/application/**/*.test.ts',
        'src/application/**/index.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  },
  resolve: {
    alias: {
      '@application': path.resolve(__dirname, './src/application'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@shared': path.resolve(__dirname, './src/shared'),
    }
  }
})
```

## Success Metrics

1. **型安全性**: 100% - anyの使用ゼロ
2. **テストカバレッジ**: 100%
3. **命名規則準拠率**: 100%
4. **未使用コード**: 0行
5. **Effect-TS準拠率**: 100%
6. **ビルド時間**: 20%改善
7. **テスト実行時間**: < 5秒

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| Breaking Changes | 段階的な移行、各フェーズでのテスト実行 |
| Import Path Issues | tsconfig.jsonのパスマッピング更新 |
| Test Flakiness | TestContext使用、決定的なテスト |
| Performance Regression | ベンチマークテストの追加 |

## Execution Timeline

- **Phase 1**: 2時間 (並列実行)
- **Phase 2**: 3時間 (並列実行)
- **Phase 3**: 2時間 (順次実行)
- **Phase 4**: 4時間 (並列実行)
- **Phase 5**: 6時間 (並列実行)
- **Phase 6**: 2時間 (順次実行)

**Total**: 約19時間（並列実行により実質8-10時間）

## Commands for Validation

```bash
# Type checking
npm run tsc --project tsconfig.json

# Test execution
npm run test:application

# Coverage report
npm run test:application:coverage

# Circular dependency check
npx madge --circular src/application

# Bundle size analysis
npm run build:analyze
```

## Post-Refactoring Checklist

- [ ] 全ファイルの命名規則統一確認
- [ ] TypeScriptコンパイルエラーゼロ
- [ ] テストカバレッジ100%達成
- [ ] 未使用エクスポート削除確認
- [ ] Effect-TS型パラメータ完全指定
- [ ] ドキュメント更新
- [ ] パフォーマンステスト実施
- [ ] 統合テスト成功
- [ ] レビュー実施

## Notes

- サブエージェントによる並列実行を最大限活用
- 各フェーズ完了後に必ずテストを実行
- 破壊的変更は避け、段階的な移行を心がける
- Effect-TSのベストプラクティスに準拠
- 型安全性を最優先に考慮