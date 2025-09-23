import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Exit, Duration, Ref, Schema } from 'effect'
import { ErrorRecovery } from '../ErrorRecovery'
import { GameError, ValidationError } from '../GameErrors'
import { NetworkError, ConnectionError } from '../NetworkErrors'

describe('ErrorRecovery', () => {
  describe('retry', () => {
  it.effect('成功するまでリトライする', () => Effect.gen(function* () {
    let attempts = 0
    const program = Effect.sync(() => {
    attempts++
    if (attempts < 3) {
    throw new Error('Temporary failure')
    }
    return 'success'
})
) })
        expect(result).toBe('success')
        expect(attempts).toBe(3)})

    it.effect('最大リトライ回数に達したら失敗する', () => Effect.gen(function* () {
    let attempts = 0
    const program = Effect.sync(() => {
    attempts++
    throw new Error('Persistent failure')
    })
    const result = yield* Effect.either(
    ErrorRecovery.retry(program, { maxRetries: 3, delay: Duration.millis(10)
  })
).toBe('Left')
    expect(attempts).toBe(4) // 初回 + 3回のリトライ
    })
    it.effect('遅延が正しく適用される', () => Effect.gen(function* () {
    const start = Date.now()
    let attempts = 0
    const program = Effect.sync(() => {
    attempts++
    if (attempts < 3) {
    throw new Error('Failure')
    }
    return 'success'
  })
) })
        const elapsed = Date.now() - start

        expect(result).toBe('success')
        expect(elapsed).toBeGreaterThan(100) // 最低2回の50ms遅延
      })
  })

  describe('recover', () => {
  it.effect('特定のエラータイプから回復する', () => Effect.gen(function* () {
    const error = GameError({ message: 'Game error', code: 'GAME_001'
})
    const recovered = yield* ErrorRecovery.recover(
    program,
    (err) => err._tag === 'GameError',
    () => Effect.succeed('recovered from game error')
    )
    expect(recovered).toBe('recovered from game error')
  })
),
    Effect.gen(function* () {
    const error = NetworkError({ message: 'Network error', code: 'NET_001' 
    })
    const result = yield* Effect.either(
    ErrorRecovery.recover(
    program,
    (err) => err._tag === 'GameError',
    () => Effect.succeed('recovered')
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
    expect(result.left._tag).toBe('NetworkError')
    }
    })
    it.effect('複数の回復ストラテジーをチェーンできる', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001'
    })
    const recovered = yield* ErrorRecovery.recover(
    program,
    (err) => err._tag === 'GameError',
    () => Effect.succeed('game recovery')
    ).pipe(
    ErrorRecovery.recover,
    (err) => err._tag === 'NetworkError',
    () => Effect.succeed('network recovery')
    )
    expect(recovered).toBe('game recovery')
  })
)
    describe('circuit breaker', () => {
  it.effect('失敗が閾値を超えるとサーキットが開く', () => Effect.gen(function* () {
    const circuitBreaker = yield* ErrorRecovery.createCircuitBreaker({
    failureThreshold: 3,
    timeout: Duration.millis(100
    }),
    resetTimeout: Duration.seconds(1)
})
    // 失敗を蓄積
    for (let i = 0; i < 3; i++) {
    yield* Effect.either(circuitBreaker(failingProgram))
    }
    // サーキットが開いているため即座に失敗する
    const start = Date.now()
    const result = yield* Effect.either(circuitBreaker(failingProgram))
    const elapsed = Date.now() - start
    expect(result._tag).toBe('Left')
    expect(elapsed).toBeLessThan(50) // 即座に失敗
  })
),
    Effect.gen(function* () {
    const circuitBreaker = yield* ErrorRecovery.createCircuitBreaker({
    failureThreshold: 2,
    timeout: Duration.millis(10
    }),
    resetTimeout: Duration.millis(50)
    })

    // サーキットを開く
    yield* Effect.either(circuitBreaker(failingProgram))
    yield* Effect.either(circuitBreaker(failingProgram))

    // リセット時間を待つ
    yield* Effect.sleep(Duration.millis(60))

    // 成功するプログラムで試行
    const successProgram = Effect.succeed('service restored')
    const result = yield* circuitBreaker(successProgram)

    expect(result).toBe('service restored')
    })
    })

    describe('fallback', () => {
  it.effect('プライマリが失敗したときフォールバックを使用する', () => Effect.gen(function* () {
    const primary = Effect.fail(new Error('Primary service down'))
    const fallback = Effect.succeed('fallback result')
    const result = yield* ErrorRecovery.fallback(primary, fallback)
    expect(result).toBe('fallback result')
})
),
  Effect.gen(function* () {
        const primary = Effect.succeed('primary result')
        const fallback = Effect.succeed('fallback result')

        const result = yield* ErrorRecovery.fallback(primary, fallback)
        expect(result).toBe('primary result')
      })
    it.effect('プライマリとフォールバック両方が失敗したら最後のエラーを返す', () => Effect.gen(function* () {
    const primary = Effect.fail(new Error('Primary failed'))
    const fallback = Effect.fail(new Error('Fallback failed'))
    const result = yield* Effect.either(ErrorRecovery.fallback(primary, fallback))
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
    expect(result.left.message).toBe('Fallback failed')
    }
  })
)
    describe('Property-based testing', () => {
  it.prop('retryは指定された回数まで試行する', [
    Schema.Int.pipe(Schema.between(0, 10)),
    Schema.Int.pipe(Schema.between(1, 1000))
    ], ({ int: maxRetries }, { int: delayMs
})

    Effect.gen(function* () {
    let attempts = 0
    const program = Effect.sync(() => {
    attempts++
    throw new Error('Always fails')
    })

    yield* Effect.either(
    ErrorRecovery.retry(program, { maxRetries, delay: Duration.millis(delayMs)})

    expect(attempts).toBe(maxRetries + 1) // 初回 + リトライ回数
    })
    it.prop('recoverは条件にマッチするエラーのみ処理する', [
    Schema.Int.pipe(Schema.between(0, 10)),
    Schema.Int.pipe(Schema.between(1, 1000))
    ], ({ int: maxRetries }, { int: delayMs })

    Effect.gen(function* () {
    const gameError = GameError({ message: 'test', code: 'TEST' })
    const networkError = NetworkError({ message: 'test', code: 'TEST' })

    const gameRecovery = yield* Effect.either(
    ErrorRecovery.recover(
    Effect.fail(gameError),
    (err) => err._tag === 'GameError',
    () => Effect.succeed('recovered')
    )

    const networkRecovery = yield* Effect.either(
    ErrorRecovery.recover(
    Effect.fail(networkError),
    (err) => err._tag === 'GameError',
    () => Effect.succeed('recovered')
    )

    expect(gameRecovery._tag).toBe('Right')
    expect(networkRecovery._tag).toBe('Left')
    })
    it.prop('circuitBreakerは閾値を正しく処理する', [
    Schema.Int.pipe(Schema.between(0, 10))
    ], ({ int: maxRetries })

    Effect.gen(function* () {
    const circuitBreaker = yield* ErrorRecovery.createCircuitBreaker({
    failureThreshold: maxRetries || 1,
    timeout: Duration.millis(10
    }),
    resetTimeout: Duration.millis(50)
    })

    const failingProgram = Effect.fail(new Error('Test failure'))

    // 閾値まで失敗させる
    for (let i = 0; i < (maxRetries || 1); i++) {
    yield* Effect.either(circuitBreaker(failingProgram))
    }

    // 次の呼び出しは即座に失敗するはず
    const start = Date.now()
    yield* Effect.either(circuitBreaker(failingProgram))
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(30) // 即座に失敗
    })
    })

    describe('複合的なエラー回復パターン', () => {
  it.effect('retry + circuit breaker + fallbackの組み合わせ', () => Effect.gen(function* () {
    let attempts = 0
    const unreliableService = Effect.sync(() => {
    attempts++
    if (attempts < 5) {
    throw new Error('Service temporarily unavailable')
    }
    return 'service result'
})
    const circuitBreaker = yield* ErrorRecovery.createCircuitBreaker({
    failureThreshold: 3,
    timeout: Duration.millis(10),
    resetTimeout: Duration.millis(100)
  })
), {
          maxRetries: 2,
          delay: Duration.millis(10)
        })

        const withFallback = ErrorRecovery.fallback(
          withRetry,
          Effect.succeed('fallback result')
        )

        const result = yield* withFallback
        expect(result).toBe('fallback result') // サーキットが開いてフォールバック})

    it.effect('異なるエラータイプに対する段階的回復', () => Effect.gen(function* () {
    const validationError = ValidationError({
    message: 'Invalid input',
    field: 'username',
    value: ''
    })
    const recovered = yield* ErrorRecovery.recover(
    program,
    (err) => err._tag === 'ValidationError',
    (err) => Effect.succeed(`Fixed validation: ${err.field}`)
    ).pipe(
    ErrorRecovery.recover,
    (err) => err._tag === 'NetworkError',
    () => Effect.succeed('Network recovery')
    ).pipe(
    ErrorRecovery.recover,
    (err) => err._tag === 'GameError',
    () => Effect.succeed('Game recovery')
    )
    expect(recovered).toBe('Fixed validation: username')
  })
)
})