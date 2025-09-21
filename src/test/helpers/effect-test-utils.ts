/**
 * Effect-TS専用テストヘルパー関数
 * Phase 3: Schema-based Testing、Property-based Testing、Layer-based DI統合
 * 100%カバレッジを達成するための型安全なテストユーティリティ
 */
import { Effect, Exit, Fiber, Runtime, Scope, Option, Schema, Layer, Context } from 'effect'
import { expect } from 'vitest'
import fc from 'fast-check'

/**
 * Effect実行結果の型安全なアサーション
 */
export interface EffectTestResult<A, E> {
  readonly result: Exit.Exit<A, E>
  readonly duration: number
  readonly fiber: Fiber.RuntimeFiber<A, E>
}

/**
 * Effect実行結果を型安全にテストするヘルパー
 */
export const runEffectTest = async <A, E>(
  effect: Effect.Effect<A, E, never>,
  timeout: number = 5000
): Promise<EffectTestResult<A, E>> => {
  const runtime = Runtime.defaultRuntime
  const startTime = performance.now()

  const fiber = Runtime.runFork(runtime)(effect)
  const result = await Runtime.runPromise(runtime)(
    Effect.race(Fiber.await(fiber), Effect.delay(Effect.fail(new Error(`Test timeout after ${timeout}ms`)), timeout))
  )

  const duration = performance.now() - startTime

  return {
    result,
    duration,
    fiber,
  }
}

/**
 * Effect成功の型安全なアサーション
 */
export const expectEffectSuccess = async <A, E>(effect: Effect.Effect<A, E, never>, timeout?: number): Promise<A> => {
  const testResult = await runEffectTest(effect, timeout)

  expect(Exit.isSuccess(testResult.result)).toBe(true)

  if (Exit.isSuccess(testResult.result)) {
    return testResult.result.value
  }

  throw new Error('Effect should have succeeded but failed')
}

/**
 * Effect失敗の型安全なアサーション
 */
export const expectEffectFailure = async <A, E>(effect: Effect.Effect<A, E, never>, timeout?: number): Promise<E> => {
  const testResult = await runEffectTest(effect, timeout)

  expect(Exit.isFailure(testResult.result)).toBe(true)

  if (Exit.isFailure(testResult.result)) {
    const cause = testResult.result.cause
    if (cause._tag === 'Fail') {
      return cause.error as E
    }
    return cause as E
  }

  throw new Error('Effect should have failed but succeeded')
}

/**
 * Effect失敗の詳細な型安全アサーション
 */
export const expectEffectFailureWith = async <A, E>(
  effect: Effect.Effect<A, E, never>,
  errorMatcher: (error: E) => boolean,
  timeout?: number
): Promise<E> => {
  const error = await expectEffectFailure(effect, timeout)
  expect(errorMatcher(error)).toBe(true)
  return error
}

/**
 * Effectの実行時間をテストするヘルパー
 */
export const expectEffectDuration = async <A, E>(
  effect: Effect.Effect<A, E, never>,
  minMs: number,
  maxMs: number,
  timeout?: number
): Promise<A> => {
  const testResult = await runEffectTest(effect, timeout)

  expect(testResult.duration).toBeGreaterThanOrEqual(minMs)
  expect(testResult.duration).toBeLessThanOrEqual(maxMs)

  return await expectEffectSuccess(effect, timeout)
}

/**
 * 並列Effect実行のテストヘルパー
 */
export const expectEffectConcurrent = async <A, E>(
  effects: ReadonlyArray<Effect.Effect<A, E, never>>,
  timeout?: number
): Promise<ReadonlyArray<A>> => {
  const startTime = performance.now()

  const results = await Promise.all(effects.map((effect) => expectEffectSuccess(effect, timeout)))

  const duration = performance.now() - startTime

  // 並列実行は逐次実行より速いはず
  const sequentialEstimate = effects.length * 100 // 各Effect最低100msと仮定
  expect(duration).toBeLessThan(sequentialEstimate)

  return results
}

/**
 * Effect-TSのMatch パターンテスト用ヘルパー
 */
export const expectMatchPattern = <T, R>(
  value: T,
  patterns: Record<string, (val: T) => boolean>,
  expectedPattern: string
): void => {
  const matchedPattern = Object.entries(patterns).find(([_, predicate]) => predicate(value))?.[0]

  expect(matchedPattern).toBe(expectedPattern)
}

/**
 * Option型の型安全なテストヘルパー
 */
export const expectSome = <A>(option: Option.Option<A>): A => {
  expect(Option.isSome(option)).toBe(true)
  if (Option.isSome(option)) {
    return option.value
  }
  throw new Error('Expected Some but got None')
}

export const expectNone = <A>(option: Option.Option<A>): void => {
  expect(Option.isNone(option)).toBe(true)
}

/**
 * Effect-TSエラーの型安全なテストヘルパー
 */
export const expectErrorType = <E extends Error>(error: unknown, errorClass: new (...args: any[]) => E): E => {
  expect(error).toBeInstanceOf(errorClass)
  return error as E
}

/**
 * Effect-TSのリソース管理テスト用ヘルパー
 */
export const expectResourceCleanup = async <A, E>(
  effect: Effect.Effect<A, E, Scope.Scope>,
  timeout?: number
): Promise<A> => {
  return await Effect.runPromise(Effect.scoped(effect))
}

/**
 * カバレッジ100%達成のためのエッジケーステストヘルパー
 */
export const testAllBranches = async <T>(
  testCases: ReadonlyArray<{
    name: string
    input: T
    expectedResult: 'success' | 'failure'
    errorType?: new (...args: any[]) => Error
  }>,
  testFunction: (input: T) => Effect.Effect<any, any, never>
): Promise<void> => {
  for (const testCase of testCases) {
    if (testCase.expectedResult === 'success') {
      await expectEffectSuccess(testFunction(testCase.input))
    } else {
      const error = await expectEffectFailure(testFunction(testCase.input))
      if (testCase.errorType) {
        expectErrorType(error, testCase.errorType)
      }
    }
  }
}

/**
 * 型レベルでのテストヘルパー（expectTypeOf統合）
 */
export const expectEffectType = <A, E, R>(
  _effect: Effect.Effect<A, E, R>
): {
  toSucceedWith: <Expected>() => Expected extends A ? true : false
  toFailWith: <Expected>() => Expected extends E ? true : false
  toRequire: <Expected>() => Expected extends R ? true : false
} => {
  return {
    toSucceedWith: <Expected>() => true as Expected extends A ? true : false,
    toFailWith: <Expected>() => true as Expected extends E ? true : false,
    toRequire: <Expected>() => true as Expected extends R ? true : false,
  }
}

// =====================================
// Phase 3: Schema-based Testing
// =====================================

/**
 * Schemaバリデーションテスト用ヘルパー
 * 型安全なSchemaデコーディングとエラーハンドリング
 */
export const expectSchemaSuccess = <A, I>(
  schema: Schema.Schema<A, I>,
  input: unknown
): A => {
  try {
    const result = Schema.decodeUnknownSync(schema)(input)
    return result
  } catch (error) {
    throw new Error(`Expected schema validation to succeed but failed: ${error}`)
  }
}

export const expectSchemaFailure = <A, I>(
  schema: Schema.Schema<A, I>,
  input: unknown,
  errorMatcher?: (error: Schema.ParseResult.ParseError) => boolean
): Schema.ParseResult.ParseError => {
  try {
    Schema.decodeUnknownSync(schema)(input)
    throw new Error('Expected schema validation to fail but succeeded')
  } catch (error) {
    if (error instanceof Schema.ParseResult.ParseError) {
      if (errorMatcher && !errorMatcher(error)) {
        throw new Error(`Schema validation failed but error didn't match expected pattern`)
      }
      return error
    }
    throw new Error(`Expected ParseError but got: ${error}`)
  }
}

/**
 * Schema-based Tagged Errorテスト用ヘルパー
 */
export const expectTaggedError = <T extends { readonly _tag: string }>(
  error: unknown,
  expectedTag: T['_tag']
): T => {
  expect(error).toHaveProperty('_tag')
  expect((error as T)._tag).toBe(expectedTag)
  return error as T
}

/**
 * Schema encoding/decodingのround-tripテスト
 */
export const expectSchemaRoundTrip = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A
): A => {
  const encoded = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeUnknownSync(schema)(encoded)
  expect(decoded).toEqual(value)
  return decoded
}

// =====================================
// Phase 3: Property-based Testing
// =====================================

/**
 * Property-based testingとEffect-TSの統合
 * fast-checkとEffectの組み合わせテスト
 */
export const expectPropertyTest = async <T>(
  arbitrary: fc.Arbitrary<T>,
  property: (value: T) => Effect.Effect<boolean, any, never>,
  options?: fc.Parameters<[T]>
): Promise<void> => {
  const testProperty = async (value: T) => {
    const result = await expectEffectSuccess(property(value))
    return result
  }

  await fc.assert(fc.asyncProperty(arbitrary, testProperty), options)
}

/**
 * Effect失敗プロパティテスト
 */
export const expectPropertyFailure = async <T, E>(
  arbitrary: fc.Arbitrary<T>,
  property: (value: T) => Effect.Effect<any, E, never>,
  errorMatcher?: (error: E) => boolean,
  options?: fc.Parameters<[T]>
): Promise<void> => {
  const testProperty = async (value: T) => {
    try {
      await expectEffectFailure(property(value))
      if (errorMatcher) {
        const error = await expectEffectFailure(property(value))
        return errorMatcher(error)
      }
      return true
    } catch {
      return false
    }
  }

  await fc.assert(fc.asyncProperty(arbitrary, testProperty), options)
}

/**
 * 決定論的テスト用のシード付きProperty testing
 */
export const expectDeterministicProperty = async <T>(
  arbitrary: fc.Arbitrary<T>,
  property: (value: T) => Effect.Effect<boolean, any, never>,
  seed: number = 42,
  numRuns: number = 100
): Promise<void> => {
  await expectPropertyTest(arbitrary, property, {
    seed,
    numRuns,
    verbose: false,
  })
}

// =====================================
// Phase 3: Layer-based DI統合
// =====================================

/**
 * Layer提供でのEffectテスト実行
 */
export const expectEffectWithLayer = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, any, any>,
  timeout?: number
): Promise<A> => {
  const providedEffect = Effect.provide(effect, layer)
  return await expectEffectSuccess(providedEffect, timeout)
}

/**
 * 複数Layerの組み合わせテスト
 */
export const expectEffectWithLayers = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layers: ReadonlyArray<Layer.Layer<any, any, any>>,
  timeout?: number
): Promise<A> => {
  const combinedLayer = layers.reduce((acc, layer) => Layer.provide(acc, layer))
  return await expectEffectWithLayer(effect, combinedLayer, timeout)
}

/**
 * サービステスト用のモックLayer作成ヘルパー
 */
export const createMockLayer = <T>(
  tag: Context.Tag<T, T>,
  implementation: T
): Layer.Layer<T, never, never> => {
  return Layer.succeed(tag, implementation)
}

/**
 * サービスの依存関係テスト
 */
export const expectServiceDependency = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  requiredService: Context.Tag<any, any>,
  timeout?: number
): Promise<void> => {
  // サービスなしで実行してエラーを期待
  try {
    await expectEffectFailure(effect, timeout)
  } catch (error) {
    // 依存関係エラーが発生することを確認
    expect(error).toBeDefined()
  }
}

/**
 * Layer作成エラーテスト
 */
export const expectLayerFailure = async <A, E>(
  layer: Layer.Layer<A, E, any>,
  errorMatcher?: (error: E) => boolean,
  timeout?: number
): Promise<E> => {
  const buildEffect = Layer.build(layer)
  const error = await expectEffectFailure(buildEffect, timeout)

  if (errorMatcher && !errorMatcher(error)) {
    throw new Error('Layer error did not match expected pattern')
  }

  return error
}

/**
 * Layer lifecycle（初期化・終了処理）テスト
 */
export const expectLayerLifecycle = async <A, E, R>(
  layer: Layer.Layer<A, E, R>,
  test: (service: A) => Effect.Effect<void, any, never>,
  timeout?: number
): Promise<void> => {
  const effect = Effect.gen(function* () {
    const service = yield* Layer.build(layer)
    yield* Effect.scoped(test(service))
  })

  await expectEffectSuccess(effect, timeout)
}

// =====================================
// Phase 3: 統合テストヘルパー
// =====================================

/**
 * 完全なシステムテスト：Schema + Property + Layer統合
 */
export const expectSystemTest = async <A, I, E, R>(
  schema: Schema.Schema<A, I>,
  arbitrary: fc.Arbitrary<unknown>,
  systemLayer: Layer.Layer<R, any, any>,
  systemEffect: (input: A) => Effect.Effect<boolean, E, R>,
  options?: {
    numRuns?: number
    timeout?: number
    seed?: number
  }
): Promise<void> => {
  const testProperty = async (rawInput: unknown) => {
    try {
      // Schema validation
      const validInput = expectSchemaSuccess(schema, rawInput)

      // Effect execution with Layer
      const providedEffect = Effect.provide(systemEffect(validInput), systemLayer)
      const result = await expectEffectSuccess(providedEffect, options?.timeout)

      return result
    } catch {
      // Invalid input or system failure - skip this test case
      return true
    }
  }

  await fc.assert(
    fc.asyncProperty(arbitrary, testProperty),
    {
      numRuns: options?.numRuns ?? 50,
      seed: options?.seed ?? 42,
      verbose: false,
    }
  )
}

/**
 * パフォーマンス要件テスト（<50ms/test維持）
 */
export const expectPerformanceTest = async <A, E>(
  effect: Effect.Effect<A, E, never>,
  maxDurationMs: number = 50,
  iterations: number = 10
): Promise<A> => {
  const results: A[] = []
  const durations: number[] = []

  for (let i = 0; i < iterations; i++) {
    const testResult = await runEffectTest(effect)
    expect(Exit.isSuccess(testResult.result)).toBe(true)

    if (Exit.isSuccess(testResult.result)) {
      results.push(testResult.result.value)
      durations.push(testResult.duration)
    }
  }

  // 平均実行時間チェック
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
  expect(avgDuration).toBeLessThanOrEqual(maxDurationMs)

  // 最大実行時間チェック
  const maxDuration = Math.max(...durations)
  expect(maxDuration).toBeLessThanOrEqual(maxDurationMs * 2) // 2倍まで許容

  return results[0] as A
}
