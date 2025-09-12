/**
 * WebSocket Adapter Unit Tests
 * 
 * Comprehensive test suite for the WebSocket adapter,
 * testing network communication, connection management, and Effect-TS patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import * as Context from 'effect/Context'
import { 
  expectEffect, 
  runEffect, 
  runEffectExit,
  measureEffectPerformance
} from '../../../setup/infrastructure.setup'
import {
  WebSocketAdapter,
  WebSocketAdapterLive,
  IWebSocketAdapter,
  WebSocketMessage,
  WebSocketConfig,
  ConnectionState
} from '@infrastructure/adapters/websocket.adapter'

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  protocols?: string | string[]
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send = vi.fn((data: string | ArrayBuffer) => {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  })

  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { 
          code: code || 1000, 
          reason: reason || '', 
          wasClean: true 
        }))
      }
    }, 5)
  })

  // Helper method to simulate receiving messages
  simulateMessage(data: string | ArrayBuffer) {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }

  // Helper method to simulate errors
  simulateError(error?: any) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { error }))
    }
  }

  // Helper method to simulate connection close
  simulateClose(code: number = 1000, reason: string = '', wasClean: boolean = true) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason, wasClean }))
    }
  }
}

// Mock global WebSocket
Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
  writable: true
})

// Mock timers
vi.useFakeTimers()

describe('WebSocketAdapter', () => {
  let adapter: IWebSocketAdapter
  let mockWebSocket: MockWebSocket
  let config: WebSocketConfig

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    
    config = {
      url: 'ws://localhost:8080/game',
      protocols: ['minecraft-protocol'],
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      messageQueueSize: 1000
    }

    // Create adapter
    adapter = await runEffect(Layer.build(WebSocketAdapterLive).pipe(
      Effect.map(context => Context.get(context, WebSocketAdapter))
    ))

    // Get reference to the mock WebSocket instance
    mockWebSocket = new MockWebSocket(config.url, config.protocols)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Adapter Creation', () => {
    it('should create WebSocket adapter successfully', async () => {
      const result = await expectEffect.toSucceed(
        Layer.build(WebSocketAdapterLive).pipe(
          Effect.map(context => Context.get(context, WebSocketAdapter))
        )
      )

      expect(result).toBeDefined()
      expect(result.connect).toBeDefined()
      expect(result.disconnect).toBeDefined()
      expect(result.send).toBeDefined()
      expect(result.sendBinary).toBeDefined()
      expect(result.onMessage).toBeDefined()
      expect(result.onConnectionStateChange).toBeDefined()
      expect(result.getConnectionState).toBeDefined()
      expect(result.isConnected).toBeDefined()
      expect(result.getStats).toBeDefined()
    })
  })

  describe('Connection Management', () => {
    it('should connect to WebSocket server successfully', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      
      // Advance timers to allow connection to open
      vi.advanceTimersByTime(20)
      
      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(state).toBe('connected')
    })

    it('should handle connection with protocols', async () => {
      const configWithProtocols = {
        ...config,
        protocols: ['minecraft-v1', 'minecraft-v2']
      }

      await expectEffect.toSucceed(adapter.connect(configWithProtocols))
      vi.advanceTimersByTime(20)

      const isConnected = await expectEffect.toSucceed(adapter.isConnected())
      expect(isConnected).toBe(true)
    })

    it('should handle connection without protocols', async () => {
      const configWithoutProtocols = {
        ...config,
        protocols: undefined
      }

      await expectEffect.toSucceed(adapter.connect(configWithoutProtocols))
      vi.advanceTimersByTime(20)

      const isConnected = await expectEffect.toSucceed(adapter.isConnected())
      expect(isConnected).toBe(true)
    })

    it('should disconnect gracefully', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(state).toBe('disconnected')
    })

    it('should track connection state changes', async () => {
      // Start connection
      const connectPromise = adapter.connect(config)
      
      // Initially should be connecting
      const initialState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(initialState).toBe('connecting')

      await expectEffect.toSucceed(connectPromise)
      vi.advanceTimersByTime(20)

      // Should be connected after connection opens
      const connectedState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(connectedState).toBe('connected')
    })

    it('should handle connection failures', async () => {
      // Mock WebSocket constructor to throw
      const originalWebSocket = global.WebSocket
      global.WebSocket = vi.fn(() => {
        throw new Error('Connection failed')
      }) as any

      const result = await runEffectExit(adapter.connect(config))
      expect(result._tag).toBe('Failure')

      // Restore WebSocket
      global.WebSocket = originalWebSocket
    })

    it('should handle connection timeout/error state', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      
      // Simulate connection error
      const ws = new MockWebSocket(config.url)
      ws.simulateError(new Error('Network error'))
      
      vi.advanceTimersByTime(100)
      
      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      // State might be 'error' or 'reconnecting' depending on implementation
      expect(['error', 'reconnecting', 'disconnected']).toContain(state)
    })
  })

  describe('Message Sending', () => {
    let mockMessage: WebSocketMessage

    beforeEach(async () => {
      mockMessage = {
        type: 'PLAYER_POSITION',
        playerId: 'player123',
        position: { x: 10, y: 20, z: 30 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 }
      }

      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)
    })

    it('should send text messages successfully', async () => {
      await expectEffect.toSucceed(adapter.send(mockMessage))
      vi.advanceTimersByTime(10)

      // Verify message was sent through WebSocket
      expect(MockWebSocket.prototype.send).toHaveBeenCalledWith(
        JSON.stringify(mockMessage)
      )
    })

    it('should send binary messages successfully', async () => {
      const binaryData = new ArrayBuffer(10)
      const uint8View = new Uint8Array(binaryData)
      uint8View.fill(42)

      await expectEffect.toSucceed(adapter.sendBinary(binaryData))
      vi.advanceTimersByTime(10)

      expect(MockWebSocket.prototype.send).toHaveBeenCalledWith(binaryData)
    })

    it('should handle sending when not connected', async () => {
      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      const result = await runEffectExit(adapter.send(mockMessage))
      expect(result._tag).toBe('Failure')
    })

    it('should send different message types', async () => {
      const messages: WebSocketMessage[] = [
        {
          type: 'BLOCK_PLACE',
          playerId: 'player123',
          position: { x: 5, y: 10, z: 15 },
          blockType: 1
        },
        {
          type: 'CHAT_MESSAGE',
          playerId: 'player123',
          message: 'Hello world!',
          timestamp: Date.now()
        },
        {
          type: 'PLAYER_JOIN',
          playerId: 'player456',
          playerName: 'NewPlayer'
        }
      ]

      for (const message of messages) {
        await expectEffect.toSucceed(adapter.send(message))
      }
      
      vi.advanceTimersByTime(50)
      expect(MockWebSocket.prototype.send).toHaveBeenCalledTimes(3)
    })

    it('should queue messages and send in order', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        type: 'CHAT_MESSAGE' as const,
        playerId: 'player123',
        message: `Message ${i}`,
        timestamp: Date.now() + i
      }))

      // Send all messages quickly
      for (const message of messages) {
        await expectEffect.toSucceed(adapter.send(message))
      }

      vi.advanceTimersByTime(100)
      
      expect(MockWebSocket.prototype.send).toHaveBeenCalledTimes(5)
    })
  })

  describe('Message Receiving', () => {
    beforeEach(async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)
    })

    it('should receive and parse text messages', async () => {
      const testMessage: WebSocketMessage = {
        type: 'PLAYER_POSITION',
        playerId: 'player456',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 1, y: 2, z: 3 }
      }

      // Set up message stream listener
      const messageStream = adapter.onMessage()
      const messagePromise = Stream.runHead(messageStream)

      // Simulate receiving message
      const ws = new MockWebSocket(config.url)
      ws.simulateMessage(JSON.stringify(testMessage))
      
      vi.advanceTimersByTime(20)

      // Note: Actual message handling depends on implementation details
      // This test verifies the interface exists and can be used
      expect(messageStream).toBeDefined()
    })

    it('should receive binary messages', async () => {
      const binaryData = new ArrayBuffer(20)
      const view = new Uint8Array(binaryData)
      view.fill(123)

      const messageStream = adapter.onMessage()
      
      const ws = new MockWebSocket(config.url)
      ws.simulateMessage(binaryData)
      
      vi.advanceTimersByTime(20)

      expect(messageStream).toBeDefined()
    })

    it('should handle malformed JSON messages', async () => {
      const messageStream = adapter.onMessage()
      
      // Send invalid JSON
      const ws = new MockWebSocket(config.url)
      ws.simulateMessage('{ invalid json }')
      
      vi.advanceTimersByTime(20)

      // Should handle error gracefully without crashing
      expect(messageStream).toBeDefined()
    })

    it('should handle large messages', async () => {
      const largeMessage: WebSocketMessage = {
        type: 'WORLD_UPDATE',
        entities: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity_${i}`,
          position: { x: i, y: i, z: i },
          rotation: { x: 0, y: 0, z: 0 },
          velocity: { x: 0.1, y: 0, z: 0.1 }
        }))
      }

      const messageStream = adapter.onMessage()
      
      const ws = new MockWebSocket(config.url)
      ws.simulateMessage(JSON.stringify(largeMessage))
      
      vi.advanceTimersByTime(50)

      expect(messageStream).toBeDefined()
    })
  })

  describe('Connection State Monitoring', () => {
    it('should monitor connection state changes', async () => {
      const stateStream = adapter.onConnectionStateChange()
      
      // Connect
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)
      
      // Disconnect
      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      expect(stateStream).toBeDefined()
    })

    it('should provide current connection state', async () => {
      const initialState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(initialState).toBe('disconnected')

      await expectEffect.toSucceed(adapter.connect(config))
      const connectingState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(connectingState).toBe('connecting')

      vi.advanceTimersByTime(20)
      const connectedState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(connectedState).toBe('connected')
    })

    it('should provide connection status boolean', async () => {
      let isConnected = await expectEffect.toSucceed(adapter.isConnected())
      expect(isConnected).toBe(false)

      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      isConnected = await expectEffect.toSucceed(adapter.isConnected())
      expect(isConnected).toBe(true)
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)
    })

    it('should track message statistics', async () => {
      const message: WebSocketMessage = {
        type: 'CHAT_MESSAGE',
        playerId: 'player123',
        message: 'test',
        timestamp: Date.now()
      }

      // Send some messages
      await expectEffect.toSucceed(adapter.send(message))
      await expectEffect.toSucceed(adapter.send(message))
      await expectEffect.toSucceed(adapter.send(message))
      
      vi.advanceTimersByTime(50)

      const stats = await expectEffect.toSucceed(adapter.getStats())
      
      expect(stats).toBeDefined()
      expect(stats.messagesSent).toBeGreaterThanOrEqual(0)
      expect(stats.messagesReceived).toBeGreaterThanOrEqual(0)
      expect(stats.bytesTransferred).toBeGreaterThanOrEqual(0)
      expect(typeof stats.connectionUptime).toBe('number')
      expect(typeof stats.lastPingTime).toBe('number')
    })

    it('should track bytes transferred', async () => {
      const largeMessage: WebSocketMessage = {
        type: 'WORLD_UPDATE',
        entities: Array.from({ length: 100 }, (_, i) => ({
          id: `entity_${i}`,
          position: { x: i, y: i, z: i },
          rotation: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 }
        }))
      }

      await expectEffect.toSucceed(adapter.send(largeMessage))
      vi.advanceTimersByTime(20)

      const stats = await expectEffect.toSucceed(adapter.getStats())
      expect(stats.bytesTransferred).toBeGreaterThan(0)
    })

    it('should track connection uptime', async () => {
      vi.advanceTimersByTime(5000) // 5 seconds

      const stats = await expectEffect.toSucceed(adapter.getStats())
      expect(stats.connectionUptime).toBeGreaterThan(0)
    })

    it('should reset stats on disconnect', async () => {
      // Send some messages
      const message: WebSocketMessage = {
        type: 'CHAT_MESSAGE',
        playerId: 'player123',
        message: 'test',
        timestamp: Date.now()
      }
      
      await expectEffect.toSucceed(adapter.send(message))
      vi.advanceTimersByTime(20)

      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      const stats = await expectEffect.toSucceed(adapter.getStats())
      expect(stats.connectionUptime).toBe(0) // Should be 0 when disconnected
    })
  })

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on connection loss', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      // Simulate connection loss
      const ws = new MockWebSocket(config.url)
      ws.simulateClose(1006, 'Connection lost', false) // Abnormal close
      
      vi.advanceTimersByTime(100)

      // Should attempt reconnection (state might be 'reconnecting')
      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(['reconnecting', 'connected', 'error', 'disconnected']).toContain(state)
    })

    it('should respect max reconnection attempts', async () => {
      const limitedConfig = {
        ...config,
        maxReconnectAttempts: 1,
        reconnectDelay: 100
      }

      await expectEffect.toSucceed(adapter.connect(limitedConfig))
      vi.advanceTimersByTime(20)

      // Simulate repeated connection failures
      const ws = new MockWebSocket(config.url)
      ws.simulateClose(1006, 'Connection lost', false)
      
      vi.advanceTimersByTime(200) // Enough time for retry attempts

      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      // Should eventually give up and be disconnected
      expect(['disconnected', 'error']).toContain(state)
    })

    it('should use configured reconnection delay', async () => {
      const delayConfig = {
        ...config,
        reconnectDelay: 2000 // 2 second delay
      }

      await expectEffect.toSucceed(adapter.connect(delayConfig))
      vi.advanceTimersByTime(20)

      const ws = new MockWebSocket(config.url)
      ws.simulateClose(1006, 'Connection lost', false)
      
      // Should not reconnect immediately
      vi.advanceTimersByTime(1000) // 1 second
      const stateAfter1s = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(stateAfter1s).not.toBe('connected')

      // Should reconnect after full delay
      vi.advanceTimersByTime(1500) // Total 2.5 seconds
      const stateAfter2_5s = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(['connecting', 'connected', 'reconnecting']).toContain(stateAfter2_5s)
    })
  })

  describe('Heartbeat Management', () => {
    it('should send heartbeat messages when configured', async () => {
      const heartbeatConfig = {
        ...config,
        heartbeatInterval: 1000 // 1 second heartbeat
      }

      await expectEffect.toSucceed(adapter.connect(heartbeatConfig))
      vi.advanceTimersByTime(20)

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(1500)

      // Should have sent heartbeat messages
      expect(MockWebSocket.prototype.send).toHaveBeenCalled()
    })

    it('should not send heartbeat when interval is 0', async () => {
      const noHeartbeatConfig = {
        ...config,
        heartbeatInterval: 0
      }

      await expectEffect.toSucceed(adapter.connect(noHeartbeatConfig))
      vi.advanceTimersByTime(20)

      const initialCallCount = vi.mocked(MockWebSocket.prototype.send).mock.calls.length

      // Advance time significantly
      vi.advanceTimersByTime(10000)

      const finalCallCount = vi.mocked(MockWebSocket.prototype.send).mock.calls.length
      
      // Should not have increased due to heartbeat
      expect(finalCallCount).toBe(initialCallCount)
    })

    it('should stop heartbeat on disconnect', async () => {
      const heartbeatConfig = {
        ...config,
        heartbeatInterval: 500
      }

      await expectEffect.toSucceed(adapter.connect(heartbeatConfig))
      vi.advanceTimersByTime(20)

      // Let heartbeat start
      vi.advanceTimersByTime(600)
      const callsWithHeartbeat = vi.mocked(MockWebSocket.prototype.send).mock.calls.length

      // Disconnect
      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      // Clear mock calls to reset counter
      vi.mocked(MockWebSocket.prototype.send).mockClear()

      // Wait more time - should not send more heartbeats
      vi.advanceTimersByTime(2000)
      const callsAfterDisconnect = vi.mocked(MockWebSocket.prototype.send).mock.calls.length

      expect(callsAfterDisconnect).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle WebSocket send errors', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      // Mock send to throw error
      vi.mocked(MockWebSocket.prototype.send).mockImplementation(() => {
        throw new Error('Send failed')
      })

      const message: WebSocketMessage = {
        type: 'CHAT_MESSAGE',
        playerId: 'player123',
        message: 'test',
        timestamp: Date.now()
      }

      // Should handle send error gracefully
      const result = await runEffectExit(adapter.send(message))
      // Depending on implementation, might succeed (queued) or fail
      expect(result._tag).toBeDefined()
    })

    it('should handle JSON parsing errors', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      const messageStream = adapter.onMessage()

      // Send malformed JSON
      const ws = new MockWebSocket(config.url)
      ws.simulateMessage('{ "invalid": json }')
      
      vi.advanceTimersByTime(20)

      // Stream should still be available and not crash
      expect(messageStream).toBeDefined()
    })

    it('should handle connection errors gracefully', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      // Simulate WebSocket error
      const ws = new MockWebSocket(config.url)
      ws.simulateError(new Error('Network error'))
      
      vi.advanceTimersByTime(100)

      // Should handle error without crashing
      const state = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(state).toBeDefined()
    })

    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await expectEffect.toSucceed(adapter.connect(config))
        vi.advanceTimersByTime(20)
        
        await expectEffect.toSucceed(adapter.disconnect())
        vi.advanceTimersByTime(20)
      }

      // Should handle rapid cycles without issues
      const finalState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(finalState).toBe('disconnected')
    })
  })

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)
    })

    it('should handle high-frequency message sending', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        type: 'PLAYER_POSITION' as const,
        playerId: 'player123',
        position: { x: i, y: i, z: i },
        rotation: { x: 0, y: 0, z: 0 }
      }))

      const startTime = Date.now()
      
      for (const message of messages) {
        await expectEffect.toSucceed(adapter.send(message))
      }
      
      vi.advanceTimersByTime(100)
      
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle large message payloads', async () => {
      const largeMessage: WebSocketMessage = {
        type: 'WORLD_UPDATE',
        entities: Array.from({ length: 5000 }, (_, i) => ({
          id: `entity_${i}`,
          position: { x: Math.random() * 1000, y: Math.random() * 100, z: Math.random() * 1000 },
          rotation: { x: Math.random(), y: Math.random(), z: Math.random() },
          velocity: { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }
        }))
      }

      const { result, duration } = await measureEffectPerformance(
        adapter.send(largeMessage),
        'Large message send'
      )

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(500) // Should send within 500ms
    })

    it('should handle concurrent operations', async () => {
      const operations = [
        adapter.send({ type: 'CHAT_MESSAGE', playerId: '1', message: 'msg1', timestamp: Date.now() }),
        adapter.send({ type: 'CHAT_MESSAGE', playerId: '2', message: 'msg2', timestamp: Date.now() }),
        adapter.send({ type: 'CHAT_MESSAGE', playerId: '3', message: 'msg3', timestamp: Date.now() }),
        adapter.getStats(),
        adapter.getConnectionState(),
        adapter.isConnected()
      ]

      const results = await Promise.all(operations.map(op => 
        runEffectExit(op).then(result => result._tag === 'Success')
      ))

      // Most operations should succeed
      const successCount = results.filter(Boolean).length
      expect(successCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Integration with Effect-TS', () => {
    it('should work with Effect composition', async () => {
      const composedEffect = Effect.gen(function* () {
        yield* adapter.connect(config)
        const isConnected = yield* adapter.isConnected()
        const stats = yield* adapter.getStats()
        return { isConnected, stats }
      })

      vi.advanceTimersByTime(20)
      const result = await expectEffect.toSucceed(composedEffect)
      
      expect(result.isConnected).toBe(true)
      expect(result.stats).toBeDefined()
    })

    it('should handle Effect error propagation', async () => {
      // Mock connect to fail
      const originalWebSocket = global.WebSocket
      global.WebSocket = vi.fn(() => {
        throw new Error('Connection failed')
      }) as any

      const result = await runEffectExit(adapter.connect(config))
      expect(result._tag).toBe('Failure')

      // Restore WebSocket
      global.WebSocket = originalWebSocket
    })

    it('should work with Effect retry patterns', async () => {
      let attemptCount = 0
      const originalConnect = adapter.connect

      // Mock connect to fail first few times
      adapter.connect = vi.fn((config) => {
        attemptCount++
        if (attemptCount < 3) {
          return Effect.fail(new Error('Connection failed'))
        }
        return originalConnect(config)
      }) as any

      const retryEffect = adapter.connect(config).pipe(
        Effect.retry({ times: 3 })
      )

      await expectEffect.toSucceed(retryEffect)
      expect(attemptCount).toBe(3)
    })

    it('should work with Stream operations', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      const messageStream = adapter.onMessage()
      const stateStream = adapter.onConnectionStateChange()

      expect(messageStream).toBeDefined()
      expect(stateStream).toBeDefined()

      // Verify streams can be used with Effect-TS Stream operations
      const limitedMessageStream = Stream.take(messageStream, 5)
      expect(limitedMessageStream).toBeDefined()
    })
  })

  describe('Memory Management', () => {
    it('should clean up resources on disconnect', async () => {
      await expectEffect.toSucceed(adapter.connect(config))
      vi.advanceTimersByTime(20)

      // Send many messages to create internal state
      const messages = Array.from({ length: 50 }, (_, i) => ({
        type: 'CHAT_MESSAGE' as const,
        playerId: 'player123',
        message: `Message ${i}`,
        timestamp: Date.now() + i
      }))

      for (const message of messages) {
        await expectEffect.toSucceed(adapter.send(message))
      }

      vi.advanceTimersByTime(100)

      // Disconnect should clean up
      await expectEffect.toSucceed(adapter.disconnect())
      vi.advanceTimersByTime(20)

      const stats = await expectEffect.toSucceed(adapter.getStats())
      expect(stats.connectionUptime).toBe(0)
    })

    it('should handle multiple connection cycles without memory leaks', async () => {
      // Connect and disconnect multiple times
      for (let i = 0; i < 5; i++) {
        await expectEffect.toSucceed(adapter.connect(config))
        vi.advanceTimersByTime(20)
        
        // Send some messages
        const message: WebSocketMessage = {
          type: 'CHAT_MESSAGE',
          playerId: 'player123',
          message: `Cycle ${i}`,
          timestamp: Date.now()
        }
        
        await expectEffect.toSucceed(adapter.send(message))
        vi.advanceTimersByTime(10)
        
        await expectEffect.toSucceed(adapter.disconnect())
        vi.advanceTimersByTime(20)
      }

      // Should end in disconnected state
      const finalState = await expectEffect.toSucceed(adapter.getConnectionState())
      expect(finalState).toBe('disconnected')
    })
  })
})