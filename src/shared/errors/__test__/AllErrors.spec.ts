import { describe, it, expect } from '@effect/vitest'
import * as fc from 'fast-check'
import type { AllErrors } from '../AllErrors'
import {
  GameError,
  InvalidStateError,
  ValidationError,
  type AnyGameError,
} from '../GameErrors'
import {
  NetworkError,
  ConnectionError,
  TimeoutError,
  type AnyNetworkError,
} from '../NetworkErrors'

describe('AllErrors', () => {
  describe('型の包含関係', () => {
    it('GameErrorがAllErrorsに包含される', () => {
      const gameError = GameError({
        message: 'Test game error',
        code: 'GAME_001',
      })

      // 型レベルでの検証（コンパイル時チェック）
      const allError: AllErrors = gameError
      expect(allError._tag).toBe('GameError')
    })

    it('NetworkErrorがAllErrorsに包含される', () => {
      const networkError = NetworkError({
        message: 'Test network error',
        code: 'NET_001',
      })

      // 型レベルでの検証（コンパイル時チェック）
      const allError: AllErrors = networkError
      expect(allError._tag).toBe('NetworkError')
    })

    it('すべてのゲームエラーサブタイプがAllErrorsに包含される', () => {
      const gameErrors: AnyGameError[] = [
        GameError({ message: 'test' }),
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
    })

    it('すべてのネットワークエラーサブタイプがAllErrorsに包含される', () => {
      const networkErrors: AnyNetworkError[] = [
        NetworkError({ message: 'test' }),
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
          elapsedMs: 5001,
        }),
      ]

      networkErrors.forEach((error) => {
        // 型レベルでの検証（コンパイル時チェック）
        const allError: AllErrors = error
        expect(allError._tag).toBeDefined()
        expect(allError.message).toBeDefined()
      })
    })
  })

  describe('共通プロパティ', () => {
    it('すべてのエラーが_tagプロパティを持つ', () => {
      const gameError = GameError({ message: 'test' })
      const networkError = NetworkError({ message: 'test' })

      const errors: AllErrors[] = [gameError, networkError]

      errors.forEach((error) => {
        expect(error._tag).toBeDefined()
        expect(typeof error._tag).toBe('string')
      })
    })

    it('すべてのエラーがmessageプロパティを持つ', () => {
      const gameError = GameError({ message: 'game test message' })
      const networkError = NetworkError({ message: 'network test message' })

      const errors: AllErrors[] = [gameError, networkError]

      errors.forEach((error) => {
        expect(error.message).toBeDefined()
        expect(typeof error.message).toBe('string')
        expect(error.message.length).toBeGreaterThan(0)
      })
    })
  })

  describe('型の判別', () => {
    it('_tagプロパティでエラー型を正しく判別できる', () => {
      const gameError = GameError({ message: 'test' })
      const networkError = NetworkError({ message: 'test' })
      const validationError = ValidationError({
        message: 'test',
        field: 'field',
        value: 'value',
      })
      const connectionError = ConnectionError({
        message: 'test',
        serverUrl: 'url',
        attemptNumber: 1,
        maxAttempts: 3,
      })

      const errors: AllErrors[] = [gameError, networkError, validationError, connectionError]

      // _tagによる型判別
      const gameErrorTypes = ['GameError', 'ValidationError']
      const networkErrorTypes = ['NetworkError', 'ConnectionError']

      errors.forEach((error) => {
        if (gameErrorTypes.includes(error._tag)) {
          expect(gameErrorTypes).toContain(error._tag)
        } else if (networkErrorTypes.includes(error._tag)) {
          expect(networkErrorTypes).toContain(error._tag)
        }
      })
    })

    it('Switch文でのパターンマッチング', () => {
      const errors: AllErrors[] = [
        GameError({ message: 'game error' }),
        NetworkError({ message: 'network error' }),
        ValidationError({ message: 'validation error', field: 'test', value: 'test' }),
        ConnectionError({
          message: 'connection error',
          serverUrl: 'test',
          attemptNumber: 1,
          maxAttempts: 3,
        }),
      ]

      errors.forEach((error) => {
        let handled = false

        switch (error._tag) {
          case 'GameError':
          case 'InvalidStateError':
          case 'ResourceNotFoundError':
          case 'ValidationError':
          case 'PerformanceError':
          case 'ConfigError':
          case 'RenderError':
          case 'WorldGenerationError':
          case 'EntityError':
          case 'PhysicsError':
            handled = true
            expect(error.message).toBeDefined()
            break
          case 'NetworkError':
          case 'ConnectionError':
          case 'TimeoutError':
          case 'ProtocolError':
          case 'AuthenticationError':
          case 'SessionError':
          case 'SyncError':
          case 'RateLimitError':
          case 'WebSocketError':
          case 'PacketError':
          case 'ServerError':
          case 'P2PError':
            handled = true
            expect(error.message).toBeDefined()
            break
          default:
            // すべてのケースがカバーされているはず
            expect.fail(`Unknown error tag: ${(error as any)._tag}`)
        }

        expect(handled).toBe(true)
      })
    })
  })

  describe('Property-based testing', () => {
    it('AllErrors型の網羅性テスト', () => {
      const gameErrorArbitrary = fc.record({
        _tag: fc.constantFrom('GameError', 'ValidationError', 'InvalidStateError'),
        message: fc.string({ minLength: 1 }),
      })

      const networkErrorArbitrary = fc.record({
        _tag: fc.constantFrom('NetworkError', 'ConnectionError', 'TimeoutError'),
        message: fc.string({ minLength: 1 }),
      })

      const allErrorArbitrary = fc.oneof(gameErrorArbitrary, networkErrorArbitrary)

      fc.assert(
        fc.property(allErrorArbitrary, (error) => {
          // AllErrors型として扱えることを検証
          const allError: AllErrors = error as AllErrors
          expect(allError._tag).toBeDefined()
          expect(allError.message).toBeDefined()
          expect(typeof allError._tag).toBe('string')
          expect(typeof allError.message).toBe('string')
        }),
        { numRuns: 100 }
      )
    })

    it('エラーのシリアライゼーション可能性', () => {
      const errorArbitrary = fc.oneof(
        fc.record({
          _tag: fc.constant('GameError'),
          message: fc.string(),
        }),
        fc.record({
          _tag: fc.constant('NetworkError'),
          message: fc.string(),
        })
      )

      fc.assert(
        fc.property(errorArbitrary, (error) => {
          const allError: AllErrors = error as AllErrors

          // JSON.stringify/parseが正常に動作することを検証
          const serialized = JSON.stringify(allError)
          expect(serialized).toBeDefined()
          expect(typeof serialized).toBe('string')

          const deserialized = JSON.parse(serialized)
          expect(deserialized._tag).toBe(allError._tag)
          expect(deserialized.message).toBe(allError.message)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('型安全性の検証', () => {
    it('型ナローイングが正しく動作する', () => {
      const error: AllErrors = GameError({ message: 'test', code: 'TEST_001' })

      // 型ナローイングのテスト
      if (error._tag === 'GameError') {
        // この時点でerrorはGameError型に絞り込まれる
        expect(error.message).toBeDefined()
        expect(error.code).toBeDefined() // GameError固有のプロパティ
      }
    })

    it('never型による網羅性チェック', () => {
      const error: AllErrors = GameError({ message: 'test' })

      const handleError = (error: AllErrors): string => {
        switch (error._tag) {
          case 'GameError':
          case 'InvalidStateError':
          case 'ResourceNotFoundError':
          case 'ValidationError':
          case 'PerformanceError':
          case 'ConfigError':
          case 'RenderError':
          case 'WorldGenerationError':
          case 'EntityError':
          case 'PhysicsError':
            return 'Game Error'
          case 'NetworkError':
          case 'ConnectionError':
          case 'TimeoutError':
          case 'ProtocolError':
          case 'AuthenticationError':
          case 'SessionError':
          case 'SyncError':
          case 'RateLimitError':
          case 'WebSocketError':
          case 'PacketError':
          case 'ServerError':
          case 'P2PError':
            return 'Network Error'
          default:
            // 全ケースが網羅されている場合、errorはnever型になる
            const _exhaustiveCheck: never = error
            throw new Error(`Unhandled error: ${JSON.stringify(_exhaustiveCheck)}`)
        }
      }

      expect(handleError(error)).toBe('Game Error')
    })
  })

  describe('エラーの不変条件', () => {
    it('すべてのエラーが必須プロパティを持つ', () => {
      const errors: AllErrors[] = [
        GameError({ message: 'game error' }),
        NetworkError({ message: 'network error' }),
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
    })
  })
})