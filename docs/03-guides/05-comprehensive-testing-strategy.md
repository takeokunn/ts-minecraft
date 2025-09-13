# 包括的テスト戦略ガイド

このドキュメントでは、TypeScript MinecraftプロジェクトにおけるVitestを使用した包括的なテスト設計について詳述します。DDDアーキテクチャとEffect-TSパターンに基づき、単体テストから結合テストまで、カバレッジ100%を目指す実践的なアプローチを提供します。

## 目次

1. [テスト戦略概要](#テスト戦略概要)
2. [Flaky Test完全排除戦略](#flaky-test完全排除戦略)
3. [単体テスト設計](#単体テスト設計)
4. [Property-Based Testing (PBT)](#property-based-testing-pbt)
5. [結合テスト設計](#結合テスト設計)
6. [レイヤー別テストガイドライン](#レイヤー別テストガイドライン)
7. [カバレッジ戦略](#カバレッジ戦略)
8. [テスト実装のベストプラクティス](#テスト実装のベストプラクティス)

## テスト戦略概要

### 基本原則

1. **Flaky Testの完全排除** - 非決定的なテストは一切許容しない
2. **すべての関数に対応するテストを作成** - 1対1対応で網羅的にテスト
3. **Property-Based Testingの積極活用** - エッジケースの自動発見
4. **Effect-TSパターンの一貫使用** - 非同期処理とエラーハンドリングの統一
5. **レイヤー独立性の維持** - 各レイヤーを独立してテスト可能に
6. **高速なフィードバックループ** - 並列実行とインクリメンタルテスト

### テストピラミッド

```
         /\
        /  \  E2E Tests (5%)
       /----\
      /      \  Integration Tests (25%)
     /--------\
    /          \  Unit Tests (70%)
   /____________\
```

## Flaky Test完全排除戦略

### ゼロトレランスポリシー

**このプロジェクトではFlaky Test（非決定的で時々失敗するテスト）を一切許容しません。** すべてのテストは100%決定的で、同じ条件下では必ず同じ結果を返す必要があります。

### Flaky Testの主要な原因と対策

#### 1. タイミング依存の排除

```typescript
// ❌ 絶対に避けるべきパターン: 実時間への依存
describe('Animation Timer - FLAKY', () => {
  it('アニメーションが1秒後に完了する', async () => {
    const animation = startAnimation()
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(animation.isComplete).toBe(true) // タイミングによって失敗する可能性
  })
})

// ✅ 決定論的なパターン: テスト用の時間制御（最新API）
import { TestClock, TestServices, Duration } from 'effect'

describe('Animation Timer - DETERMINISTIC', () => {
  it('アニメーションが1秒後に完了する', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const animation = yield* startAnimation()

        // テスト用の時間を進める（実時間は経過しない）
        yield* TestClock.adjust(Duration.seconds(1))

        const isComplete = yield* animation.isComplete
        expect(isComplete).toBe(true)
      }).pipe(Effect.provide(TestServices))
    )
  })
})
```

#### 2. 非同期処理の完全制御

```typescript
// ❌ 絶対に避けるべきパターン: 非制御の非同期処理
describe('Concurrent Operations - FLAKY', () => {
  it('複数の非同期処理が完了する', async () => {
    const results: number[] = []

    // 実行順序が保証されない
    Promise.resolve(1).then(n => results.push(n))
    Promise.resolve(2).then(n => results.push(n))
    Promise.resolve(3).then(n => results.push(n))

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(results).toEqual([1, 2, 3]) // 順序が不定で失敗する可能性
  })
})

// ✅ 決定論的なパターン: Effect.allによる制御された並行処理
describe('Concurrent Operations - DETERMINISTIC', () => {
  it('複数の非同期処理が完了する', async () => {
    const program = Effect.gen(function* () {
      const results = yield* Effect.all(
        [Effect.succeed(1), Effect.succeed(2), Effect.succeed(3)],
        { concurrency: "unbounded" }
      )
      return results
    })

    const result = await Effect.runPromise(program)

    // Effect.allは常に入力順序を保持
    expect(result).toEqual([1, 2, 3])
  })

  it('エラーが発生しても決定的に処理される', async () => {
    const program = Effect.gen(function* () {
      const results = yield* Effect.allSettled([
        Effect.succeed(1),
        Effect.fail("error"),
        Effect.succeed(3)
      ])
      return results
    })

    const results = await Effect.runPromise(program)
    expect(results.map(Exit.isSuccess)).toEqual([true, false, true])
  })
})
```

#### 3. ランダム値の固定化

```typescript
// ❌ 絶対に避けるべきパターン: 制御されていない乱数
describe('Random Generation - FLAKY', () => {
  it('ランダムなアイテムを生成する', () => {
    const item = generateRandomItem()
    expect(item.rarity).toBe('legendary') // ランダムなので失敗する可能性
  })
})

// ✅ 決定論的なパターン: シード付き乱数生成器
import { Random } from 'effect'

describe('Random Generation - DETERMINISTIC', () => {
  it('シード付きランダムでアイテムを生成する', async () => {
    const program = Effect.gen(function* () {
      // 固定シードで初期化
      const random = yield* Random.Random
      const rng = Random.fromSeed(12345)

      const item = yield* generateItemWithRng(rng)
      return item
    })

    const item1 = await Effect.runPromise(program)
    const item2 = await Effect.runPromise(program)

    // 同じシードなら同じ結果
    expect(item1).toEqual(item2)
  })

  it('Property-Based Testingでも決定的に実行', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (seed) => {
          const rng1 = Random.fromSeed(seed)
          const rng2 = Random.fromSeed(seed)

          const value1 = Random.next(rng1)
          const value2 = Random.next(rng2)

          // 同じシードからは常に同じ値が生成される
          expect(value1).toBe(value2)
        }
      ),
      {
        seed: 42, // PBTも固定シードで実行
        numRuns: 1000, // 十分な回数でテスト
        verbose: false // 失敗時のみ詳細表示
      }
    )
  })
})
```

#### 4. 外部依存の完全モック化

```typescript
// ❌ 絶対に避けるべきパターン: 実際の外部サービスへの依存
describe('Network Request - FLAKY', () => {
  it('外部APIからデータを取得する', async () => {
    const response = await fetch('https://api.example.com/data')
    const data = await response.json()
    expect(data.status).toBe('success') // ネットワーク状態に依存
  })
})

// ✅ 決定論的なパターン: 完全にモック化された外部依存
describe('Network Request - DETERMINISTIC', () => {
  const createMockNetworkService = (responses: Map<string, any>) =>
    Layer.succeed(NetworkService, {
      fetch: (url: string) => {
        const response = responses.get(url)
        if (!response) {
          return Effect.fail(new NetworkError(`No mock for ${url}`))
        }
        return Effect.succeed(response)
      }
    })

  it('外部APIからデータを取得する', async () => {
    const mockResponses = new Map([
      ['https://api.example.com/data', { status: 'success', data: [1, 2, 3] }]
    ])

    const result = await Effect.runPromise(
      fetchExternalData('https://api.example.com/data').pipe(
        Effect.provide(createMockNetworkService(mockResponses))
      )
    )

    expect(result.status).toBe('success')
    expect(result.data).toEqual([1, 2, 3])
  })
})
```

#### 5. 環境依存の排除

```typescript
// ❌ 絶対に避けるべきパターン: 環境変数への直接依存
describe('Environment Config - FLAKY', () => {
  it('環境設定を読み込む', () => {
    const config = loadConfig()
    expect(config.apiUrl).toBe(process.env.API_URL) // 環境により異なる
  })
})

// ✅ 決定論的なパターン: 環境設定の注入
describe('Environment Config - DETERMINISTIC', () => {
  const createTestConfig = (overrides: Partial<Config> = {}): Layer.Layer<ConfigService> =>
    Layer.succeed(ConfigService, {
      getConfig: () => Effect.succeed({
        apiUrl: 'https://test.api.com',
        timeout: 5000,
        retryCount: 3,
        ...overrides
      })
    })

  it('環境設定を読み込む', async () => {
    const config = await Effect.runPromise(
      getApplicationConfig().pipe(
        Effect.provide(createTestConfig({ apiUrl: 'https://custom.api.com' }))
      )
    )

    expect(config.apiUrl).toBe('https://custom.api.com')
  })
})
```

#### 6. 並列テストの独立性保証

```typescript
// ❌ 絶対に避けるべきパターン: 共有状態への依存
let sharedCounter = 0

describe('Shared State - FLAKY', () => {
  it('カウンターを増加させる', () => {
    sharedCounter++
    expect(sharedCounter).toBe(1) // 他のテストの実行順序に依存
  })

  it('カウンターをリセットする', () => {
    sharedCounter = 0
    expect(sharedCounter).toBe(0) // 実行順序により失敗
  })
})

// ✅ 決定論的なパターン: 完全に独立したテスト
describe('Isolated State - DETERMINISTIC', () => {
  // 各テストで新しいインスタンスを作成
  const createCounter = () => ({ value: 0 })

  it('カウンターを増加させる', () => {
    const counter = createCounter()
    counter.value++
    expect(counter.value).toBe(1)
  })

  it('カウンターをリセットする', () => {
    const counter = createCounter()
    counter.value = 10
    counter.value = 0
    expect(counter.value).toBe(0)
  })

  // Property-Based Testでのカウンター操作テスト
  it('カウンター操作が決定的である', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 20 }),
        (operations) => {
          const counter = createCounter()
          let expected = 0

          operations.forEach(op => {
            counter.value += op
            expected += op
          })

          expect(counter.value).toBe(expected)
        }
      ),
      { seed: 789, numRuns: 500 }
    )
  })
})
```

### Flaky Test検出システム

```typescript
// test-utils/flaky-detector.ts
export class FlakyTestDetector {
  private static readonly ITERATION_COUNT = 100

  /**
   * テストを複数回実行してFlaky Testを検出
   */
  static async detectFlaky(
    testFn: () => Promise<void>,
    iterations: number = FlakyTestDetector.ITERATION_COUNT
  ): Promise<{
    isFlaky: boolean,
    failureRate: number,
    failures: Error[]
  }> {
    const failures: Error[] = []

    for (let i = 0; i < iterations; i++) {
      try {
        await testFn()
      } catch (error) {
        failures.push(error as Error)
      }
    }

    return {
      isFlaky: failures.length > 0 && failures.length < iterations,
      failureRate: failures.length / iterations,
      failures: failures.slice(0, 5) // 最初の5個のエラーのみ保持
    }
  }

  /**
   * テストスイート全体のFlaky Test検出
   */
  static async validateTestSuite(
    suite: TestSuite
  ): Promise<Map<string, FlakyTestResult>> {
    const results = new Map<string, FlakyTestResult>()

    for (const test of suite.tests) {
      const result = await this.detectFlaky(test.fn)
      if (result.isFlaky) {
        results.set(test.name, result)
      }
    }

    return results
  }
}

// CI/CDでの使用例
describe('Flaky Test Detection in CI', () => {
  it.skipIf(process.env.CI !== 'true')(
    'すべてのテストが決定的である',
    async () => {
      const suite = await loadTestSuite()
      const flakyTests = await FlakyTestDetector.validateTestSuite(suite)

      if (flakyTests.size > 0) {
        const report = Array.from(flakyTests.entries())
          .map(([name, result]) =>
            `${name}: ${result.failureRate * 100}% failure rate`
          )
          .join('\n')

        throw new Error(`Flaky tests detected:\n${report}`)
      }
    },
    { timeout: 60000 } // Flaky Test検出には時間がかかる
  )
})
```

### Flaky Test修正ガイドライン

```typescript
// test-utils/flaky-fixer.ts
export class FlakyTestFixer {
  /**
   * 一般的なFlaky Testパターンを検出して修正案を提示
   */
  static analyzeFlakyTest(testCode: string): FixSuggestion[] {
    const suggestions: FixSuggestion[] = []

    // setTimeout/setIntervalの検出
    if (testCode.includes('setTimeout') || testCode.includes('setInterval')) {
      suggestions.push({
        issue: 'Direct timer usage detected',
        solution: 'Use TestClock from Effect for deterministic time control',
        example: 'yield* TestClock.adjust("100 millis")'
      })
    }

    // Math.randomの検出
    if (testCode.includes('Math.random')) {
      suggestions.push({
        issue: 'Uncontrolled randomness detected',
        solution: 'Use seeded random generator from Effect',
        example: 'const rng = Random.fromSeed(12345)'
      })
    }

    // Date.nowの検出
    if (testCode.includes('Date.now') || testCode.includes('new Date()')) {
      suggestions.push({
        issue: 'System time dependency detected',
        solution: 'Inject clock service or use fixed timestamps',
        example: 'const fixedTime = new Date("2024-01-01T00:00:00Z")'
      })
    }

    // 実ネットワークリクエストの検出
    if (testCode.includes('fetch(') && !testCode.includes('mock')) {
      suggestions.push({
        issue: 'Potential real network request detected',
        solution: 'Use mocked network service',
        example: 'Effect.provide(MockNetworkService)'
      })
    }

    return suggestions
  }
}
```

### CI/CDでのFlaky Test防止

```yaml
# .github/workflows/test.yml
name: Test Suite with Flaky Detection

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        iteration: [1, 2, 3] # 各テストを3回実行

    steps:
      - uses: actions/checkout@v3

      - name: Run tests with flaky detection
        run: |
          pnpm test --reporter=json --outputFile=test-results-${{ matrix.iteration }}.json

      - name: Analyze test stability
        run: |
          node scripts/analyze-test-stability.js \
            test-results-1.json \
            test-results-2.json \
            test-results-3.json

      - name: Fail if flaky tests detected
        run: |
          if [ -f "flaky-tests.json" ]; then
            echo "❌ Flaky tests detected:"
            cat flaky-tests.json
            exit 1
          fi
```

### Flaky Test禁止の強制

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Flaky Test対策の設定
    retry: 0, // リトライは許可しない（Flaky Testを隠蔽しないため）
    testTimeout: 5000, // 短いタイムアウトで無限ループを防ぐ
    hookTimeout: 5000,
    isolate: true, // 各テストファイルを独立したプロセスで実行
    pool: 'forks', // プロセス分離で状態汚染を防ぐ
    poolOptions: {
      forks: {
        singleFork: false // 各テストを別プロセスで実行
      }
    },

    // カスタムレポーター
    reporters: [
      'default',
      ['./test-utils/flaky-reporter.ts'] // Flaky Test検出レポーター
    ],

    // グローバルセットアップ
    globalSetup: './test-utils/ensure-deterministic.ts'
  }
})
```

## 単体テスト設計

### 1. 関数単位のテスト構造

各関数に対して以下の観点でテストを作成：

```typescript
import { describe, it, expect } from 'vitest'
import { Effect, Exit, Either, Option } from 'effect'
import * as fc from '@effect/schema/FastCheck'
import { Schema } from '@effect/schema'

// テスト対象の関数
const calculateDamage = (
  attackPower: number,
  defense: number,
  criticalMultiplier: number = 1.0
): Effect.Effect<number, DamageCalculationError> =>
  Effect.gen(function* () {
    if (attackPower < 0 || defense < 0) {
      return yield* Effect.fail(new InvalidParameterError("Negative values not allowed"))
    }

    const baseDamage = Math.max(1, attackPower - defense)
    const finalDamage = Math.floor(baseDamage * criticalMultiplier)

    return yield* Effect.succeed(finalDamage)
  })

describe('calculateDamage', () => {
  // 1. 正常系テスト
  describe('正常系', () => {
    it('基本的なダメージ計算が正しく行われる', async () => {
      const result = await Effect.runPromise(
        calculateDamage(100, 30, 1.0)
      )
      expect(result).toBe(70)
    })

    it('防御力が攻撃力を上回る場合、最小ダメージ1を返す', async () => {
      const result = await Effect.runPromise(
        calculateDamage(30, 100, 1.0)
      )
      expect(result).toBe(1)
    })

    it('クリティカル倍率が適用される', async () => {
      const result = await Effect.runPromise(
        calculateDamage(100, 30, 2.0)
      )
      expect(result).toBe(140)
    })
  })

  // 2. 異常系テスト
  describe('異常系', () => {
    it('負の攻撃力でエラーを返す', async () => {
      const exit = await Effect.runPromiseExit(
        calculateDamage(-10, 30, 1.0)
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Exit.causeFailure(exit)
        expect(error).toBeInstanceOf(InvalidParameterError)
      }
    })

    it('負の防御力でエラーを返す', async () => {
      const exit = await Effect.runPromiseExit(
        calculateDamage(100, -30, 1.0)
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  // 3. 境界値テスト
  describe('境界値', () => {
    it('攻撃力0の場合', async () => {
      const result = await Effect.runPromise(
        calculateDamage(0, 0, 1.0)
      )
      expect(result).toBe(1) // 最小ダメージ
    })

    it('防御力0の場合', async () => {
      const result = await Effect.runPromise(
        calculateDamage(100, 0, 1.0)
      )
      expect(result).toBe(100)
    })

    it('最大値付近の計算', async () => {
      const result = await Effect.runPromise(
        calculateDamage(Number.MAX_SAFE_INTEGER - 1, 0, 1.0)
      )
      expect(result).toBe(Number.MAX_SAFE_INTEGER - 1)
    })
  })

  // 4. Property-Based Testing
  describe('Property-Based Tests', () => {
    it('ダメージは常に1以上である', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.float({ min: 0.1, max: 10.0 }),
          async (attack, defense, critical) => {
            const result = await Effect.runPromise(
              calculateDamage(attack, defense, critical)
            )
            expect(result).toBeGreaterThanOrEqual(1)
          }
        )
      )
    })

    it('クリティカル倍率が高いほどダメージが増加する', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 0, max: 500 }),
          fc.float({ min: 1.0, max: 2.0 }),
          fc.float({ min: 2.1, max: 5.0 }),
          async (attack, defense, critLow, critHigh) => {
            const [damageLow, damageHigh] = await Effect.runPromise(
              Effect.all([
                calculateDamage(attack, defense, critLow),
                calculateDamage(attack, defense, critHigh)
              ])
            )
            expect(damageHigh).toBeGreaterThanOrEqual(damageLow)
          }
        )
      )
    })

    it('防御力が増加するとダメージが減少する', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 51, max: 99 }),
          async (attack, defenseLow, defenseHigh) => {
            const [damageLow, damageHigh] = await Effect.runPromise(
              Effect.all([
                calculateDamage(attack, defenseLow, 1.0),
                calculateDamage(attack, defenseHigh, 1.0)
              ])
            )
            expect(damageLow).toBeGreaterThanOrEqual(damageHigh)
          }
        )
      )
    })
  })
})
```

### 2. Schema Validationのテスト

```typescript
import { Schema } from '@effect/schema'
import * as ParseResult from '@effect/schema/ParseResult'

// Schemaの定義
const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(36),
    Schema.brand("PlayerId")
  ),
  name: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(20),
    Schema.pattern(/^[a-zA-Z0-9_]+$/)
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite),
    y: Schema.Number.pipe(Schema.between(0, 256)),
    z: Schema.Number.pipe(Schema.finite)
  }),
  health: Schema.Number.pipe(
    Schema.between(0, 100),
    Schema.int
  ),
  inventory: Schema.Array(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.positive, Schema.int)
    })
  ).pipe(Schema.maxItems(36))
})

describe('PlayerSchema Validation', () => {
  describe('正常系バリデーション', () => {
    it('有効なプレイヤーデータを受け入れる', () => {
      const validPlayer = {
        id: "player_123",
        name: "Steve123",
        position: { x: 100, y: 64, z: -200 },
        health: 100,
        inventory: [
          { itemId: "minecraft:diamond", quantity: 5 }
        ]
      }

      const result = Schema.decodeUnknownSync(PlayerSchema)(validPlayer)
      expect(result).toEqual(validPlayer)
    })

    it('空のインベントリを許可する', () => {
      const playerWithEmptyInventory = {
        id: "player_456",
        name: "Alex",
        position: { x: 0, y: 128, z: 0 },
        health: 50,
        inventory: []
      }

      const result = Schema.decodeUnknownSync(PlayerSchema)(playerWithEmptyInventory)
      expect(result.inventory).toHaveLength(0)
    })
  })

  describe('異常系バリデーション', () => {
    it('無効な名前形式を拒否する', () => {
      const invalidNamePlayer = {
        id: "player_789",
        name: "Steve@123!", // 特殊文字を含む
        position: { x: 0, y: 64, z: 0 },
        health: 100,
        inventory: []
      }

      expect(() =>
        Schema.decodeUnknownSync(PlayerSchema)(invalidNamePlayer)
      ).toThrow()
    })

    it('範囲外のヘルスを拒否する', () => {
      const invalidHealthPlayer = {
        id: "player_999",
        name: "Steve",
        position: { x: 0, y: 64, z: 0 },
        health: 150, // 最大値を超える
        inventory: []
      }

      expect(() =>
        Schema.decodeUnknownSync(PlayerSchema)(invalidHealthPlayer)
      ).toThrow()
    })

    it('Y座標の範囲外を拒否する', () => {
      const invalidPositionPlayer = {
        id: "player_111",
        name: "Steve",
        position: { x: 0, y: 300, z: 0 }, // Y座標が256を超える
        health: 100,
        inventory: []
      }

      expect(() =>
        Schema.decodeUnknownSync(PlayerSchema)(invalidPositionPlayer)
      ).toThrow()
    })

    it('インベントリサイズ上限を超えるデータを拒否する', () => {
      const tooManyItems = Array.from({ length: 40 }, (_, i) => ({
        itemId: `item_${i}`,
        quantity: 1
      }))

      const invalidInventoryPlayer = {
        id: "player_222",
        name: "Steve",
        position: { x: 0, y: 64, z: 0 },
        health: 100,
        inventory: tooManyItems
      }

      expect(() =>
        Schema.decodeUnknownSync(PlayerSchema)(invalidInventoryPlayer)
      ).toThrow()
    })
  })

  describe('Property-Based Schema Testing', () => {
    const playerArbitrary = fc.record({
      id: fc.string({ minLength: 1, maxLength: 36 }),
      name: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
      position: fc.record({
        x: fc.float({ noNaN: true }),
        y: fc.float({ min: 0, max: 256, noNaN: true }),
        z: fc.float({ noNaN: true })
      }),
      health: fc.integer({ min: 0, max: 100 }),
      inventory: fc.array(
        fc.record({
          itemId: fc.string({ minLength: 1 }),
          quantity: fc.integer({ min: 1 })
        }),
        { maxLength: 36 }
      )
    })

    it('すべての生成されたプレイヤーデータが有効である', () => {
      fc.assert(
        fc.property(playerArbitrary, (player) => {
          const result = Effect.either(Schema.decodeUnknown(PlayerSchema)(player))
          expect(Either.isRight(result)).toBe(true)
        })
      )
    })

    it('エンコード・デコードのラウンドトリップが保持される', () => {
      fc.assert(
        fc.property(playerArbitrary, (player) => {
          const encoded = Schema.encodeSync(PlayerSchema)(
            Schema.decodeUnknownSync(PlayerSchema)(player)
          )
          const decoded = Schema.decodeUnknownSync(PlayerSchema)(encoded)

          expect(decoded).toEqual(Schema.decodeUnknownSync(PlayerSchema)(player))
        })
      )
    })
  })
})
```

### 3. Effect-TSサービスのテスト

```typescript
import { Context, Layer, Effect } from 'effect'
import { vi } from 'vitest'

// サービス定義
interface ChunkService {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkGenerationError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
}

const ChunkService = Context.GenericTag<ChunkService>("@app/ChunkService")

describe('ChunkService', () => {
  // モックサービスの作成
  const createMockChunkService = (
    overrides: Partial<ChunkService> = {}
  ): Layer.Layer<ChunkService> => {
    const defaultService: ChunkService = {
      loadChunk: vi.fn((coord) =>
        Effect.succeed(createMockChunk(coord))
      ),
      saveChunk: vi.fn(() =>
        Effect.succeed(undefined)
      ),
      generateChunk: vi.fn((coord) =>
        Effect.succeed(createMockChunk(coord))
      ),
      unloadChunk: vi.fn(() =>
        Effect.succeed(undefined)
      )
    }

    return Layer.succeed(ChunkService, {
      ...defaultService,
      ...overrides
    })
  }

  describe('loadChunk', () => {
    it('チャンクを正常にロードする', async () => {
      const mockLayer = createMockChunkService()
      const coord = { x: 0, z: 0 }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ChunkService
          return yield* service.loadChunk(coord)
        }).pipe(Effect.provide(mockLayer))
      )

      expect(result).toBeDefined()
      expect(result.coordinate).toEqual(coord)
    })

    it('存在しないチャンクでエラーを返す', async () => {
      const mockLayer = createMockChunkService({
        loadChunk: () => Effect.fail(new ChunkNotFoundError())
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const service = yield* ChunkService
          return yield* service.loadChunk({ x: 999, z: 999 })
        }).pipe(Effect.provide(mockLayer))
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('リトライロジックが正しく動作する', async () => {
      let attempts = 0
      const mockLayer = createMockChunkService({
        loadChunk: (coord) => {
          attempts++
          if (attempts < 3) {
            return Effect.fail(new TemporaryLoadError())
          }
          return Effect.succeed(createMockChunk(coord))
        }
      })

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ChunkService
          return yield* service.loadChunk({ x: 0, z: 0 }).pipe(
            Effect.retry(Schedule.recurs(2))
          )
        }).pipe(Effect.provide(mockLayer))
      )

      expect(attempts).toBe(3)
      expect(result).toBeDefined()
    })
  })

  describe('並行チャンクロード', () => {
    it('複数チャンクを並行してロードする', async () => {
      const loadedChunks: ChunkCoordinate[] = []
      const mockLayer = createMockChunkService({
        loadChunk: (coord) => {
          loadedChunks.push(coord)
          return Effect.delay(
            Effect.succeed(createMockChunk(coord)),
            "10 millis"
          )
        }
      })

      const coordinates = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 }
      ]

      const startTime = Date.now()
      const results = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ChunkService
          return yield* Effect.allPar(
            coordinates.map(coord => service.loadChunk(coord))
          )
        }).pipe(Effect.provide(mockLayer))
      )
      const duration = Date.now() - startTime

      expect(results).toHaveLength(4)
      expect(loadedChunks).toHaveLength(4)
      // 並行実行されているため、40ms未満で完了するはず
      expect(duration).toBeLessThan(40)
    })

    it('一部のチャンクロードが失敗しても他は成功する', async () => {
      const mockLayer = createMockChunkService({
        loadChunk: (coord) => {
          if (coord.x === 1 && coord.z === 1) {
            return Effect.fail(new ChunkCorruptedError())
          }
          return Effect.succeed(createMockChunk(coord))
        }
      })

      const coordinates = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 } // これは失敗する
      ]

      const results = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ChunkService
          return yield* Effect.allSettled(
            coordinates.map(coord => service.loadChunk(coord))
          )
        }).pipe(Effect.provide(mockLayer))
      )

      const successful = results.filter(Exit.isSuccess)
      const failed = results.filter(Exit.isFailure)

      expect(successful).toHaveLength(3)
      expect(failed).toHaveLength(1)
    })
  })
})
```

## Property-Based Testing (PBT)

### 1. 基本的なPBTパターン

```typescript
import * as fc from 'fast-check'
import { Arbitrary } from '@effect/schema/Arbitrary'
import { Schema } from '@effect/schema'

// カスタムArbitraryの定義
const blockTypeArbitrary = fc.oneof(
  fc.constant('air'),
  fc.constant('stone'),
  fc.constant('dirt'),
  fc.constant('grass'),
  fc.constant('water'),
  fc.constant('lava')
)

const blockPositionArbitrary = fc.record({
  x: fc.integer({ min: -30000000, max: 30000000 }),
  y: fc.integer({ min: 0, max: 256 }),
  z: fc.integer({ min: -30000000, max: 30000000 })
})

describe('Block System Properties', () => {
  describe('ブロック配置の性質', () => {
    it('同じ位置に2回ブロックを配置すると、最後のブロックが残る', () => {
      fc.assert(
        fc.property(
          blockPositionArbitrary,
          blockTypeArbitrary,
          blockTypeArbitrary,
          (position, type1, type2) => {
            const world = new WorldState()
            world.setBlock(position, type1)
            world.setBlock(position, type2)

            expect(world.getBlock(position)).toBe(type2)
          }
        )
      )
    })

    it('ブロックを配置して削除すると、元の状態に戻る', () => {
      fc.assert(
        fc.property(
          blockPositionArbitrary,
          blockTypeArbitrary,
          (position, blockType) => {
            const world = new WorldState()
            const originalBlock = world.getBlock(position)

            world.setBlock(position, blockType)
            world.removeBlock(position)

            expect(world.getBlock(position)).toBe(originalBlock)
          }
        )
      )
    })

    it('隣接ブロックの配置は互いに影響しない', () => {
      fc.assert(
        fc.property(
          blockPositionArbitrary,
          blockTypeArbitrary,
          blockTypeArbitrary,
          (basePos, type1, type2) => {
            const pos1 = basePos
            const pos2 = { ...basePos, x: basePos.x + 1 }

            const world = new WorldState()
            world.setBlock(pos1, type1)
            world.setBlock(pos2, type2)

            expect(world.getBlock(pos1)).toBe(type1)
            expect(world.getBlock(pos2)).toBe(type2)
          }
        )
      )
    })
  })

  describe('チャンクの性質', () => {
    it('チャンク内のすべてのブロックが正しい座標範囲内にある', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: -100, max: 100 }),
          (chunkX, chunkZ) => {
            const chunk = generateChunk(chunkX, chunkZ)
            const blocks = chunk.getAllBlocks()

            blocks.forEach(block => {
              const localX = block.position.x - chunkX * 16
              const localZ = block.position.z - chunkZ * 16

              expect(localX).toBeGreaterThanOrEqual(0)
              expect(localX).toBeLessThan(16)
              expect(localZ).toBeGreaterThanOrEqual(0)
              expect(localZ).toBeLessThan(16)
              expect(block.position.y).toBeGreaterThanOrEqual(0)
              expect(block.position.y).toBeLessThanOrEqual(256)
            })
          }
        )
      )
    })

    it('チャンクのシリアライズとデシリアライズが可逆である', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10, max: 10 }),
          fc.integer({ min: -10, max: 10 }),
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 15 }),
              y: fc.integer({ min: 0, max: 255 }),
              z: fc.integer({ min: 0, max: 15 }),
              type: blockTypeArbitrary
            }),
            { minLength: 0, maxLength: 100 }
          ),
          (chunkX, chunkZ, blocks) => {
            const originalChunk = new Chunk(chunkX, chunkZ)
            blocks.forEach(block => {
              originalChunk.setBlock(block.x, block.y, block.z, block.type)
            })

            const serialized = originalChunk.serialize()
            const deserialized = Chunk.deserialize(serialized)

            expect(deserialized.coordinate).toEqual(originalChunk.coordinate)
            blocks.forEach(block => {
              expect(deserialized.getBlock(block.x, block.y, block.z))
                .toBe(originalChunk.getBlock(block.x, block.y, block.z))
            })
          }
        )
      )
    })
  })
})
```

### 2. 複雑なドメインロジックのPBT

```typescript
describe('Inventory Management Properties', () => {
  const itemStackArbitrary = fc.record({
    itemId: fc.stringMatching(/^[a-z]+:[a-z_]+$/),
    quantity: fc.integer({ min: 1, max: 64 }),
    metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue))
  })

  const inventoryArbitrary = fc.array(
    itemStackArbitrary,
    { minLength: 0, maxLength: 36 }
  )

  describe('インベントリ操作の不変条件', () => {
    it('アイテムの追加と削除が可逆である', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary,
          itemStackArbitrary,
          (initialItems, newItem) => {
            const inventory = new Inventory()
            initialItems.forEach(item => inventory.addItem(item))

            const slotBefore = inventory.findEmptySlot()
            const added = inventory.addItem(newItem)

            if (added) {
              const removed = inventory.removeItem(newItem.itemId, newItem.quantity)
              expect(removed).toBe(newItem.quantity)
              expect(inventory.findEmptySlot()).toBe(slotBefore)
            }
          }
        )
      )
    })

    it('インベントリの総アイテム数が容量を超えない', () => {
      fc.assert(
        fc.property(
          fc.array(itemStackArbitrary, { minLength: 0, maxLength: 100 }),
          (items) => {
            const inventory = new Inventory(36) // 36スロット
            let addedCount = 0

            items.forEach(item => {
              if (inventory.addItem(item)) {
                addedCount++
              }
            })

            expect(inventory.getOccupiedSlots()).toBeLessThanOrEqual(36)
            expect(addedCount).toBeLessThanOrEqual(36)
          }
        )
      )
    })

    it('スタック可能なアイテムが正しくマージされる', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.array(
            fc.integer({ min: 1, max: 32 }),
            { minLength: 2, maxLength: 5 }
          ),
          (itemId, quantities) => {
            const inventory = new Inventory()
            const totalQuantity = quantities.reduce((sum, q) => sum + q, 0)

            quantities.forEach(quantity => {
              inventory.addItem({ itemId, quantity, stackSize: 64 })
            })

            const actualTotal = inventory.getItemCount(itemId)
            expect(actualTotal).toBe(Math.min(totalQuantity, 64 * 36))

            const stacks = inventory.getItemStacks(itemId)
            const fullStacks = Math.floor(actualTotal / 64)
            const remainder = actualTotal % 64

            expect(stacks.filter(s => s.quantity === 64)).toHaveLength(fullStacks)
            if (remainder > 0) {
              expect(stacks.find(s => s.quantity === remainder)).toBeDefined()
            }
          }
        )
      )
    })
  })

  describe('クラフティングシステムの性質', () => {
    const recipeArbitrary = fc.record({
      inputs: fc.array(
        fc.record({
          itemId: fc.string(),
          quantity: fc.integer({ min: 1, max: 9 })
        }),
        { minLength: 1, maxLength: 9 }
      ),
      output: fc.record({
        itemId: fc.string(),
        quantity: fc.integer({ min: 1, max: 64 })
      })
    })

    it('クラフティングは入力アイテムを消費し、出力アイテムを生成する', () => {
      fc.assert(
        fc.property(
          recipeArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (recipe, craftCount) => {
            const inventory = new Inventory()

            // 必要な材料を追加
            recipe.inputs.forEach(input => {
              inventory.addItem({
                itemId: input.itemId,
                quantity: input.quantity * craftCount
              })
            })

            // クラフティング実行
            for (let i = 0; i < craftCount; i++) {
              const result = inventory.craft(recipe)
              expect(result).toBeTruthy()
            }

            // 出力アイテムの確認
            const outputCount = inventory.getItemCount(recipe.output.itemId)
            expect(outputCount).toBe(recipe.output.quantity * craftCount)

            // 入力アイテムが消費されたことを確認
            recipe.inputs.forEach(input => {
              const remaining = inventory.getItemCount(input.itemId)
              expect(remaining).toBe(0)
            })
          }
        )
      )
    })

    it('材料不足の場合、クラフティングは失敗し、インベントリは変更されない', () => {
      fc.assert(
        fc.property(
          recipeArbitrary,
          inventoryArbitrary,
          (recipe, initialItems) => {
            const inventory = new Inventory()
            initialItems.forEach(item => inventory.addItem(item))

            const snapshotBefore = inventory.serialize()

            // 材料が不足している状態でクラフティング試行
            const hasAllMaterials = recipe.inputs.every(input =>
              inventory.getItemCount(input.itemId) >= input.quantity
            )

            if (!hasAllMaterials) {
              const result = inventory.craft(recipe)
              expect(result).toBeFalsy()

              const snapshotAfter = inventory.serialize()
              expect(snapshotAfter).toEqual(snapshotBefore)
            }
          }
        )
      )
    })
  })
})
```

### 3. 物理エンジンのPBT

```typescript
describe('Physics Engine Properties', () => {
  const vector3Arbitrary = fc.record({
    x: fc.float({ min: -1000, max: 1000, noNaN: true }),
    y: fc.float({ min: -1000, max: 1000, noNaN: true }),
    z: fc.float({ min: -1000, max: 1000, noNaN: true })
  })

  const entityArbitrary = fc.record({
    position: vector3Arbitrary,
    velocity: vector3Arbitrary,
    mass: fc.float({ min: 0.1, max: 1000, noNaN: true }),
    friction: fc.float({ min: 0, max: 1, noNaN: true })
  })

  describe('物理法則の保存', () => {
    it('重力による落下は一定の加速度を持つ', () => {
      fc.assert(
        fc.property(
          entityArbitrary,
          fc.float({ min: 0.1, max: 1, noNaN: true }),
          (entity, deltaTime) => {
            const gravity = -9.81
            const physics = new PhysicsEngine()

            const initialVelocityY = entity.velocity.y
            physics.applyGravity(entity, deltaTime)

            const expectedVelocityY = initialVelocityY + gravity * deltaTime
            expect(entity.velocity.y).toBeCloseTo(expectedVelocityY, 5)
          }
        )
      )
    })

    it('運動量保存の法則が成立する', () => {
      fc.assert(
        fc.property(
          entityArbitrary,
          entityArbitrary,
          (entity1, entity2) => {
            const physics = new PhysicsEngine()

            const totalMomentumBefore = {
              x: entity1.mass * entity1.velocity.x + entity2.mass * entity2.velocity.x,
              y: entity1.mass * entity1.velocity.y + entity2.mass * entity2.velocity.y,
              z: entity1.mass * entity1.velocity.z + entity2.mass * entity2.velocity.z
            }

            physics.resolveCollision(entity1, entity2)

            const totalMomentumAfter = {
              x: entity1.mass * entity1.velocity.x + entity2.mass * entity2.velocity.x,
              y: entity1.mass * entity1.velocity.y + entity2.mass * entity2.velocity.y,
              z: entity1.mass * entity1.velocity.z + entity2.mass * entity2.velocity.z
            }

            expect(totalMomentumAfter.x).toBeCloseTo(totalMomentumBefore.x, 3)
            expect(totalMomentumAfter.y).toBeCloseTo(totalMomentumBefore.y, 3)
            expect(totalMomentumAfter.z).toBeCloseTo(totalMomentumBefore.z, 3)
          }
        )
      )
    })

    it('摩擦により速度が減少するが、逆転しない', () => {
      fc.assert(
        fc.property(
          entityArbitrary,
          fc.float({ min: 0.01, max: 0.1, noNaN: true }),
          (entity, deltaTime) => {
            const physics = new PhysicsEngine()
            const initialVelocity = { ...entity.velocity }

            physics.applyFriction(entity, deltaTime)

            // 各軸で速度の符号が変わっていないことを確認
            if (initialVelocity.x !== 0) {
              expect(Math.sign(entity.velocity.x)).toBe(Math.sign(initialVelocity.x))
              expect(Math.abs(entity.velocity.x)).toBeLessThanOrEqual(Math.abs(initialVelocity.x))
            }

            if (initialVelocity.z !== 0) {
              expect(Math.sign(entity.velocity.z)).toBe(Math.sign(initialVelocity.z))
              expect(Math.abs(entity.velocity.z)).toBeLessThanOrEqual(Math.abs(initialVelocity.z))
            }
          }
        )
      )
    })
  })

  describe('衝突検出の性質', () => {
    const aabbArbitrary = fc.record({
      min: vector3Arbitrary,
      max: vector3Arbitrary
    }).filter(aabb =>
      aabb.min.x <= aabb.max.x &&
      aabb.min.y <= aabb.max.y &&
      aabb.min.z <= aabb.max.z
    )

    it('AABBの衝突判定は対称である', () => {
      fc.assert(
        fc.property(
          aabbArbitrary,
          aabbArbitrary,
          (aabb1, aabb2) => {
            const collision12 = checkAABBCollision(aabb1, aabb2)
            const collision21 = checkAABBCollision(aabb2, aabb1)

            expect(collision12).toBe(collision21)
          }
        )
      )
    })

    it('自身との衝突は常に真である', () => {
      fc.assert(
        fc.property(
          aabbArbitrary,
          (aabb) => {
            const collision = checkAABBCollision(aabb, aabb)
            expect(collision).toBe(true)
          }
        )
      )
    })

    it('包含関係にあるAABBは必ず衝突する', () => {
      fc.assert(
        fc.property(
          aabbArbitrary,
          fc.float({ min: 0.1, max: 0.9, noNaN: true }),
          (outerAABB, scale) => {
            const center = {
              x: (outerAABB.min.x + outerAABB.max.x) / 2,
              y: (outerAABB.min.y + outerAABB.max.y) / 2,
              z: (outerAABB.min.z + outerAABB.max.z) / 2
            }

            const halfSize = {
              x: (outerAABB.max.x - outerAABB.min.x) / 2 * scale,
              y: (outerAABB.max.y - outerAABB.min.y) / 2 * scale,
              z: (outerAABB.max.z - outerAABB.min.z) / 2 * scale
            }

            const innerAABB = {
              min: {
                x: center.x - halfSize.x,
                y: center.y - halfSize.y,
                z: center.z - halfSize.z
              },
              max: {
                x: center.x + halfSize.x,
                y: center.y + halfSize.y,
                z: center.z + halfSize.z
              }
            }

            expect(checkAABBCollision(outerAABB, innerAABB)).toBe(true)
          }
        )
      )
    })
  })
})
```

## 結合テスト設計

### 1. レイヤー間の結合テスト

```typescript
describe('Domain-Application Layer Integration', () => {
  // テスト用の完全なレイヤー構成
  const createTestLayers = () => {
    const domainLayer = Layer.mergeAll(
      WorldServiceLive,
      ChunkServiceLive,
      EntityServiceLive,
      PhysicsServiceLive
    )

    const applicationLayer = Layer.mergeAll(
      PlayerMovementUseCaseLive,
      BlockPlacementUseCaseLive,
      ChunkLoadingWorkflowLive
    ).pipe(Layer.provide(domainLayer))

    return applicationLayer
  }

  describe('プレイヤー移動ユースケース', () => {
    it('プレイヤーが移動すると関連するチャンクがロードされる', async () => {
      const testLayer = createTestLayers()

      const program = Effect.gen(function* () {
        const playerMovement = yield* PlayerMovementUseCase
        const chunkService = yield* ChunkService

        // 初期位置
        const startPosition = { x: 0, y: 64, z: 0 }
        const player = yield* playerMovement.spawnPlayer("player1", startPosition)

        // 遠距離への移動
        const newPosition = { x: 100, y: 64, z: 100 }
        yield* playerMovement.movePlayer(player.id, newPosition)

        // 新しい位置周辺のチャンクがロードされているか確認
        const chunkCoord = worldToChunkCoordinate(newPosition)
        const loadedChunks = yield* chunkService.getLoadedChunks()

        const expectedChunks = getChunksInRadius(chunkCoord, 3) // 視界距離3チャンク

        expectedChunks.forEach(coord => {
          expect(loadedChunks.some(c =>
            c.x === coord.x && c.z === coord.z
          )).toBe(true)
        })

        return loadedChunks.length
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBeGreaterThan(0)
    })

    it('プレイヤーが壁に向かって移動すると衝突判定が働く', async () => {
      const testLayer = createTestLayers()

      const program = Effect.gen(function* () {
        const playerMovement = yield* PlayerMovementUseCase
        const worldService = yield* WorldService

        // 壁を配置
        const wallPosition = { x: 10, y: 64, z: 0 }
        yield* worldService.setBlock(wallPosition, BlockType.Stone)

        // プレイヤーを壁の手前に配置
        const startPosition = { x: 8, y: 64, z: 0 }
        const player = yield* playerMovement.spawnPlayer("player1", startPosition)

        // 壁に向かって移動を試みる
        const targetPosition = { x: 11, y: 64, z: 0 }
        const result = yield* playerMovement.movePlayer(player.id, targetPosition)

        // プレイヤーは壁の手前で止まるはず
        const finalPosition = yield* playerMovement.getPlayerPosition(player.id)

        expect(finalPosition.x).toBeLessThan(wallPosition.x)
        expect(finalPosition.x).toBeGreaterThan(startPosition.x)

        return finalPosition
      })

      await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )
    })
  })

  describe('ブロック配置ユースケース', () => {
    it('ブロック配置により物理エンティティが影響を受ける', async () => {
      const testLayer = createTestLayers()

      const program = Effect.gen(function* () {
        const blockPlacement = yield* BlockPlacementUseCase
        const entityService = yield* EntityService
        const physicsService = yield* PhysicsService

        // 砂エンティティを空中に配置
        const sandEntity = yield* entityService.createEntity({
          type: EntityType.FallingSand,
          position: { x: 0, y: 10, z: 0 },
          velocity: { x: 0, y: 0, z: 0 }
        })

        // 砂の下に支えとなるブロックを配置
        const supportPosition = { x: 0, y: 5, z: 0 }
        yield* blockPlacement.placeBlock(supportPosition, BlockType.Stone)

        // 物理シミュレーションを実行
        for (let i = 0; i < 100; i++) {
          yield* physicsService.tick(0.05) // 50ms tick
        }

        // 砂エンティティは支えブロックの上で止まるはず
        const finalPosition = yield* entityService.getEntityPosition(sandEntity.id)

        expect(finalPosition.y).toBeGreaterThan(supportPosition.y)
        expect(finalPosition.y).toBeLessThan(supportPosition.y + 2)

        return finalPosition
      })

      await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )
    })

    it('水ブロックの配置により流体シミュレーションが開始される', async () => {
      const testLayer = createTestLayers()

      const program = Effect.gen(function* () {
        const blockPlacement = yield* BlockPlacementUseCase
        const worldService = yield* WorldService

        // 水源を配置
        const sourcePosition = { x: 0, y: 10, z: 0 }
        yield* blockPlacement.placeBlock(sourcePosition, BlockType.Water)

        // 流体シミュレーションのティック
        yield* Effect.sleep("100 millis")

        // 水が下方向に流れているか確認
        const belowPosition = { x: 0, y: 9, z: 0 }
        const belowBlock = yield* worldService.getBlock(belowPosition)

        expect(belowBlock.type).toBe(BlockType.Water)

        // 水平方向への拡散も確認
        const adjacentPositions = [
          { x: 1, y: 9, z: 0 },
          { x: -1, y: 9, z: 0 },
          { x: 0, y: 9, z: 1 },
          { x: 0, y: 9, z: -1 }
        ]

        const adjacentBlocks = yield* Effect.all(
          adjacentPositions.map(pos => worldService.getBlock(pos))
        )

        const waterCount = adjacentBlocks.filter(b => b.type === BlockType.Water).length
        expect(waterCount).toBeGreaterThan(0)

        return waterCount
      })

      await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )
    })
  })
})
```

### 2. エンドツーエンド統合テスト

```typescript
describe('End-to-End Game Scenarios', () => {
  // フルスタックのテスト環境
  const createFullTestEnvironment = () => {
    return Layer.mergeAll(
      // Infrastructure
      RenderingServiceTest,
      InputServiceTest,
      AudioServiceTest,
      NetworkServiceTest,
      StorageServiceTest,

      // Domain
      WorldServiceLive,
      EntityServiceLive,
      PhysicsServiceLive,

      // Application
      GameLoopServiceLive,
      SceneManagerServiceLive,

      // Presentation
      UIControllerLive,
      ViewModelServiceLive
    )
  }

  describe('ゲームセッション全体フロー', () => {
    it('ゲーム開始から終了までの完全なフロー', async () => {
      const testEnv = createFullTestEnvironment()

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        const sceneManager = yield* SceneManagerService
        const worldService = yield* WorldService

        // ゲーム開始
        yield* sceneManager.loadScene(SceneType.MainMenu)
        yield* sceneManager.transitionTo(SceneType.InGame)

        // ワールド生成
        const world = yield* worldService.generateWorld({
          seed: 12345,
          size: { x: 256, z: 256 },
          biomes: ['plains', 'forest', 'mountains']
        })

        // プレイヤーのスポーン
        const player = yield* gameLoop.spawnPlayer({
          name: "TestPlayer",
          position: world.spawnPoint
        })

        // ゲームループの実行（10秒間）
        const startTime = Date.now()
        while (Date.now() - startTime < 10000) {
          yield* gameLoop.tick(16) // 60 FPS
          yield* Effect.sleep("16 millis")
        }

        // セーブとクリーンアップ
        const saveData = yield* worldService.saveWorld()
        yield* sceneManager.transitionTo(SceneType.MainMenu)

        return {
          worldGenerated: world !== null,
          playerSpawned: player !== null,
          saveDataCreated: saveData !== null
        }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testEnv))
      )

      expect(result.worldGenerated).toBe(true)
      expect(result.playerSpawned).toBe(true)
      expect(result.saveDataCreated).toBe(true)
    })

    it('マルチプレイヤーセッションの同期', async () => {
      const testEnv = createFullTestEnvironment()

      const program = Effect.gen(function* () {
        const networkService = yield* NetworkService
        const gameLoop = yield* GameLoopService

        // ホストプレイヤーがセッションを作成
        const session = yield* networkService.createSession({
          maxPlayers: 4,
          gameMode: "survival"
        })

        // 他のプレイヤーが参加
        const player2 = yield* networkService.joinSession(session.id, {
          playerName: "Player2"
        })

        // 両プレイヤーの行動を同期
        const hostAction = gameLoop.performAction("player1", {
          type: "placeBlock",
          position: { x: 10, y: 64, z: 10 },
          blockType: BlockType.Stone
        })

        const clientAction = gameLoop.performAction("player2", {
          type: "breakBlock",
          position: { x: 10, y: 64, z: 11 }
        })

        yield* Effect.all([hostAction, clientAction], { concurrency: "unbounded" })

        // 同期状態の確認
        const hostWorldState = yield* gameLoop.getWorldState("player1")
        const clientWorldState = yield* gameLoop.getWorldState("player2")

        // 両プレイヤーで世界の状態が一致することを確認
        expect(hostWorldState.blocks).toEqual(clientWorldState.blocks)
        expect(hostWorldState.entities.length).toBe(clientWorldState.entities.length)

        return {
          sessionCreated: session !== null,
          playerJoined: player2 !== null,
          statesSynchronized: true
        }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testEnv))
      )

      expect(result.sessionCreated).toBe(true)
      expect(result.playerJoined).toBe(true)
      expect(result.statesSynchronized).toBe(true)
    })
  })

  describe('パフォーマンス要件の検証', () => {
    it('大規模ワールドでの60FPS維持', async () => {
      const testEnv = createFullTestEnvironment()

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        const worldService = yield* WorldService

        // 大規模ワールドの生成
        yield* worldService.generateWorld({
          seed: 99999,
          size: { x: 1024, z: 1024 },
          biomes: ['all']
        })

        // 多数のエンティティをスポーン
        for (let i = 0; i < 100; i++) {
          yield* gameLoop.spawnEntity({
            type: EntityType.Zombie,
            position: {
              x: Math.random() * 100,
              y: 64,
              z: Math.random() * 100
            }
          })
        }

        // フレームレート測定
        const frameTimes: number[] = []
        let lastFrameTime = Date.now()

        for (let frame = 0; frame < 600; frame++) { // 10秒間
          const frameStart = Date.now()
          yield* gameLoop.tick(16)

          const frameTime = Date.now() - frameStart
          frameTimes.push(frameTime)

          // 次のフレームまで待機
          const elapsed = Date.now() - lastFrameTime
          if (elapsed < 16) {
            yield* Effect.sleep(`${16 - elapsed} millis`)
          }
          lastFrameTime = Date.now()
        }

        // パフォーマンス統計
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
        const maxFrameTime = Math.max(...frameTimes)
        const droppedFrames = frameTimes.filter(t => t > 16.67).length

        return {
          averageFPS: 1000 / avgFrameTime,
          maxFrameTime,
          droppedFramesPercent: (droppedFrames / frameTimes.length) * 100
        }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testEnv))
      )

      expect(result.averageFPS).toBeGreaterThan(55) // 平均55FPS以上
      expect(result.maxFrameTime).toBeLessThan(33) // 最大フレーム時間33ms未満
      expect(result.droppedFramesPercent).toBeLessThan(5) // ドロップフレーム5%未満
    })

    it('メモリリークの検出', async () => {
      const testEnv = createFullTestEnvironment()

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        const memorySnapshots: number[] = []

        // メモリ使用量の記録
        const recordMemory = () => {
          if (typeof process !== 'undefined' && process.memoryUsage) {
            memorySnapshots.push(process.memoryUsage().heapUsed)
          }
        }

        // 繰り返しチャンクのロード/アンロード
        for (let cycle = 0; cycle < 100; cycle++) {
          // チャンクロード
          for (let x = 0; x < 10; x++) {
            for (let z = 0; z < 10; z++) {
              yield* gameLoop.loadChunk({ x: x + cycle * 10, z })
            }
          }

          // チャンクアンロード
          for (let x = 0; x < 10; x++) {
            for (let z = 0; z < 10; z++) {
              yield* gameLoop.unloadChunk({ x: x + cycle * 10, z })
            }
          }

          // ガベージコレクションの実行を促す
          if (global.gc) {
            global.gc()
          }

          recordMemory()
        }

        // メモリ使用量の増加傾向を分析
        const firstHalf = memorySnapshots.slice(0, 50)
        const secondHalf = memorySnapshots.slice(50)

        const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        const memoryGrowthPercent = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100

        return {
          initialMemory: memorySnapshots[0],
          finalMemory: memorySnapshots[memorySnapshots.length - 1],
          memoryGrowthPercent
        }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testEnv))
      )

      // メモリ増加が10%未満であることを確認
      expect(result.memoryGrowthPercent).toBeLessThan(10)
    })
  })
})
```

## レイヤー別テストガイドライン

### Domain Layer テスト

```typescript
// domain/entities/player.test.ts
describe('Player Entity', () => {
  describe('Value Objects', () => {
    it('PlayerIdは一意性を保証する', () => {
      const id1 = PlayerId.generate()
      const id2 = PlayerId.generate()
      expect(id1).not.toBe(id2)
    })

    it('Healthは0-100の範囲を維持する', () => {
      expect(() => Health.create(-1)).toThrow()
      expect(() => Health.create(101)).toThrow()
      expect(Health.create(50).value).toBe(50)
    })
  })

  describe('Business Rules', () => {
    it('ダメージを受けるとヘルスが減少する', () => {
      const player = Player.create({
        id: PlayerId.generate(),
        name: "TestPlayer",
        health: Health.create(100)
      })

      const damaged = player.takeDamage(30)
      expect(damaged.health.value).toBe(70)
    })

    it('致死ダメージで死亡状態になる', () => {
      const player = Player.create({
        id: PlayerId.generate(),
        name: "TestPlayer",
        health: Health.create(20)
      })

      const result = player.takeDamage(25)
      expect(result.isDead).toBe(true)
      expect(result.health.value).toBe(0)
    })
  })
})
```

### Application Layer テスト

```typescript
// application/use-cases/player-movement.test.ts
describe('PlayerMovementUseCase', () => {
  const createMockDependencies = () => ({
    playerRepository: {
      findById: vi.fn(),
      save: vi.fn()
    },
    worldService: {
      checkCollision: vi.fn(),
      getChunkAt: vi.fn()
    },
    eventBus: {
      publish: vi.fn()
    }
  })

  it('有効な移動を処理する', async () => {
    const deps = createMockDependencies()
    const useCase = new PlayerMovementUseCase(deps)

    deps.playerRepository.findById.mockResolvedValue(mockPlayer)
    deps.worldService.checkCollision.mockResolvedValue(false)

    const result = await useCase.execute({
      playerId: "player1",
      targetPosition: { x: 10, y: 64, z: 10 }
    })

    expect(result.success).toBe(true)
    expect(deps.playerRepository.save).toHaveBeenCalled()
    expect(deps.eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PlayerMoved" })
    )
  })

  it('衝突がある場合は移動を拒否する', async () => {
    const deps = createMockDependencies()
    const useCase = new PlayerMovementUseCase(deps)

    deps.worldService.checkCollision.mockResolvedValue(true)

    const result = await useCase.execute({
      playerId: "player1",
      targetPosition: { x: 10, y: 64, z: 10 }
    })

    expect(result.success).toBe(false)
    expect(deps.playerRepository.save).not.toHaveBeenCalled()
  })
})
```

### Infrastructure Layer テスト

```typescript
// infrastructure/repositories/indexed-db-player-repository.test.ts
describe('IndexedDBPlayerRepository', () => {
  let repository: IndexedDBPlayerRepository

  beforeEach(async () => {
    // In-memory IndexedDB for testing
    repository = new IndexedDBPlayerRepository()
    await repository.initialize()
  })

  afterEach(async () => {
    await repository.clear()
  })

  it('プレイヤーの保存と取得', async () => {
    const player = createMockPlayer()

    await repository.save(player)
    const retrieved = await repository.findById(player.id)

    expect(retrieved).toEqual(player)
  })

  it('存在しないプレイヤーの取得でnullを返す', async () => {
    const result = await repository.findById("non-existent")
    expect(result).toBeNull()
  })

  it('複数プレイヤーの一括取得', async () => {
    const players = [
      createMockPlayer({ id: "1" }),
      createMockPlayer({ id: "2" }),
      createMockPlayer({ id: "3" })
    ]

    await Promise.all(players.map(p => repository.save(p)))
    const retrieved = await repository.findAll()

    expect(retrieved).toHaveLength(3)
    expect(retrieved.map(p => p.id)).toEqual(["1", "2", "3"])
  })
})
```

### Presentation Layer テスト

```typescript
// presentation/controllers/game-controller.test.ts
describe('GameController', () => {
  it('ユーザー入力をアプリケーション層に伝達する', async () => {
    const mockUseCase = {
      execute: vi.fn().mockResolvedValue({ success: true })
    }

    const controller = new GameController({
      playerMovementUseCase: mockUseCase
    })

    await controller.handleKeyPress({ key: 'W' })

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'forward'
      })
    )
  })

  it('エラーを適切にUIに伝播する', async () => {
    const mockUseCase = {
      execute: vi.fn().mockRejectedValue(new Error("Network error"))
    }

    const mockUI = {
      showError: vi.fn()
    }

    const controller = new GameController({
      playerMovementUseCase: mockUseCase,
      uiService: mockUI
    })

    await controller.handleKeyPress({ key: 'W' })

    expect(mockUI.showError).toHaveBeenCalledWith("Network error")
  })
})
```

## カバレッジ戦略

### 1. カバレッジ目標設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test-utils/**',
        '**/mocks/**'
      ],
      include: [
        'src/**/*.ts'
      ]
    }
  }
})
```

### 2. カバレッジ分析と改善

```typescript
// test-utils/coverage-helper.ts
export class CoverageAnalyzer {
  /**
   * 未テストのコードパスを特定
   */
  static findUncoveredPaths(coverageReport: CoverageReport): UncoveredPath[] {
    const uncovered: UncoveredPath[] = []

    for (const file of coverageReport.files) {
      // 未カバーの行
      file.lines.forEach((line, index) => {
        if (line.count === 0) {
          uncovered.push({
            file: file.path,
            line: index + 1,
            type: 'statement'
          })
        }
      })

      // 未カバーの分岐
      file.branches.forEach(branch => {
        if (!branch.covered) {
          uncovered.push({
            file: file.path,
            line: branch.line,
            type: 'branch',
            condition: branch.condition
          })
        }
      })
    }

    return uncovered
  }

  /**
   * テストケース生成の提案
   */
  static suggestTestCases(uncoveredPaths: UncoveredPath[]): TestSuggestion[] {
    return uncoveredPaths.map(path => {
      if (path.type === 'branch') {
        return {
          description: `Test ${path.condition} condition at line ${path.line}`,
          template: generateBranchTestTemplate(path)
        }
      }

      return {
        description: `Cover statement at line ${path.line}`,
        template: generateStatementTestTemplate(path)
      }
    })
  }
}
```

### 3. Mutation Testing

```typescript
// mutation-testing.config.ts
export default {
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts'
  ],
  mutators: [
    'ConditionalExpression',
    'LogicalOperator',
    'ArithmeticOperator',
    'BlockStatement',
    'BooleanLiteral'
  ],
  testRunner: 'vitest',
  thresholds: {
    high: 90,
    low: 70,
    break: 60
  }
}

// 使用例
describe('Mutation Testing', () => {
  it('すべてのミュータントを検出する', async () => {
    const result = await runMutationTesting({
      targetFile: 'src/domain/entities/player.ts',
      testFile: 'src/domain/entities/player.test.ts'
    })

    expect(result.killedMutants / result.totalMutants).toBeGreaterThan(0.9)
  })
})
```

## テスト実装のベストプラクティス

### 1. テストの構造化

```typescript
// テストの標準構造
describe('[Layer]/[Module]/[Component]', () => {
  // Arrange - 準備
  let testSubject: ComponentUnderTest
  let dependencies: MockDependencies

  beforeEach(() => {
    // 各テスト前の初期化
    dependencies = createMockDependencies()
    testSubject = new ComponentUnderTest(dependencies)
  })

  afterEach(() => {
    // クリーンアップ
    vi.clearAllMocks()
  })

  describe('[機能/メソッド名]', () => {
    describe('正常系', () => {
      it('[期待される動作の説明]', async () => {
        // Arrange
        const input = createValidInput()

        // Act
        const result = await testSubject.process(input)

        // Assert
        expect(result).toMatchObject({
          success: true,
          data: expect.any(Object)
        })
      })
    })

    describe('異常系', () => {
      it('[エラー条件と期待される動作]', async () => {
        // Arrange
        const invalidInput = createInvalidInput()

        // Act & Assert
        await expect(testSubject.process(invalidInput))
          .rejects.toThrow(ValidationError)
      })
    })

    describe('境界値', () => {
      it.each([
        { input: MIN_VALUE, expected: MIN_RESULT },
        { input: MAX_VALUE, expected: MAX_RESULT },
        { input: ZERO, expected: ZERO_RESULT }
      ])('$input の場合、$expected を返す', async ({ input, expected }) => {
        const result = await testSubject.process(input)
        expect(result).toBe(expected)
      })
    })
  })
})
```

### 2. テストユーティリティ

```typescript
// test-utils/builders.ts
export class TestDataBuilder {
  static player(overrides: Partial<Player> = {}): Player {
    return {
      id: faker.datatype.uuid(),
      name: faker.internet.userName(),
      position: { x: 0, y: 64, z: 0 },
      health: 100,
      inventory: [],
      ...overrides
    }
  }

  static chunk(x: number = 0, z: number = 0): Chunk {
    return {
      coordinate: { x, z },
      blocks: generateRandomBlocks(),
      entities: [],
      lastModified: Date.now()
    }
  }

  static withItems(player: Player, items: Item[]): Player {
    return {
      ...player,
      inventory: [...player.inventory, ...items]
    }
  }
}

// test-utils/assertions.ts
export const customMatchers = {
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max
    return {
      pass,
      message: () =>
        `Expected ${received} to be within range [${min}, ${max}]`
    }
  },

  toHaveValidStructure(received: any, schema: Schema.Schema<any>) {
    const result = Effect.either(Schema.decodeUnknown(schema)(received))
    return {
      pass: Either.isRight(result),
      message: () =>
        Either.isLeft(result)
          ? `Validation failed: ${result.left}`
          : 'Structure is valid'
    }
  }
}

// 使用
expect.extend(customMatchers)
```

### 3. 非同期テストのパターン

```typescript
// test-utils/async-helpers.ts
export class AsyncTestHelper {
  /**
   * タイムアウト付きの条件待機
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(`Condition not met within ${timeout}ms`)
  }

  /**
   * イベントの発生を待機
   */
  static async waitForEvent<T>(
    eventEmitter: EventEmitter,
    eventName: string,
    timeout: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event '${eventName}' not received within ${timeout}ms`))
      }, timeout)

      eventEmitter.once(eventName, (data: T) => {
        clearTimeout(timer)
        resolve(data)
      })
    })
  }

  /**
   * 並行実行のテスト
   */
  static async testConcurrency<T>(
    operations: Array<() => Promise<T>>,
    expectedConcurrency: number
  ): Promise<{
    results: T[],
    maxConcurrent: number,
    totalTime: number
  }> {
    let currentConcurrent = 0
    let maxConcurrent = 0
    const startTime = Date.now()

    const wrappedOperations = operations.map(op => async () => {
      currentConcurrent++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)

      try {
        return await op()
      } finally {
        currentConcurrent--
      }
    })

    const results = await Promise.all(
      wrappedOperations.map(op => op())
    )

    return {
      results,
      maxConcurrent,
      totalTime: Date.now() - startTime
    }
  }
}

// 使用例
describe('Async Operations', () => {
  it('イベントが正しく発生する', async () => {
    const emitter = new EventEmitter()

    setTimeout(() => {
      emitter.emit('ready', { status: 'ok' })
    }, 100)

    const event = await AsyncTestHelper.waitForEvent(emitter, 'ready')
    expect(event).toEqual({ status: 'ok' })
  })

  it('並行実行数が制限される', async () => {
    const operations = Array.from({ length: 10 }, (_, i) =>
      () => delay(100).then(() => i)
    )

    const result = await AsyncTestHelper.testConcurrency(operations, 3)
    expect(result.maxConcurrent).toBeLessThanOrEqual(3)
  })
})
```

### 4. パフォーマンステスト

```typescript
// test-utils/performance.ts
export class PerformanceTestHelper {
  /**
   * 実行時間の測定
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T>,
    iterations: number = 1
  ): Promise<{
    result: T,
    averageTime: number,
    minTime: number,
    maxTime: number,
    times: number[]
  }> {
    const times: number[] = []
    let result: T

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      result = await fn()
      const end = performance.now()
      times.push(end - start)
    }

    return {
      result: result!,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      times
    }
  }

  /**
   * メモリ使用量の測定
   */
  static async measureMemoryUsage<T>(
    fn: () => Promise<T>
  ): Promise<{
    result: T,
    memoryDelta: number
  }> {
    if (typeof global.gc === 'function') {
      global.gc()
    }

    const before = process.memoryUsage().heapUsed
    const result = await fn()
    const after = process.memoryUsage().heapUsed

    return {
      result,
      memoryDelta: after - before
    }
  }

  /**
   * スループットの測定
   */
  static async measureThroughput(
    fn: () => Promise<void>,
    duration: number = 1000
  ): Promise<{
    operations: number,
    opsPerSecond: number
  }> {
    const startTime = Date.now()
    let operations = 0

    while (Date.now() - startTime < duration) {
      await fn()
      operations++
    }

    const actualDuration = (Date.now() - startTime) / 1000

    return {
      operations,
      opsPerSecond: operations / actualDuration
    }
  }
}

// 使用例
describe('Performance Requirements', () => {
  it('チャンク生成が100ms以内に完了する', async () => {
    const { averageTime } = await PerformanceTestHelper.measureExecutionTime(
      () => generateChunk(0, 0),
      10
    )

    expect(averageTime).toBeLessThan(100)
  })

  it('1秒間に1000回以上の衝突判定が可能', async () => {
    const { opsPerSecond } = await PerformanceTestHelper.measureThroughput(
      () => checkCollision(entity1, entity2)
    )

    expect(opsPerSecond).toBeGreaterThan(1000)
  })
})
```

## まとめ

このドキュメントでは、TypeScript MinecraftプロジェクトにおけるVitestを使用した包括的なテスト戦略を提供しました。

### 重要なポイント

1. **カバレッジ100%の達成**
   - すべての関数に対応するテストを作成
   - Property-Based Testingでエッジケースを網羅
   - Mutation Testingでテストの品質を保証

2. **Effect-TSパターンの活用**
   - 非同期処理の統一的な扱い
   - 型安全なエラーハンドリング
   - Layerを使用した依存性注入

3. **レイヤー別のテスト戦略**
   - 各レイヤーの責務に応じたテスト設計
   - モックとスタブの適切な使用
   - 統合テストでの実際の動作検証

4. **継続的な品質向上**
   - カバレッジレポートの定期的な分析
   - パフォーマンステストによる性能保証
   - テストコードのリファクタリング

このガイドラインに従うことで、高品質で保守性の高いテストスイートを構築し、プロジェクトの長期的な成功を支えることができます。