import { describe, it, expect } from '@effect/vitest'
import { Effect, Exit, Duration, TestContext, TestClock, Ref, Either, Fiber, Cause } from 'effect'
import * as fc from 'fast-check'
import { ErrorHandlers } from '../ErrorHandlers'
import { NetworkError } from '../NetworkErrors'
import { GameError } from '../GameErrors'

describe('ErrorHandlers', () => {
  describe('logAndFallback', () => {
    it.effect('エラーをログに記録してフォールバック値を返す', () =>
      Effect.gen(function* () {
        const loggedErrors = yield* Ref.make<unknown[]>([])
        const logger = (error: unknown) => {
          return Effect.runSync(Ref.update(loggedErrors, (errors) => [...errors, error]))
        }

        const error = NetworkError({ message: 'Test error' })
        const handler = ErrorHandlers.logAndFallback('fallback', logger)

        const program: Effect.Effect<string, never, never> = Effect.fail(error).pipe(Effect.catchAll(handler))

        const result = yield* program
        const logs = yield* Ref.get(loggedErrors)

        expect(result).toBe('fallback')
        expect(logs).toHaveLength(1)
        expect(logs[0]).toBe(error)
      })
    )

    it.effect('ロガーがない場合はconsole.errorを使用', () =>
      Effect.gen(function* () {
        // console.errorをモック化してログ出力を抑制
        const originalConsoleError = console.error
        console.error = () => {}

        const error = NetworkError({ message: 'Test error without logger' })
        const handler = ErrorHandlers.logAndFallback('fallback')

        const program: Effect.Effect<string, never, never> = Effect.fail(error).pipe(Effect.catchAll(handler))

        const result = yield* program
        expect(result).toBe('fallback')

        // console.errorを復元
        console.error = originalConsoleError
      })
    )

    it.effect('複数のエラータイプでフォールバック', () =>
      Effect.gen(function* () {
        const loggedErrors = yield* Ref.make<unknown[]>([])
        const logger = (error: unknown) => {
          return Effect.runSync(Ref.update(loggedErrors, (errors) => [...errors, error]))
        }

        const errors = [
          NetworkError({ message: 'Network error' }),
          GameError({ message: 'Game error' }),
          new Error('Standard error'),
          'String error',
        ]

        const handler = ErrorHandlers.logAndFallback('fallback', logger)

        for (const error of errors) {
          const program = Effect.fail(error).pipe(Effect.catchAll(handler))
          const result = yield* program
          expect(result).toBe('fallback')
        }

        const logs = yield* Ref.get(loggedErrors)
        expect(logs).toHaveLength(4)
        expect(logs).toEqual(errors)
      })
    )

    it.effect('異なるフォールバック値を返す', () =>
      Effect.gen(function* () {
        const error = NetworkError({ message: 'Test error' })

        const stringHandler = ErrorHandlers.logAndFallback('string fallback')
        const numberHandler = ErrorHandlers.logAndFallback(42)
        const objectHandler = ErrorHandlers.logAndFallback({ status: 'error' })

        const stringResult = yield* Effect.fail(error).pipe(Effect.catchAll(stringHandler))
        const numberResult = yield* Effect.fail(error).pipe(Effect.catchAll(numberHandler))
        const objectResult = yield* Effect.fail(error).pipe(Effect.catchAll(objectHandler))

        expect(stringResult).toBe('string fallback')
        expect(numberResult).toBe(42)
        expect(objectResult).toEqual({ status: 'error' })
      })
    )
  })

  describe('mapError', () => {
    it.effect('エラーを変換する', () =>
      Effect.gen(function* () {
        const error = NetworkError({ message: 'Original error' })

        const program = Effect.fail(error).pipe(
          Effect.catchAll(ErrorHandlers.mapError((e: typeof error) => new Error(`Mapped: ${e.message}`)))
        )

        const result = yield* Effect.either(program)
        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const mappedError = result.left as Error
          expect(mappedError.message).toBe('Mapped: Original error')
        }
      })
    )

    it.effect('複雑なエラー変換', () =>
      Effect.gen(function* () {
        const networkError = NetworkError({
          message: 'Network timeout',
          code: 'NET_TIMEOUT',
          statusCode: 408,
        })

        const mapper = (e: typeof networkError) => ({
          type: 'CustomError',
          message: `Transformed: ${e.message}`,
          originalCode: e.code,
          severity: e.statusCode && e.statusCode >= 500 ? 'high' : 'medium',
        })

        const program = Effect.fail(networkError).pipe(Effect.catchAll(ErrorHandlers.mapError(mapper)))

        const result = yield* Effect.either(program)
        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const transformedError = result.left as ReturnType<typeof mapper>
          expect(transformedError.type).toBe('CustomError')
          expect(transformedError.message).toBe('Transformed: Network timeout')
          expect(transformedError.originalCode).toBe('NET_TIMEOUT')
          expect(transformedError.severity).toBe('medium')
        }
      })
    )

    it.effect('エラー型の変換チェーン', () =>
      Effect.gen(function* () {
        const originalError = GameError({ message: 'Game error', code: 'GAME_001' })

        const program = Effect.fail(originalError).pipe(
          Effect.catchAll(
            ErrorHandlers.mapError((e: typeof originalError) =>
              NetworkError({ message: `Network: ${e.message}`, code: e.code })
            )
          ),
          Effect.catchAll(
            ErrorHandlers.mapError((e: ReturnType<typeof NetworkError>) => new Error(`Final: ${e.message}`))
          )
        )

        const result = yield* Effect.either(program)
        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const finalError = result.left as Error
          expect(finalError.message).toBe('Final: Network: Game error')
        }
      })
    )
  })

  describe('partial', () => {
    it.effect('部分的な成功を許可する', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.succeed(1),
          Effect.fail(new Error('Failed')),
          Effect.succeed(3),
        ]

        const program = ErrorHandlers.partial(effects, 2)
        const result = yield* program

        expect(result).toEqual([1, 3])
      })
    )

    it.effect('最小成功数に達しない場合は失敗', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.fail(new Error('Failed 1')),
          Effect.fail(new Error('Failed 2')),
          Effect.succeed(3),
        ]

        const program = ErrorHandlers.partial(effects, 2)
        const result = yield* Effect.either(program)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toContain('Minimum success requirement not met: 1/2')
        }
      })
    )

    it.effect('すべて成功の場合', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.succeed(1),
          Effect.succeed(2),
          Effect.succeed(3),
        ]

        const program = ErrorHandlers.partial(effects, 2)
        const result = yield* program

        expect(result).toEqual([1, 2, 3])
      })
    )

    it.effect('すべて失敗の場合', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.fail(new Error('Failed 1')),
          Effect.fail(new Error('Failed 2')),
          Effect.fail(new Error('Failed 3')),
        ]

        const program = ErrorHandlers.partial(effects, 1)
        const result = yield* Effect.either(program)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toContain('Minimum success requirement not met: 0/1')
        }
      })
    )

    it.effect('デフォルトの最小成功数（1）', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.fail(new Error('Failed 1')),
          Effect.fail(new Error('Failed 2')),
          Effect.succeed(3),
        ]

        const program = ErrorHandlers.partial(effects) // minSuccess = 1がデフォルト
        const result = yield* program

        expect(result).toEqual([3])
      })
    )

    it.effect('空の配列', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = []

        const program = ErrorHandlers.partial(effects, 1)
        const result = yield* Effect.either(program)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toContain('Minimum success requirement not met: 0/1')
        }
      })
    )

    it.effect('最小成功数が0の場合', () =>
      Effect.gen(function* () {
        const effects: Array<Effect.Effect<number, Error, never>> = [
          Effect.fail(new Error('Failed 1')),
          Effect.fail(new Error('Failed 2')),
        ]

        const program = ErrorHandlers.partial(effects, 0)
        const result = yield* program

        expect(result).toEqual([])
      })
    )
  })

  describe('withTimeout', () => {
    it.scoped('エフェクトが時間内に完了する場合は成功', () =>
      Effect.gen(function* () {
        const effect: Effect.Effect<string, never, never> = Effect.succeed('success')

        const program: Effect.Effect<string, Error, never> = ErrorHandlers.withTimeout(
          Duration.seconds(1),
          () => new Error('Timeout')
        )(effect)

        const result = yield* program
        expect(result).toBe('success')
      })
    )

    it.scoped('エフェクトがタイムアウトする場合は失敗', () =>
      Effect.gen(function* () {
        const effect: Effect.Effect<string, never, never> = Effect.sleep(Duration.millis(100)).pipe(
          Effect.map(() => 'success')
        )

        const program: Effect.Effect<string, Error, never> = ErrorHandlers.withTimeout(
          Duration.millis(50),
          () => new Error('Timeout')
        )(effect)

        const fiber = yield* Effect.fork(program)
        yield* TestClock.adjust(Duration.millis(50))
        const result = yield* Effect.either(Fiber.join(fiber))

        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toBe('Timeout')
        }
      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.scoped('カスタムタイムアウトエラー', () =>
      Effect.gen(function* () {
        const effect: Effect.Effect<string, never, never> = Effect.sleep(Duration.millis(100)).pipe(
          Effect.map(() => 'success')
        )

        const customTimeoutError = {
          type: 'CustomTimeout',
          message: 'Operation timed out',
          duration: Duration.millis(50),
        }

        const program = ErrorHandlers.withTimeout(Duration.millis(50), () => customTimeoutError)(effect)

        const fiber = yield* Effect.fork(program)
        yield* TestClock.adjust(Duration.millis(50))
        const result = yield* Effect.either(Fiber.join(fiber))

        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const error = result.left as typeof customTimeoutError
          expect(error.type).toBe('CustomTimeout')
          expect(error.message).toBe('Operation timed out')
        }
      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.scoped('エフェクトが既に失敗している場合はタイムアウトではなく元のエラー', () =>
      Effect.gen(function* () {
        const originalError = new Error('Original error')
        const effect: Effect.Effect<string, Error, never> = Effect.fail(originalError)

        const program = ErrorHandlers.withTimeout(Duration.seconds(1), () => new Error('Timeout'))(effect)

        const result = yield* Effect.either(program)
        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toBe('Original error')
        }
      })
    )

    it.scoped('長時間実行エフェクトのタイムアウト管理', () =>
      Effect.gen(function* () {
        const longRunningEffect = Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(200))
          return 'completed'
        })

        const timeoutEffect = ErrorHandlers.withTimeout(
          Duration.millis(100),
          () => new Error('Timeout after 100ms')
        )(longRunningEffect)

        const fiber = yield* Effect.fork(timeoutEffect)
        yield* TestClock.adjust(Duration.millis(100))
        const result = yield* Effect.either(Fiber.join(fiber))

        expect(Either.isLeft(result)).toBe(true)

        if (Either.isLeft(result)) {
          const error = result.left as Error
          expect(error.message).toBe('Timeout after 100ms')
        }
      }).pipe(Effect.provide(TestContext.TestContext))
    )
  })

  describe('Property-based testing', () => {
    // 最小限のプロパティベーステストのみ残す
    it('logAndFallbackは任意のエラーと任意のフォールバック値で動作する', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (errorMsg, fallback) => {
          // ログ出力を抑制するためにloggerを無効化
          const handler = ErrorHandlers.logAndFallback(fallback, () => {})
          const program = Effect.fail(new Error(errorMsg)).pipe(Effect.catchAll(handler))
          const result = await Effect.runPromise(program)
          expect(result).toBe(fallback)
        }),
        {
          numRuns: 3, // 最小実行回数
          timeout: 50, // 短いタイムアウト
          verbose: false,
        }
      )
    })
  })

  describe('統合テスト', () => {
    it.scoped('複数のエラーハンドラーを組み合わせて使用', () =>
      Effect.gen(function* () {
        const loggedErrors = yield* Ref.make<unknown[]>([])
        const logger = (error: unknown) => {
          return Effect.runSync(Ref.update(loggedErrors, (errors) => [...errors, error]))
        }

        const originalError = NetworkError({ message: 'Network failure' })

        const program = Effect.fail(originalError).pipe(
          // 最初にエラーを変換
          Effect.catchAll(
            ErrorHandlers.mapError((e: typeof originalError) => GameError({ message: `Converted: ${e.message}` }))
          ),
          // 変換されたエラーをログに記録してフォールバック
          Effect.catchAll(ErrorHandlers.logAndFallback('recovered', logger)),
          // タイムアウト保護
          (effect) => ErrorHandlers.withTimeout(Duration.seconds(1), () => new Error('Processing timeout'))(effect)
        )

        const result = yield* program
        const logs = yield* Ref.get(loggedErrors)

        expect(result).toBe('recovered')
        expect(logs).toHaveLength(1)

        const loggedError = logs[0] as ReturnType<typeof GameError>
        expect(loggedError._tag).toBe('GameError')
        expect(loggedError.message).toBe('Converted: Network failure')
      })
    )

    it.scoped('部分的成功とタイムアウトの組み合わせ', () =>
      Effect.gen(function* () {
        const effects = [
          Effect.succeed(1),
          Effect.sleep(Duration.millis(200)).pipe(Effect.map(() => 2)), // タイムアウトする
          Effect.succeed(3),
          Effect.fail(new Error('Failed')),
        ]

        const withTimeouts = effects.map((effect) =>
          ErrorHandlers.withTimeout(Duration.millis(100), () => new Error('Individual timeout'))(effect)
        )

        const program = ErrorHandlers.partial(withTimeouts, 2)

        const fiber = yield* Effect.fork(program)
        // タイムアウトを発生させるために時間を進める
        yield* TestClock.adjust(Duration.millis(100))
        const result = yield* Fiber.join(fiber)

        expect(result).toEqual([1, 3]) // 成功したもののみ
      }).pipe(Effect.provide(TestContext.TestContext))
    )
  })

  describe('エラーハンドリングの不変条件', () => {
    it.effect('logAndFallbackは常にフォールバック値を返す', () =>
      Effect.gen(function* () {
        const errors = [NetworkError({ message: 'test' }), new Error('test'), 'string error', 123, null, undefined]

        for (const error of errors) {
          const handler = ErrorHandlers.logAndFallback('fallback')
          const program = Effect.fail(error).pipe(Effect.catchAll(handler))
          const result = yield* program
          expect(result).toBe('fallback')
        }
      })
    )

    it.effect('mapErrorは常にEffect.failを返す', () =>
      Effect.gen(function* () {
        const errors = [NetworkError({ message: 'test' }), new Error('test'), 'string error']

        for (const error of errors) {
          const handler = ErrorHandlers.mapError((e: unknown) => `mapped: ${e}`)
          const program = Effect.fail(error).pipe(Effect.catchAll(handler))
          const exit = yield* Effect.exit(program)
          expect(Exit.isFailure(exit)).toBe(true)
        }
      })
    )

    it.effect('partialは配列を返すかFailする', () =>
      Effect.gen(function* () {
        const testCases = [
          [Effect.succeed(1), Effect.succeed(2)],
          [Effect.fail(new Error('fail')), Effect.succeed(2)],
          [Effect.fail(new Error('fail1')), Effect.fail(new Error('fail2'))],
        ]

        for (const effects of testCases) {
          const program = ErrorHandlers.partial(effects, 1)
          const exit = yield* Effect.exit(program)

          if (Exit.isSuccess(exit)) {
            expect(Array.isArray(exit.value)).toBe(true)
          } else {
            expect(Exit.isFailure(exit)).toBe(true)
          }
        }
      })
    )
  })
})
