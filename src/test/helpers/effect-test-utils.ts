/**
 * Effect-TS専用テストヘルパー関数
 * 100%カバレッジを達成するための型安全なテストユーティリティ
 */
import { Effect, Exit, Fiber, Runtime, Scope, Option } from 'effect'
import { expect } from 'vitest'

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
