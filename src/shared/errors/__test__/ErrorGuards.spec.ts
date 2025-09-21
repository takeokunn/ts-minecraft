import { describe, it, expect } from '@effect/vitest'
import * as fc from 'fast-check'
import { ErrorGuards } from '../ErrorGuards'
import {
  GameError,
  InvalidStateError,
  ResourceNotFoundError,
  ValidationError,
  PerformanceError,
  ConfigError,
  RenderError,
  WorldGenerationError,
  EntityError,
  PhysicsError,
  type AnyGameError,
} from '../GameErrors'
import {
  NetworkError,
  ConnectionError,
  TimeoutError,
  ProtocolError,
  AuthenticationError,
  SessionError,
  SyncError,
  RateLimitError,
  WebSocketError,
  PacketError,
  ServerError,
  P2PError,
  type AnyNetworkError,
} from '../NetworkErrors'

describe('ErrorGuards', () => {
  describe('isGameError', () => {
    it('GameErrorを正しく識別する', () => {
      const error = GameError({
        message: 'Test game error',
        code: 'GAME_001',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('InvalidStateErrorを正しく識別する', () => {
      const error = InvalidStateError({
        message: 'Invalid state',
        currentState: 'loading',
        expectedState: 'ready',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('ResourceNotFoundErrorを正しく識別する', () => {
      const error = ResourceNotFoundError({
        message: 'Resource not found',
        resourceType: 'texture',
        resourceId: 'stone.png',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('ValidationErrorを正しく識別する', () => {
      const error = ValidationError({
        message: 'Invalid value',
        field: 'username',
        value: '',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('PerformanceErrorを正しく識別する', () => {
      const error = PerformanceError({
        message: 'Low FPS detected',
        metric: 'fps',
        currentValue: 30,
        threshold: 60,
        severity: 'warning',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('ConfigErrorを正しく識別する', () => {
      const error = ConfigError({
        message: 'Invalid config',
        configKey: 'graphics.quality',
        configValue: 'invalid',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('RenderErrorを正しく識別する', () => {
      const error = RenderError({
        message: 'Render failed',
        component: 'terrain',
        phase: 'render',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('WorldGenerationErrorを正しく識別する', () => {
      const error = WorldGenerationError({
        message: 'Chunk generation failed',
        chunkX: 0,
        chunkZ: 0,
        generationType: 'terrain',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('EntityErrorを正しく識別する', () => {
      const error = EntityError({
        message: 'Entity operation failed',
        entityId: 'player-123',
        entityType: 'player',
        operation: 'move',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('PhysicsErrorを正しく識別する', () => {
      const error = PhysicsError({
        message: 'Physics calculation failed',
        calculationType: 'collision',
      })

      expect(ErrorGuards.isGameError(error)).toBe(true)
    })

    it('ネットワークエラーを拒否する', () => {
      const error = NetworkError({
        message: 'Network error',
        code: 'NET_001',
      })

      expect(ErrorGuards.isGameError(error)).toBe(false)
    })

    it('null値を拒否する', () => {
      expect(ErrorGuards.isGameError(null)).toBe(false)
    })

    it('undefined値を拒否する', () => {
      expect(ErrorGuards.isGameError(undefined)).toBe(false)
    })

    it('プリミティブ型を拒否する', () => {
      expect(ErrorGuards.isGameError('string')).toBe(false)
      expect(ErrorGuards.isGameError(123)).toBe(false)
      expect(ErrorGuards.isGameError(true)).toBe(false)
    })

    it('_tagプロパティがないオブジェクトを拒否する', () => {
      const error = { message: 'error' }
      expect(ErrorGuards.isGameError(error)).toBe(false)
    })

    it('無効な_tag値を持つオブジェクトを拒否する', () => {
      const error = { _tag: 'UnknownError', message: 'error' }
      expect(ErrorGuards.isGameError(error)).toBe(false)
    })
  })

  describe('isNetworkError', () => {
    it('NetworkErrorを正しく識別する', () => {
      const error = NetworkError({
        message: 'Network error',
        code: 'NET_001',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('ConnectionErrorを正しく識別する', () => {
      const error = ConnectionError({
        message: 'Connection failed',
        serverUrl: 'ws://localhost:8080',
        attemptNumber: 1,
        maxAttempts: 3,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('TimeoutErrorを正しく識別する', () => {
      const error = TimeoutError({
        message: 'Request timeout',
        operation: 'handshake',
        timeoutMs: 5000,
        elapsedMs: 5001,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('ProtocolErrorを正しく識別する', () => {
      const error = ProtocolError({
        message: 'Protocol mismatch',
        expectedVersion: '1.0',
        actualVersion: '2.0',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('AuthenticationErrorを正しく識別する', () => {
      const error = AuthenticationError({
        message: 'Authentication failed',
        username: 'testuser',
        reason: 'invalid_credentials',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('SessionErrorを正しく識別する', () => {
      const error = SessionError({
        message: 'Session expired',
        sessionId: 'session-123',
        reason: 'expired',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('SyncErrorを正しく識別する', () => {
      const error = SyncError({
        message: 'Data sync failed',
        dataType: 'playerData',
        localVersion: 1,
        remoteVersion: 2,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('RateLimitErrorを正しく識別する', () => {
      const error = RateLimitError({
        message: 'Rate limit exceeded',
        limit: 100,
        windowMs: 60000,
        retryAfter: 30000,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('WebSocketErrorを正しく識別する', () => {
      const error = WebSocketError({
        message: 'WebSocket error',
        code: 1006,
        reason: 'Abnormal closure',
        wasClean: false,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('PacketErrorを正しく識別する', () => {
      const error = PacketError({
        message: 'Malformed packet',
        packetId: 'packet-123',
        packetType: 'position',
        size: 256,
        direction: 'incoming',
        malformed: true,
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('ServerErrorを正しく識別する', () => {
      const error = ServerError({
        message: 'Internal server error',
        statusCode: 500,
        errorCode: 'INTERNAL_ERROR',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('P2PErrorを正しく識別する', () => {
      const error = P2PError({
        message: 'P2P connection failed',
        peerId: 'peer-123',
        connectionState: 'failed',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(true)
    })

    it('ゲームエラーを拒否する', () => {
      const error = GameError({
        message: 'Game error',
        code: 'GAME_001',
      })

      expect(ErrorGuards.isNetworkError(error)).toBe(false)
    })

    it('null値を拒否する', () => {
      expect(ErrorGuards.isNetworkError(null)).toBe(false)
    })

    it('undefined値を拒否する', () => {
      expect(ErrorGuards.isNetworkError(undefined)).toBe(false)
    })

    it('プリミティブ型を拒否する', () => {
      expect(ErrorGuards.isNetworkError('string')).toBe(false)
      expect(ErrorGuards.isNetworkError(123)).toBe(false)
      expect(ErrorGuards.isNetworkError(true)).toBe(false)
    })

    it('_tagプロパティがないオブジェクトを拒否する', () => {
      const error = { message: 'error' }
      expect(ErrorGuards.isNetworkError(error)).toBe(false)
    })

    it('無効な_tag値を持つオブジェクトを拒否する', () => {
      const error = { _tag: 'UnknownError', message: 'error' }
      expect(ErrorGuards.isNetworkError(error)).toBe(false)
    })
  })

  describe('isRetryableError', () => {
    it('NetworkErrorをretryableとして識別する', () => {
      const error = NetworkError({
        message: 'Network error',
        code: 'NET_001',
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(true)
    })

    it('ConnectionErrorをretryableとして識別する', () => {
      const error = ConnectionError({
        message: 'Connection failed',
        serverUrl: 'ws://localhost:8080',
        attemptNumber: 1,
        maxAttempts: 3,
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(true)
    })

    it('TimeoutErrorをretryableとして識別する', () => {
      const error = TimeoutError({
        message: 'Request timeout',
        operation: 'handshake',
        timeoutMs: 5000,
        elapsedMs: 5001,
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(true)
    })

    it('ServerErrorをretryableとして識別する', () => {
      const error = ServerError({
        message: 'Internal server error',
        statusCode: 500,
        errorCode: 'INTERNAL_ERROR',
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(true)
    })

    it('AuthenticationErrorをnon-retryableとして識別する', () => {
      const error = AuthenticationError({
        message: 'Authentication failed',
        username: 'testuser',
        reason: 'invalid_credentials',
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(false)
    })

    it('ValidationErrorをnon-retryableとして識別する', () => {
      const error = ValidationError({
        message: 'Invalid value',
        field: 'username',
        value: '',
      })

      expect(ErrorGuards.isRetryableError(error)).toBe(false)
    })

    it('null値をnon-retryableとして識別する', () => {
      expect(ErrorGuards.isRetryableError(null)).toBe(false)
    })

    it('undefined値をnon-retryableとして識別する', () => {
      expect(ErrorGuards.isRetryableError(undefined)).toBe(false)
    })

    it('プリミティブ型をnon-retryableとして識別する', () => {
      expect(ErrorGuards.isRetryableError('string')).toBe(false)
      expect(ErrorGuards.isRetryableError(123)).toBe(false)
      expect(ErrorGuards.isRetryableError(true)).toBe(false)
    })

    it('_tagプロパティがないオブジェクトをnon-retryableとして識別する', () => {
      const error = { message: 'error' }
      expect(ErrorGuards.isRetryableError(error)).toBe(false)
    })

    it('未知の_tag値をnon-retryableとして識別する', () => {
      const error = { _tag: 'UnknownError', message: 'error' }
      expect(ErrorGuards.isRetryableError(error)).toBe(false)
    })
  })

  describe('Property-based testing', () => {
    it('有効なゲームエラーのプロパティテスト', () => {
      const gameErrorArbitrary = fc.oneof(
        fc.record({
          _tag: fc.constant('GameError'),
          message: fc.string(),
        }),
        fc.record({
          _tag: fc.constant('InvalidStateError'),
          message: fc.string(),
          currentState: fc.string(),
          expectedState: fc.string(),
        }),
        fc.record({
          _tag: fc.constant('ValidationError'),
          message: fc.string(),
          field: fc.string(),
          value: fc.anything(),
        })
      )

      fc.assert(
        fc.property(gameErrorArbitrary, (error) => {
          expect(ErrorGuards.isGameError(error)).toBe(true)
          expect(ErrorGuards.isNetworkError(error)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })

    it('有効なネットワークエラーのプロパティテスト', () => {
      const networkErrorArbitrary = fc.oneof(
        fc.record({
          _tag: fc.constant('NetworkError'),
          message: fc.string(),
        }),
        fc.record({
          _tag: fc.constant('ConnectionError'),
          message: fc.string(),
          serverUrl: fc.string(),
          attemptNumber: fc.integer({ min: 1 }),
          maxAttempts: fc.integer({ min: 1 }),
        }),
        fc.record({
          _tag: fc.constant('TimeoutError'),
          message: fc.string(),
          operation: fc.string(),
          timeoutMs: fc.integer({ min: 0 }),
          elapsedMs: fc.integer({ min: 0 }),
        })
      )

      fc.assert(
        fc.property(networkErrorArbitrary, (error) => {
          expect(ErrorGuards.isNetworkError(error)).toBe(true)
          expect(ErrorGuards.isGameError(error)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })

    it('無効な値のプロパティテスト', () => {
      const invalidValueArbitrary = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.array(fc.anything()),
        fc.record({
          message: fc.string(),
          // _tagプロパティがない
        }),
        fc.record({
          _tag: fc.string().filter(tag =>
            !['GameError', 'InvalidStateError', 'ResourceNotFoundError', 'ValidationError',
              'PerformanceError', 'ConfigError', 'RenderError', 'WorldGenerationError',
              'EntityError', 'PhysicsError', 'NetworkError', 'ConnectionError', 'TimeoutError',
              'ProtocolError', 'AuthenticationError', 'SessionError', 'SyncError',
              'RateLimitError', 'WebSocketError', 'PacketError', 'ServerError', 'P2PError'].includes(tag)
          ),
          message: fc.string(),
        })
      )

      fc.assert(
        fc.property(invalidValueArbitrary, (value) => {
          expect(ErrorGuards.isGameError(value)).toBe(false)
          expect(ErrorGuards.isNetworkError(value)).toBe(false)
          expect(ErrorGuards.isRetryableError(value)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })

    it('retryableエラーのプロパティテスト', () => {
      const retryableErrorArbitrary = fc.oneof(
        fc.record({
          _tag: fc.constant('NetworkError'),
          message: fc.string(),
        }),
        fc.record({
          _tag: fc.constant('ConnectionError'),
          message: fc.string(),
          serverUrl: fc.string(),
          attemptNumber: fc.integer({ min: 1 }),
          maxAttempts: fc.integer({ min: 1 }),
        }),
        fc.record({
          _tag: fc.constant('TimeoutError'),
          message: fc.string(),
          operation: fc.string(),
          timeoutMs: fc.integer({ min: 0 }),
          elapsedMs: fc.integer({ min: 0 }),
        }),
        fc.record({
          _tag: fc.constant('ServerError'),
          message: fc.string(),
          statusCode: fc.integer(),
        })
      )

      fc.assert(
        fc.property(retryableErrorArbitrary, (error) => {
          expect(ErrorGuards.isRetryableError(error)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('non-retryableエラーのプロパティテスト', () => {
      const nonRetryableErrorArbitrary = fc.oneof(
        fc.record({
          _tag: fc.constant('AuthenticationError'),
          message: fc.string(),
          reason: fc.constantFrom('invalid_credentials', 'token_expired', 'account_locked', 'permission_denied'),
        }),
        fc.record({
          _tag: fc.constant('ValidationError'),
          message: fc.string(),
          field: fc.string(),
          value: fc.anything(),
        }),
        fc.record({
          _tag: fc.constant('ProtocolError'),
          message: fc.string(),
          expectedVersion: fc.string(),
        })
      )

      fc.assert(
        fc.property(nonRetryableErrorArbitrary, (error) => {
          expect(ErrorGuards.isRetryableError(error)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('型ガードの一貫性', () => {
    it('同じエラーに対して一貫した結果を返す', () => {
      const gameError = GameError({ message: 'test', code: 'TEST' })
      const networkError = NetworkError({ message: 'test', code: 'TEST' })

      // 同じエラーオブジェクトに対して常に同じ結果を返すことを検証
      expect(ErrorGuards.isGameError(gameError)).toBe(true)
      expect(ErrorGuards.isGameError(gameError)).toBe(true) // 2回目も同じ結果

      expect(ErrorGuards.isNetworkError(networkError)).toBe(true)
      expect(ErrorGuards.isNetworkError(networkError)).toBe(true) // 2回目も同じ結果

      // 相互排他性を検証
      expect(ErrorGuards.isGameError(networkError)).toBe(false)
      expect(ErrorGuards.isNetworkError(gameError)).toBe(false)
    })

    it('エラーの階層関係を正しく処理する', () => {
      const gameErrors: AnyGameError[] = [
        GameError({ message: 'test' }),
        InvalidStateError({ message: 'test', currentState: 'a', expectedState: 'b' }),
        ValidationError({ message: 'test', field: 'test', value: 'test' }),
      ]

      const networkErrors: AnyNetworkError[] = [
        NetworkError({ message: 'test' }),
        ConnectionError({ message: 'test', serverUrl: 'test', attemptNumber: 1, maxAttempts: 3 }),
        TimeoutError({ message: 'test', operation: 'test', timeoutMs: 1000, elapsedMs: 1001 }),
      ]

      // すべてのゲームエラーがisGameError関数で正しく識別される
      gameErrors.forEach(error => {
        expect(ErrorGuards.isGameError(error)).toBe(true)
        expect(ErrorGuards.isNetworkError(error)).toBe(false)
      })

      // すべてのネットワークエラーがisNetworkError関数で正しく識別される
      networkErrors.forEach(error => {
        expect(ErrorGuards.isNetworkError(error)).toBe(true)
        expect(ErrorGuards.isGameError(error)).toBe(false)
      })
    })
  })
})