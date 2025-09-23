import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Match, Effect, Schema } from 'effect'
import type { AllErrors } from '../AllErrors'
import { GameError, InvalidStateError, ValidationError, type AnyGameError } from '../GameErrors'
import { NetworkError, ConnectionError, TimeoutError, type AnyNetworkError } from '../NetworkErrors'

describe('AllErrors', () => {
  describe('型の包含関係', () => {
  it.effect('GameErrorがAllErrorsに包含される', () => Effect.gen(function* () {
    const gameError = GameError({
    message: 'Test game error',
    code: 'GAME_001',
})
    // 型レベルでの検証（コンパイル時チェック）
    const allError: AllErrors = gameError
    expect(allError._tag).toBe('GameError')
  })
),
  Effect.gen(function* () {
        const networkError = NetworkError({
          message: 'Test network error',
          code: 'NET_001',
        })

        // 型レベルでの検証（コンパイル時チェック）
        const allError: AllErrors = networkError
        expect(allError._tag).toBe('NetworkError')
      })
    it.effect('すべてのゲームエラーサブタイプがAllErrorsに包含される', () => Effect.gen(function* () {
    const gameErrors: AnyGameError[] = [
    GameError({ message: 'test', code: 'TEST_001'
    }),
    InvalidStateError({
    message: 'test',
    currentState: 'loading',
    expectedState: 'ready',
    }),
    ValidationError({
    message: 'test',
    field: 'username',
    value: '',
    }),
    ]
    gameErrors.forEach((error) => {
    // 型レベルでの検証（コンパイル時チェック）
    const allError: AllErrors = error
    expect(allError._tag).toBeDefined()
    expect(allError.message).toBeDefined()
  })
),
    Effect.gen(function* () {
    const networkErrors: AnyNetworkError[] = [
    NetworkError({ message: 'test', code: 'NET_001' 
    }),
    ConnectionError({
    message: 'test',
    serverUrl: 'ws://localhost:8080',
    attemptNumber: 1,
    maxAttempts: 3,
    }),
    TimeoutError({
    message: 'test',
    operation: 'handshake',
    timeoutMs: 5000,
    }),
    ]

    networkErrors.forEach((error) => {
    // 型レベルでの検証（コンパイル時チェック）
    const allError: AllErrors = error
    expect(allError._tag).toBeDefined()
    expect(allError.message).toBeDefined()
    })
    })

    describe('Match.valueによるパターンマッチング', () => {
  it.effect('すべてのエラータイプが適切に処理される', () => Effect.gen(function* () {
    const errors: AllErrors[] = [
    GameError({ message: 'Game error', code: 'GAME_001'
}),
    NetworkError({ message: 'Network error', code: 'NET_001' }),
    ValidationError({ message: 'Validation error', field: 'test', value: 'invalid' }),
    ]
    errors.forEach((error) => {
    const handled = Match.value(error).pipe(
    Match.tag('GameError', () => true),
    Match.tag('NetworkError', () => true),
    Match.tag('ValidationError', () => true),
    Match.tag('InvalidStateError', () => true),
    Match.tag('ConnectionError', () => true),
    Match.tag('TimeoutError', () => true),
    Match.orElse(() => {
    // すべてのケースがカバーされているはず
    expect.fail(`Unknown error tag: ${(error as any)._tag}`)
  })
).toBe(true)
        })
      })
  })

  describe('Property-based testing', () => {
  it.prop('AllErrors型の網羅性テスト', [
  Schema.Union(
  Schema.Struct({
  _tag: Schema.Union(Schema.Literal('GameError'), Schema.Literal('ValidationError'), Schema.Literal('InvalidStateError')),
  message: Schema.String.pipe(Schema.minLength(1))
}),
        Schema.Struct({
          _tag: Schema.Union(Schema.Literal('NetworkError'), Schema.Literal('ConnectionError'), Schema.Literal('TimeoutError')),
          message: Schema.String.pipe(Schema.minLength(1))})
    ], ({ union: error })

      Effect.gen(function* () {
        // AllErrors型として扱えることを検証
        const allError: AllErrors = error as AllErrors
        expect(allError._tag).toBeDefined()
        expect(allError.message).toBeDefined()
        expect(typeof allError._tag).toBe('string')
        expect(typeof allError.message).toBe('string')
      })
    it.prop('エラーのシリアライゼーション可能性', [
      Schema.Union(
        Schema.Struct({
          _tag: Schema.Literal('GameError'),
          message: Schema.String
        }),
        Schema.Struct({
          _tag: Schema.Literal('NetworkError'),
          message: Schema.String
        })
    ], ({ union: error })

      Effect.gen(function* () {
        const allError: AllErrors = error as AllErrors

        // JSON.stringify/parseが正常に動作することを検証
        const serialized = JSON.stringify(allError)
        expect(serialized).toBeDefined()
        expect(typeof serialized).toBe('string')

        const deserialized = JSON.parse(serialized)
        expect(deserialized._tag).toBe(allError._tag)
        expect(deserialized.message).toBe(allError.message)
      })
  })

  describe('型安全性の検証', () => {
  it.effect('型ナローイングが正しく動作する', () => Effect.gen(function* () {
    const error: AllErrors = GameError({ message: 'test', code: 'TEST_001'
})
    // 型ナローイングのテスト
    if (error._tag === 'GameError') {
    // この時点でerrorはGameError型に絞り込まれる
    expect(error.message).toBeDefined()
    expect(error.code).toBeDefined() // GameError固有のプロパティ
    }
  })
),
  Effect.gen(function* () {
        const error: AllErrors = GameError({ message: 'test', code: 'TEST_001' })

        const handleError = (error: AllErrors): string => {
          // Match.valueを使用したパターンマッチング
          const gameErrorTags = [
            'GameError',
            'InvalidStateError',
            'ResourceNotFoundError',
            'ValidationError',
            'PerformanceError',
            'ConfigError',
            'RenderError',
            'WorldGenerationError',
            'EntityError',
            'PhysicsError',
          ] as const

          const networkErrorTags = [
            'NetworkError',
            'ConnectionError',
            'TimeoutError',
            'ProtocolError',
            'AuthenticationError',
            'SessionError',
            'SyncError',
            'RateLimitError',
            'WebSocketError',
            'PacketError',
            'ServerError',
            'P2PError',
          ] as const

          return Match.value(error._tag).pipe(
            Match.when(
              (tag): tag is (typeof gameErrorTags)[number] => gameErrorTags.includes(tag as any),
              () => 'Game Error'
            ),
            Match.when(
              (tag): tag is (typeof networkErrorTags)[number] => networkErrorTags.includes(tag as any),
              () => 'Network Error'
            ),
            Match.orElse((tag) => {
              // 全ケースが網羅されている場合、このブランチは到達不可能
              throw new Error(`Unhandled error tag: ${tag}`)
            })
        }

        expect(handleError(error)).toBe('Game Error')
      })
  })

  describe('エラーの不変条件', () => {
  it.effect('すべてのエラーが必須プロパティを持つ', () => Effect.gen(function* () {
    const errors: AllErrors[] = [
    GameError({ message: 'game error', code: 'GAME_001'
}),
    NetworkError({ message: 'network error', code: 'NET_001' }),
    ValidationError({ message: 'validation error', field: 'test', value: 'test' }),
    ConnectionError({
    message: 'connection error',
    serverUrl: 'test',
    attemptNumber: 1,
    maxAttempts: 3,
    }),
    ]
    errors.forEach((error) => {
    // 必須プロパティの存在確認
    expect(error._tag).toBeDefined()
    expect(error.message).toBeDefined()
    // 必須プロパティの型確認
    expect(typeof error._tag).toBe('string')
    expect(typeof error.message).toBe('string')
    // 必須プロパティの値確認
    expect(error._tag.length).toBeGreaterThan(0)
    expect(error.message.length).toBeGreaterThan(0)
  })
)
})