import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  isGameError,
  isNetworkError,
  isValidationError,
  isConnectionError,
  isErrorOfType,
  hasErrorCode
} from '../ErrorGuards'
import { GameError, ValidationError, InvalidStateError } from '../GameErrors'
import { NetworkError, ConnectionError, TimeoutError } from '../NetworkErrors'

describe('ErrorGuards', () => {
  describe('基本的なエラーガード', () => {
  it.effect('isGameErrorは正しくGameErrorを識別する', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001'
})
  ).toBe(true)
    expect(isGameError(networkError)).toBe(false)
    expect(isGameError(null)).toBe(false)
    expect(isGameError(undefined)).toBe(false)
    expect(isGameError('string')).toBe(false)})

    it.effect('isNetworkErrorは正しくNetworkErrorを識別する', () => Effect.gen(function* () {
    const networkError = NetworkError({ message: 'Network error', code: 'NET_001'
  })
  ).toBe(true)
    expect(isNetworkError(gameError)).toBe(false)
    expect(isNetworkError({
  })
).toBe(false)
        expect(isNetworkError({ _tag: 'NetworkError' })).toBe(false) // メッセージ不足
      })
    it.effect('isValidationErrorは正しくValidationErrorを識別する', () => Effect.gen(function* () {
    const validationError = ValidationError({
    message: 'Validation failed',
    field: 'username',
    value: 'invalid'
  })
  ).toBe(true)
    expect(isValidationError(gameError)).toBe(false)
    expect(isValidationError({ _tag: 'ValidationError', message: 'test' 
  })
).toBe(false) // field不足
      })
    it.effect('isConnectionErrorは正しくConnectionErrorを識別する', () => Effect.gen(function* () {
    const connectionError = ConnectionError({
    message: 'Connection failed',
    serverUrl: 'ws://localhost:8080',
    attemptNumber: 1,
    maxAttempts: 3
    })
    const timeoutError = TimeoutError({
    message: 'Timeout',
    operation: 'connect',
    timeoutMs: 5000
    }).toBe(true)
    expect(isConnectionError(timeoutError)).toBe(false)
    expect(isConnectionError({ _tag: 'ConnectionError'
  })
).toBe(false) // プロパティ不足
      })
  })

  describe('汎用エラーガード', () => {
  it.effect('isErrorOfTypeは指定されたタイプのエラーを識別する', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001'
})
    const validationError = ValidationError({
    message: 'Validation error',
    field: 'email',
    value: 'invalid'
    }).toBe(true)
    expect(isErrorOfType(gameError, 'ValidationError')).toBe(false)
    expect(isErrorOfType(validationError, 'ValidationError')).toBe(true)
    expect(isErrorOfType(validationError, 'GameError')).toBe(false)
    expect(isErrorOfType(null, 'GameError')).toBe(false)
  })
),
    Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001' 
    })
    const validationError = ValidationError({
    message: 'Validation error',
    field: 'email',
    value: 'invalid'
    }) // codeプロパティなし

    expect(hasErrorCode(gameError, 'GAME_001')).toBe(true)
    expect(hasErrorCode(gameError, 'GAME_002')).toBe(false)
    expect(hasErrorCode(networkError, 'NET_001')).toBe(true)
    expect(hasErrorCode(validationError, 'VALIDATION_001')).toBe(false)
    expect(hasErrorCode(null, 'GAME_001')).toBe(false)
    })
    })

    describe('Property-based testing', () => {
  it.prop('isGameErrorは一貫した結果を返す', [
    Schema.Union(
    Schema.Struct({
    _tag: Schema.Literal('GameError'),
    message: Schema.String,
    code: Schema.String
}),
    Schema.Struct({
    _tag: Schema.Literal('NetworkError'),
    message: Schema.String,
    code: Schema.String})
    ], ({ union: error })

    Effect.gen(function* () {
    const result1 = isGameError(error)
    const result2 = isGameError(error)
    expect(result1).toBe(result2) // 一貫性

    if (error._tag === 'GameError') {
    expect(result1).toBe(true)
    } else {
    expect(result1).toBe(false)
    }
    })
    it.prop('isErrorOfTypeは正確にタイプマッチングを行う', [
    Schema.Struct({
    _tag: Schema.Union(
    Schema.Literal('GameError'),
    Schema.Literal('NetworkError'),
    Schema.Literal('ValidationError')
    ),
    message: Schema.String
    })
    ], ({ struct: error })

    Effect.gen(function* () {
    const correctType = isErrorOfType(error, error._tag)
    expect(correctType).toBe(true)

    // 異なるタイプではfalse
    const otherTypes = ['GameError', 'NetworkError', 'ValidationError'].filter(t => t !== error._tag)
    otherTypes.forEach(type => {
    expect(isErrorOfType(error, type as any)).toBe(false)
    })
    })
    it.prop('hasErrorCodeはcodeプロパティの有無を正しく判定する', [
    Schema.Union(
    Schema.Struct({
    _tag: Schema.Literal('GameError'),
    message: Schema.String,
    code: Schema.String
    }),
    Schema.Struct({
    _tag: Schema.Literal('ValidationError'),
    message: Schema.String,
    field: Schema.String,
    value: Schema.String
    }) // codeなし
    )
    ], ({ union: error })

    Effect.gen(function* () {
    if ('code' in error) {
    expect(hasErrorCode(error, error.code)).toBe(true)
    expect(hasErrorCode(error, 'WRONG_CODE')).toBe(false)
    } else {
    expect(hasErrorCode(error, 'ANY_CODE')).toBe(false)
    }
    })
    })

    describe('複合的なエラー判定', () => {
  it.effect('複数のガードを組み合わせて使用できる', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Critical game error', code: 'CRITICAL_001'
})
    const validationError = ValidationError({
    message: 'Invalid input',
    field: 'username',
    value: ''
  })
): boolean =>
          isGameError(error) && hasErrorCode(error, 'CRITICAL_001')

        expect(isCriticalGameError(gameError)).toBe(true)
        expect(isCriticalGameError(validationError)).toBe(false)

        const normalGameError = GameError({ message: 'Normal error', code: 'NORMAL_001' })
        expect(isCriticalGameError(normalGameError)).toBe(false)})

    it.effect('エラーの階層関係を判定できる', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001'
    })
    const validationError = ValidationError({
    message: 'Validation error',
    field: 'email',
    value: 'invalid'
    })
    const invalidStateError = InvalidStateError({
    message: 'Invalid state',
    currentState: 'loading',
    expectedState: 'ready'
    })
    // ValidationErrorとInvalidStateErrorはどちらもGameErrorの派生
    const isGameRelatedError = (error: unknown): boolean =>
    isGameError(error) || isValidationError(error) || isErrorOfType(error, 'InvalidStateError')
    expect(isGameRelatedError(gameError)).toBe(true)
    expect(isGameRelatedError(validationError)).toBe(true)
    expect(isGameRelatedError(invalidStateError)).toBe(true)
    const networkError = NetworkError({ message: 'Network error', code: 'NET_001'
    }).toBe(false)
  })
)
    describe('エラーガードの堅牢性', () => {
  it.effect('不正な値に対して適切にfalseを返す', () => Effect.gen(function* () {
    const invalidValues = [
    null,
    undefined,
    '',
    0,
    false,
    [],
    {},
    { _tag: 'WrongTag' },
    { message: 'No tag' },
    { _tag: 'GameError' }, // messageなし
    { _tag: 'GameError', message: 42 }, // message型不正
    ]
    invalidValues.forEach(value => {
    expect(isGameError(value)).toBe(false)
    expect(isNetworkError(value)).toBe(false)
    expect(isValidationError(value)).toBe(false)
    expect(isConnectionError(value)).toBe(false)
    expect(isErrorOfType(value, 'GameError')).toBe(false)
    expect(hasErrorCode(value, 'SOME_CODE')).toBe(false)
})
  ),
  Effect.gen(function* () {
        const circularObj: any = {
          _tag: 'GameError',
          message: 'Circular reference error'
        }
        circularObj.self = circularObj

        // エラーガードは循環参照があっても安全に動作すべき
        expect(() => isGameError(circularObj)).not.toThrow()
        expect(() => isErrorOfType(circularObj, 'GameError')).not.toThrow()
        expect(() => hasErrorCode(circularObj, 'SOME_CODE')).not.toThrow()

        // 実際の判定結果
        expect(isGameError(circularObj)).toBe(true) // _tagとmessageが正しいため
        expect(isErrorOfType(circularObj, 'GameError')).toBe(true)
        expect(hasErrorCode(circularObj, 'SOME_CODE')).toBe(false) // codeプロパティなし
      })
    it.effect('巨大なオブジェクトを効率的に処理する', () => Effect.gen(function* () {
    const largeError = GameError({
    message: 'Large error with extensive data',
    code: 'LARGE_001'
    })
    // 大量のプロパティを追加
    for (let i = 0; i < 1000; i++) {
    ;(largeError as any)[`prop${i}`] = `value${i}`
    }
    const start = Date.now()
    const result = isGameError(largeError)
    const elapsed = Date.now() - start
    expect(result).toBe(true)
    expect(elapsed).toBeLessThan(10) // 効率的な処理時間
  })
)
  describe('型安全性の検証', () => {
  it.effect('型ガードによる型ナローイング', () => Effect.gen(function* () {
    const error: unknown = GameError({ message: 'Test error', code: 'TEST_001'
}) {
    // TypeScriptコンパイラによって型がGameErrorに絞り込まれる
    expect(error._tag).toBe('GameError')
    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_001')
    } else {
    // このブランチには到達しないはず
    expect.fail('Should have been identified as GameError')
    }
    if (isErrorOfType(error, 'GameError')) {
    // 汎用ガードでも型ナローイングが機能する
    expect(error._tag).toBe('GameError')
    }
  })
)
})