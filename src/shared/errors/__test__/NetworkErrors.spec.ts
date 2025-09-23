import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'
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
} from '../NetworkErrors'

describe('NetworkErrors', () => {
  describe('NetworkError', () => {
    it('should create a basic network error', () => {
      const error = NetworkError({
        message: 'Network request failed',
        code: 'NET_001',
        statusCode: 500,
        cause: new Error('Connection refused'),
      })

      expect(error._tag).toBe('NetworkError')
      expect(error.message).toBe('Network request failed')
      expect(error.code).toBe('NET_001')
      expect(error.statusCode).toBe(500)
    })

    it('should work with Effect', () => {
      const program = Effect.fail(
        NetworkError({
          message: 'Test error',
        })
      )

      const result = Effect.runSyncExit(program)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(error?._tag).toBe('NetworkError')
      }
    })
  })

  describe('ConnectionError', () => {
    it('should track connection attempts', () => {
      const error = ConnectionError({
        message: 'Failed to connect to server',
        serverUrl: 'ws://localhost:8080',
        attemptNumber: 3,
        maxAttempts: 5,
        lastError: 'Connection timeout',
      })

      expect(error._tag).toBe('ConnectionError')
      expect(error.serverUrl).toBe('ws://localhost:8080')
      expect(error.attemptNumber).toBe(3)
      expect(error.maxAttempts).toBe(5)
    })
  })

  describe('TimeoutError', () => {
    it('should track timeout details', () => {
      const error = TimeoutError({
        message: 'Request timed out',
        operation: 'fetchChunkData',
        timeoutMs: 5000,
        elapsedMs: 5100,
      })

      expect(error._tag).toBe('TimeoutError')
      expect(error.operation).toBe('fetchChunkData')
      expect(error.timeoutMs).toBe(5000)
      expect(error.elapsedMs).toBe(5100)
    })
  })

  describe('ProtocolError', () => {
    it('should track protocol mismatches', () => {
      const error = ProtocolError({
        message: 'Protocol version mismatch',
        expectedVersion: '1.20.4',
        actualVersion: '1.19.0',
        packetType: 'handshake',
      })

      expect(error._tag).toBe('ProtocolError')
      expect(error.expectedVersion).toBe('1.20.4')
      expect(error.actualVersion).toBe('1.19.0')
      expect(error.packetType).toBe('handshake')
    })
  })

  describe('AuthenticationError', () => {
    it('should track authentication failures', () => {
      const error = AuthenticationError({
        message: 'Authentication failed',
        username: 'player123',
        reason: 'invalid_credentials',
        retryAfter: 60000,
      })

      expect(error._tag).toBe('AuthenticationError')
      expect(error.username).toBe('player123')
      expect(error.reason).toBe('invalid_credentials')
      expect(error.retryAfter).toBe(60000)
    })
  })

  describe('SessionError', () => {
    it('should track session issues', () => {
      const error = SessionError({
        message: 'Session expired',
        sessionId: 'sess_123456',
        reason: 'expired',
        createdAt: Date.now() - 3600000,
        expiresAt: Date.now(),
      })

      expect(error._tag).toBe('SessionError')
      expect(error.sessionId).toBe('sess_123456')
      expect(error.reason).toBe('expired')
    })
  })

  describe('SyncError', () => {
    it('should track synchronization conflicts', () => {
      const error = SyncError({
        message: 'Data sync conflict',
        dataType: 'playerInventory',
        localVersion: 5,
        remoteVersion: 7,
        conflictResolution: 'remote',
      })

      expect(error._tag).toBe('SyncError')
      expect(error.dataType).toBe('playerInventory')
      expect(error.localVersion).toBe(5)
      expect(error.remoteVersion).toBe(7)
      expect(error.conflictResolution).toBe('remote')
    })
  })

  describe('RateLimitError', () => {
    it('should track rate limiting', () => {
      const error = RateLimitError({
        message: 'Rate limit exceeded',
        limit: 100,
        windowMs: 60000,
        retryAfter: 30000,
        endpoint: '/api/chunks',
      })

      expect(error._tag).toBe('RateLimitError')
      expect(error.limit).toBe(100)
      expect(error.windowMs).toBe(60000)
      expect(error.retryAfter).toBe(30000)
      expect(error.endpoint).toBe('/api/chunks')
    })
  })

  describe('WebSocketError', () => {
    it('should track WebSocket errors', () => {
      const error = WebSocketError({
        message: 'WebSocket connection closed',
        code: 1006,
        reason: 'Abnormal closure',
        wasClean: false,
        reconnectAttempt: 2,
      })

      expect(error._tag).toBe('WebSocketError')
      expect(error.code).toBe(1006)
      expect(error.reason).toBe('Abnormal closure')
      expect(error.wasClean).toBe(false)
      expect(error.reconnectAttempt).toBe(2)
    })
  })

  describe('PacketError', () => {
    it('should track packet processing errors', () => {
      const error = PacketError({
        message: 'Invalid packet received',
        packetId: 'pkt_001',
        packetType: 'player_move',
        size: 256,
        direction: 'incoming',
        malformed: true,
      })

      expect(error._tag).toBe('PacketError')
      expect(error.packetId).toBe('pkt_001')
      expect(error.packetType).toBe('player_move')
      expect(error.direction).toBe('incoming')
      expect(error.malformed).toBe(true)
    })
  })

  describe('ServerError', () => {
    it('should track server-side errors', () => {
      const error = ServerError({
        message: 'Internal server error',
        statusCode: 500,
        errorCode: 'INTERNAL_ERROR',
        details: { component: 'ChunkManager' },
        traceId: 'trace_123456',
      })

      expect(error._tag).toBe('ServerError')
      expect(error.statusCode).toBe(500)
      expect(error.errorCode).toBe('INTERNAL_ERROR')
      expect(error.traceId).toBe('trace_123456')
    })
  })

  describe('P2PError', () => {
    it('should track P2P connection errors', () => {
      const error = P2PError({
        message: 'P2P connection failed',
        peerId: 'peer_abc123',
        connectionState: 'failed',
        iceState: 'disconnected',
        signalType: 'offer',
      })

      expect(error._tag).toBe('P2PError')
      expect(error.peerId).toBe('peer_abc123')
      expect(error.connectionState).toBe('failed')
      expect(error.iceState).toBe('disconnected')
      expect(error.signalType).toBe('offer')
    })
  })
})
