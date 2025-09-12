# Execution Plan - src/shared Refactoring

## 概要
`src/shared`配下のコードをEffect-TS準拠の型安全な実装に移行し、100%のテストカバレッジを達成する包括的なリファクタリング計画。

## 現状分析

### 問題点
1. **クラスの使用（4箇所）**
   - `ValidationError` (src/shared/utils/validation.ts)
   - `SystemError` (src/shared/utils/error-handling.ts)
   - `EntityError` (src/shared/utils/error-handling.ts)
   - `ValidationError` (src/shared/utils/error-handling.ts) ※重複定義

2. **型の曖昧性**
   - `any`の使用: 約70箇所
   - `unknown`の使用: 約150箇所
   - `as`によるキャスト: 約40箇所
   - 非nullアサーション(`!`): 検出なし

3. **ファイル命名規則の不整合**
   - 一部ファイルでケバブケースとキャメルケースが混在
   - `.d.ts`ファイルの配置が不適切

4. **未使用エクスポート**
   - エラークラスは内部でのみ使用されている
   - 多くのユーティリティ関数が未使用の可能性

## フェーズ1: 基盤整備（優先度: 高）

### 1.1 Effect-TS型定義の統一
```typescript
// 変更前
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E }

// 変更後
import * as Either from 'effect/Either'
export type Result<T, E = Error> = Either.Either<T, E>
```

### 1.2 エラークラスの関数型への移行
```typescript
// 変更前
export class ValidationError extends Error { ... }

// 変更後
import * as Data from 'effect/Data'

export interface ValidationError extends Data.Case {
  readonly _tag: 'ValidationError'
  readonly message: string
  readonly context?: ValidationContext
  readonly cause?: unknown
}

export const ValidationError = Data.tagged<ValidationError>('ValidationError')
```

### 1.3 ファイル構造の再編成
```
src/shared/
├── constants/
│   ├── index.ts
│   ├── performance.ts
│   ├── physics.ts
│   ├── texture.ts
│   ├── ui.ts
│   └── world.ts
├── decorators/           # 削除予定
├── types/
│   ├── index.ts
│   ├── common.ts
│   ├── game.ts
│   └── external.d.ts    # → src/@types/ に移動
├── utils/
│   ├── index.ts
│   ├── common.ts         # → functional.ts に改名
│   ├── effect.ts
│   ├── error.ts          # error-handling.ts から改名
│   ├── logging.ts
│   ├── math.ts
│   ├── monitoring.ts
│   ├── type-guards.ts
│   └── validation.ts
└── index.ts
```

## フェーズ2: 型安全性の強化（優先度: 高）

### 2.1 any/unknownの排除
```typescript
// 変更前
export function validate(validators: { [paramIndex: number]: (value: any) => boolean }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // ...
  }
}

// 変更後
import * as Schema from '@effect/schema/Schema'

export const createValidator = <A, I>(schema: Schema.Schema<A, I>) =>
  (value: I): Effect.Effect<A, ParseError> =>
    Schema.decodeUnknown(schema)(value)
```

### 2.2 型ガードのEffect-TS化
```typescript
// 変更前
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 変更後
import * as Predicate from 'effect/Predicate'
import * as Option from 'effect/Option'

export const isRecord = Predicate.isRecord

export const parseRecord = <T>(
  value: unknown,
  valueParser: (v: unknown) => Option.Option<T>
): Option.Option<Record<string, T>> =>
  pipe(
    value,
    Option.fromPredicate(isRecord),
    Option.flatMap(record =>
      // ... パース処理
    )
  )
```

## フェーズ3: デコレータの削除（優先度: 中）

### 3.1 パフォーマンスデコレータの移行
```typescript
// 変更前
@measureTime
public async processData() { ... }

// 変更後
import * as Effect from 'effect/Effect'
import * as Duration from 'effect/Duration'

export const withMeasurement = <R, E, A>(
  label: string,
  effect: Effect.Effect<R, E, A>
): Effect.Effect<R, E, A> =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const result = yield* effect
    const end = yield* Clock.currentTimeMillis
    yield* Console.log(`${label}: ${end - start}ms`)
    return result
  })
```

### 3.2 バリデーションデコレータの移行
```typescript
// 変更前
@validate({ 0: isNumber, 1: isString })
public processInput(num: number, str: string) { ... }

// 変更後
const processInputSchema = Schema.Struct({
  num: Schema.Number,
  str: Schema.String
})

export const processInput = (params: unknown) =>
  pipe(
    params,
    Schema.decodeUnknown(processInputSchema),
    Effect.flatMap(({ num, str }) => 
      // ... 処理
    )
  )
```

## フェーズ4: テスト戦略（優先度: 高）

### 4.1 テストファイル構造
```
tests/unit/shared/
├── constants/
│   ├── performance.test.ts
│   ├── physics.test.ts
│   ├── texture.test.ts
│   ├── ui.test.ts
│   └── world.test.ts
├── types/
│   ├── common.test.ts
│   └── game.test.ts
├── utils/
│   ├── functional.test.ts
│   ├── effect.test.ts
│   ├── error.test.ts
│   ├── logging.test.ts
│   ├── math.test.ts
│   ├── monitoring.test.ts
│   ├── type-guards.test.ts
│   └── validation.test.ts
└── integration/
    └── shared.integration.test.ts
```

### 4.2 テストカバレッジ目標
- 行カバレッジ: 100%
- 分岐カバレッジ: 100%
- 関数カバレッジ: 100%
- 文カバレッジ: 100%

### 4.3 テスト設定（vitest.config.ts）
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/shared/**/*.ts'],
      exclude: [
        'src/shared/**/*.d.ts',
        'src/shared/**/index.ts',
        'src/shared/types/external.d.ts'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    },
    include: ['tests/unit/shared/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
})
```

## フェーズ5: 実装詳細

### 5.1 utils/functional.ts（common.tsから改名）
```typescript
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import * as Array from 'effect/Array'
import * as Function from 'effect/Function'
import * as Stream from 'effect/Stream'

// 既存の関数をEffect-TS準拠に書き換え
export const chunk = Array.chunksOf
export const flatten = Array.flatten
export const unique = Array.dedupe
export const groupBy = Array.groupBy

// 新しいEffect準拠の関数
export const debounce = <R, E, A>(
  delay: Duration.Duration
) => (
  effect: Effect.Effect<R, E, A>
): Effect.Effect<R, E, A> =>
  // ... 実装

export const throttle = <R, E, A>(
  interval: Duration.Duration
) => (
  effect: Effect.Effect<R, E, A>
): Effect.Effect<R, E, A> =>
  // ... 実装

export const memoize = <Args extends ReadonlyArray<unknown>, R, E, A>(
  f: (...args: Args) => Effect.Effect<R, E, A>
): (...args: Args) => Effect.Effect<never, E, A> =>
  // ... 実装
```

### 5.2 utils/error.ts
```typescript
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Cause from 'effect/Cause'
import * as Exit from 'effect/Exit'

// タグ付きユニオンでエラーを定義
export type AppError = ValidationError | SystemError | EntityError

export interface ValidationError extends Data.Case {
  readonly _tag: 'ValidationError'
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}

export const ValidationError = Data.tagged<ValidationError>('ValidationError')

export interface SystemError extends Data.Case {
  readonly _tag: 'SystemError'
  readonly message: string
  readonly code?: string
  readonly cause?: Cause.Cause<unknown>
}

export const SystemError = Data.tagged<SystemError>('SystemError')

export interface EntityError extends Data.Case {
  readonly _tag: 'EntityError'
  readonly message: string
  readonly entityId: string
  readonly operation: string
}

export const EntityError = Data.tagged<EntityError>('EntityError')

// エラーハンドリングユーティリティ
export const withRetry = <R, E, A>(
  policy: Schedule.Schedule<R, E, unknown>
) => (
  effect: Effect.Effect<R, E, A>
): Effect.Effect<R, E, A> =>
  Effect.retry(effect, policy)

export const withFallback = <R, E, A, R2, E2>(
  fallback: Effect.Effect<R2, E2, A>
) => (
  effect: Effect.Effect<R, E, A>
): Effect.Effect<R | R2, E2, A> =>
  Effect.orElse(effect, () => fallback)
```

### 5.3 utils/validation.ts
```typescript
import * as Schema from '@effect/schema/Schema'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'

// Schema定義
export const PositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export const EntityIdSchema = Schema.String.pipe(
  Schema.brand('EntityId'),
  Schema.pattern(/^[a-zA-Z0-9-]+$/)
)

export const ComponentSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
)

// バリデーション関数
export const validate = <A, I>(schema: Schema.Schema<A, I>) =>
  (input: I): Effect.Effect<A, ParseError> =>
    Schema.decodeUnknown(schema)(input)

export const validateSync = <A, I>(schema: Schema.Schema<A, I>) =>
  (input: I): Either.Either<A, ParseError> =>
    Schema.decodeUnknownEither(schema)(input)

// チェーンバリデーション
export const createValidationPipeline = <A>() => {
  const validators: Array<(value: A) => Effect.Effect<A, ValidationError>> = []
  
  return {
    add: (validator: (value: A) => Effect.Effect<A, ValidationError>) => {
      validators.push(validator)
      return this
    },
    
    validate: (value: A): Effect.Effect<A, ValidationError> =>
      validators.reduce(
        (acc, validator) => Effect.flatMap(acc, validator),
        Effect.succeed(value)
      )
  }
}
```

## フェーズ6: テスト実装例

### 6.1 utils/functional.test.ts
```typescript
import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as TestClock from 'effect/TestClock'
import * as Duration from 'effect/Duration'
import * as F from '@shared/utils/functional'

describe('functional utilities', () => {
  describe('debounce', () => {
    it('should delay execution', async () => {
      const effect = Effect.sync(() => 'result')
      const debounced = F.debounce(Duration.millis(100))(effect)
      
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(debounced)
          yield* TestClock.adjust(Duration.millis(100))
          return yield* Fiber.join(fiber)
        })
      )
      
      expect(result).toBe('result')
    })
    
    it('should cancel previous execution on new call', async () => {
      // ... テスト実装
    })
  })
  
  describe('memoize', () => {
    it('should cache results', async () => {
      let callCount = 0
      const fn = (x: number) => Effect.sync(() => {
        callCount++
        return x * 2
      })
      
      const memoized = F.memoize(fn)
      
      const result1 = await Effect.runPromise(memoized(5))
      const result2 = await Effect.runPromise(memoized(5))
      
      expect(result1).toBe(10)
      expect(result2).toBe(10)
      expect(callCount).toBe(1)
    })
  })
})
```

### 6.2 utils/validation.test.ts
```typescript
import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as V from '@shared/utils/validation'

describe('validation', () => {
  describe('PositionSchema', () => {
    it('should validate valid position', () => {
      const position = { x: 1, y: 2, z: 3 }
      const result = V.validateSync(V.PositionSchema)(position)
      
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(position)
      }
    })
    
    it('should reject invalid position', () => {
      const invalid = { x: 'not a number', y: 2, z: 3 }
      const result = V.validateSync(V.PositionSchema)(invalid)
      
      expect(Either.isLeft(result)).toBe(true)
    })
  })
  
  describe('validation pipeline', () => {
    it('should chain validations', async () => {
      const pipeline = V.createValidationPipeline<number>()
        .add(n => n > 0 
          ? Effect.succeed(n) 
          : Effect.fail(V.ValidationError({ 
              _tag: 'ValidationError',
              message: 'Must be positive' 
            }))
        )
        .add(n => n < 100 
          ? Effect.succeed(n) 
          : Effect.fail(V.ValidationError({ 
              _tag: 'ValidationError',
              message: 'Must be less than 100' 
            }))
        )
      
      const valid = await Effect.runPromise(pipeline.validate(50))
      expect(valid).toBe(50)
      
      const invalid = await Effect.runPromiseExit(pipeline.validate(-1))
      expect(Exit.isFailure(invalid)).toBe(true)
    })
  })
})
```

## フェーズ7: 実装順序とタイムライン

### Week 1: 基盤整備
1. Effect-TS型定義の統一
2. エラークラスの関数型への移行
3. ファイル構造の再編成

### Week 2: 型安全性の強化
1. any/unknownの排除（utils/）
2. 型ガードのEffect-TS化
3. スキーマ定義の作成

### Week 3: デコレータの削除
1. パフォーマンスデコレータの移行
2. バリデーションデコレータの移行
3. 残りのデコレータの削除

### Week 4: テスト実装
1. ユニットテストの作成
2. インテグレーションテストの作成
3. カバレッジ100%の達成

## 成功指標

### コード品質
- [ ] すべてのクラスが関数型に移行完了
- [ ] any/unknown/asの使用が0
- [ ] すべてのファイルがEffect-TS準拠
- [ ] 命名規則の統一

### テスト
- [ ] 行カバレッジ100%
- [ ] 分岐カバレッジ100%
- [ ] 関数カバレッジ100%
- [ ] すべてのエッジケースがカバーされている

### パフォーマンス
- [ ] バンドルサイズが現状以下
- [ ] 実行速度が現状以上
- [ ] メモリ使用量が現状以下

## リスクと対策

### リスク1: 既存コードへの影響
**対策**: 段階的な移行とfeature flagの使用

### リスク2: 学習曲線
**対策**: Effect-TSのドキュメント作成とペアプログラミング

### リスク3: テスト工数
**対策**: Property-based testingの活用とテスト自動生成

## 次のステップ

1. このプランのレビューと承認
2. Effect-TSの依存関係の更新
3. フェーズ1の実装開始
4. 週次の進捗レビュー

---

## 付録: Effect-TSへの移行チートシート

### 基本的な変換パターン

```typescript
// Promise → Effect
const old = async (): Promise<string> => "result"
const new = (): Effect.Effect<string, never, never> => Effect.succeed("result")

// try-catch → Effect
const old = () => {
  try {
    return doSomething()
  } catch (e) {
    throw new Error("failed")
  }
}
const new = () => 
  pipe(
    Effect.try(() => doSomething()),
    Effect.mapError(() => new Error("failed"))
  )

// null/undefined チェック → Option
const old = (value: string | null) => value ?? "default"
const new = (value: string | null) => 
  pipe(
    Option.fromNullable(value),
    Option.getOrElse(() => "default")
  )
```
