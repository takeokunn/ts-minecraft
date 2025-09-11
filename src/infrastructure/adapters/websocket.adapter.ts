/**
 * WebSocket Adapter - Implements network communication using WebSocket protocol
 *
 * This adapter provides concrete implementation for real-time network
 * communication using WebSocket, enabling multiplayer functionality
 * and remote state synchronization.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Stream from 'effect/Stream'
import * as Match from 'effect/Match'

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | {
      readonly type: 'PLAYER_POSITION'
      readonly playerId: string
      readonly position: { readonly x: number; readonly y: number; readonly z: number }
      readonly rotation: { readonly x: number; readonly y: number; readonly z: number }
    }
  | {
      readonly type: 'BLOCK_PLACE'
      readonly playerId: string
      readonly position: { readonly x: number; readonly y: number; readonly z: number }
      readonly blockType: number
    }
  | {
      readonly type: 'BLOCK_DESTROY'
      readonly playerId: string
      readonly position: { readonly x: number; readonly y: number; readonly z: number }
    }
  | {
      readonly type: 'CHUNK_DATA'
      readonly chunkX: number
      readonly chunkZ: number
      readonly data: ArrayBuffer
    }
  | {
      readonly type: 'PLAYER_JOIN'
      readonly playerId: string
      readonly playerName: string
    }
  | {
      readonly type: 'PLAYER_LEAVE'
      readonly playerId: string
    }
  | {
      readonly type: 'CHAT_MESSAGE'
      readonly playerId: string
      readonly message: string
      readonly timestamp: number
    }
  | {
      readonly type: 'WORLD_UPDATE'
      readonly entities: ReadonlyArray<{
        readonly id: string
        readonly position: { readonly x: number; readonly y: number; readonly z: number }
        readonly rotation: { readonly x: number; readonly y: number; readonly z: number }
        readonly velocity: { readonly x: number; readonly y: number; readonly z: number }
      }>
    }

/**
 * WebSocket connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  readonly url: string
  readonly protocols?: ReadonlyArray<string>
  readonly maxReconnectAttempts: number
  readonly reconnectDelay: number
  readonly heartbeatInterval: number
  readonly messageQueueSize: number
}

/**
 * WebSocket adapter interface
 */
export interface IWebSocketAdapter {
  readonly connect: (config: WebSocketConfig) => Effect.Effect<void, Error, never>
  readonly disconnect: () => Effect.Effect<void, never, never>
  readonly send: (message: WebSocketMessage) => Effect.Effect<void, Error, never>
  readonly sendBinary: (data: ArrayBuffer) => Effect.Effect<void, Error, never>
  readonly onMessage: () => Stream.Stream<WebSocketMessage, Error, never>
  readonly onConnectionStateChange: () => Stream.Stream<ConnectionState, never, never>
  readonly getConnectionState: () => Effect.Effect<ConnectionState, never, never>
  readonly isConnected: () => Effect.Effect<boolean, never, never>
  readonly getStats: () => Effect.Effect<
    {
      readonly messagesSent: number
      readonly messagesReceived: number
      readonly bytesTransferred: number
      readonly connectionUptime: number
      readonly lastPingTime: number
    },
    never,
    never
  >
}

export class WebSocketAdapter extends Context.GenericTag('WebSocketAdapter')<WebSocketAdapter, IWebSocketAdapter>() {}

/**
 * WebSocket adapter state
 */
interface WebSocketState {
  readonly socket: WebSocket | null
  readonly config: WebSocketConfig | null
  readonly connectionState: ConnectionState
  readonly reconnectAttempts: number
  readonly lastConnectTime: number
  readonly messageQueue: Queue.Queue<WebSocketMessage>
  readonly outboundQueue: Queue.Queue<WebSocketMessage | ArrayBuffer>
  readonly connectionStateQueue: Queue.Queue<ConnectionState>
  readonly heartbeatIntervalId: number | null
  readonly stats: {
    readonly messagesSent: number
    readonly messagesReceived: number
    readonly bytesTransferred: number
    readonly connectionUptime: number
    readonly lastPingTime: number
  }
}

/**
 * WebSocket Adapter Layer
 */
export const WebSocketAdapterLive = Layer.scoped(
  WebSocketAdapter,
  Effect.gen(function* (_) {
    const initialState: WebSocketState = {
      socket: null,
      config: null,
      connectionState: 'disconnected',
      reconnectAttempts: 0,
      lastConnectTime: 0,
      messageQueue: yield* _(Queue.unbounded<WebSocketMessage>()),
      outboundQueue: yield* _(Queue.unbounded<WebSocketMessage | ArrayBuffer>()),
      connectionStateQueue: yield* _(Queue.unbounded<ConnectionState>()),
      heartbeatIntervalId: null,
      stats: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0,
        connectionUptime: 0,
        lastPingTime: 0,
      },
    }

    const stateRef = yield* _(Ref.make(initialState))

    const updateConnectionState = (newState: ConnectionState) =>
      Effect.gen(function* (_) {
        yield* _(Ref.update(stateRef, (s) => ({ ...s, connectionState: newState })))
        yield* _(Queue.offer(yield* _(Ref.get(stateRef).pipe(Effect.map((s) => s.connectionStateQueue))), newState))
      })

    const parseMessage = (data: string | ArrayBuffer): Effect.Effect<WebSocketMessage, Error, never> => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data) as WebSocketMessage
          return Effect.succeed(parsed)
        } catch (error) {
          return Effect.fail(new Error(`Failed to parse WebSocket message: ${error}`))
        }
      } else {
        // Handle binary data (e.g., chunk data)
        return Effect.succeed({
          type: 'CHUNK_DATA',
          chunkX: 0, // Would be extracted from binary data
          chunkZ: 0,
          data,
        } as WebSocketMessage)
      }
    }

    const setupSocketEventHandlers = (socket: WebSocket) =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))

        socket.onopen = () => {
          Effect.runSync(updateConnectionState('connected'))
          Effect.runSync(
            Ref.update(stateRef, (s) => ({
              ...s,
              reconnectAttempts: 0,
              lastConnectTime: Date.now(),
            })),
          )
        }

        socket.onclose = (event) => {
          if (event.wasClean) {
            Effect.runSync(updateConnectionState('disconnected'))
          } else {
            Effect.runSync(updateConnectionState('error'))
            // Attempt reconnection
            Effect.runSync(attemptReconnect())
          }
        }

        socket.onerror = (error) => {
          Effect.runSync(updateConnectionState('error'))
          Effect.runSync(Effect.logError('WebSocket error', error))
        }

        socket.onmessage = (event) => {
          Effect.runSync(
            Effect.gen(function* (_) {
              const message = yield* _(parseMessage(event.data))
              yield* _(Queue.offer(state.messageQueue, message))
              yield* _(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  stats: {
                    ...s.stats,
                    messagesReceived: s.stats.messagesReceived + 1,
                    bytesTransferred: s.stats.bytesTransferred + (typeof event.data === 'string' ? event.data.length : event.data.byteLength),
                  },
                })),
              )
            }).pipe(Effect.catchAll((error) => Effect.logError('Failed to handle WebSocket message', error))),
          )
        }
      })

    const attemptReconnect = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))

        if (!state.config || state.reconnectAttempts >= state.config.maxReconnectAttempts) {
          yield* _(updateConnectionState('disconnected'))
          return
        }

        yield* _(updateConnectionState('reconnecting'))
        yield* _(Ref.update(stateRef, (s) => ({ ...s, reconnectAttempts: s.reconnectAttempts + 1 })))

        yield* _(Effect.sleep(`${state.config.reconnectDelay}ms`))

        if (state.config) {
          yield* _(
            connect(state.config).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* (_) {
                  yield* _(Effect.logError('Reconnection attempt failed', error))
                  yield* _(attemptReconnect())
                }),
              ),
            ),
          )
        }
      })

    const startHeartbeat = (interval: number) =>
      Effect.gen(function* (_) {
        const intervalId = setInterval(() => {
          Effect.runSync(
            send({
              type: 'CHAT_MESSAGE', // Using as heartbeat placeholder
              playerId: 'system',
              message: 'ping',
              timestamp: Date.now(),
            }).pipe(Effect.catchAll((error) => Effect.logError('Heartbeat failed', error))),
          )
        }, interval)

        yield* _(Ref.update(stateRef, (s) => ({ ...s, heartbeatIntervalId: intervalId })))
      })

    const stopHeartbeat = () =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))
        if (state.heartbeatIntervalId) {
          clearInterval(state.heartbeatIntervalId)
          yield* _(Ref.update(stateRef, (s) => ({ ...s, heartbeatIntervalId: null })))
        }
      })

    const connect = (config: WebSocketConfig): Effect.Effect<void, Error, never> =>
      Effect.gen(function* (_) {
        yield* _(updateConnectionState('connecting'))

        const socket = new WebSocket(config.url, config.protocols)

        yield* _(Ref.update(stateRef, (s) => ({ ...s, socket, config })))
        yield* _(setupSocketEventHandlers(socket))

        // Wait for connection to be established
        yield* _(Effect.repeatUntil(Ref.get(stateRef).pipe(Effect.map((s) => s.connectionState === 'connected' || s.connectionState === 'error')), (connected) => connected))

        const finalState = yield* _(Ref.get(stateRef))
        if (finalState.connectionState === 'error') {
          yield* _(Effect.fail(new Error('Failed to establish WebSocket connection')))
        }

        // Start heartbeat
        if (config.heartbeatInterval > 0) {
          yield* _(startHeartbeat(config.heartbeatInterval))
        }

        // Start processing outbound message queue
        yield* _(
          Queue.take(finalState.outboundQueue).pipe(
            Effect.flatMap((message) => {
              if (finalState.socket && finalState.socket.readyState === WebSocket.OPEN) {
                if (message instanceof ArrayBuffer) {
                  finalState.socket.send(message)
                } else {
                  finalState.socket.send(JSON.stringify(message))
                }
                return Ref.update(stateRef, (s) => ({
                  ...s,
                  stats: {
                    ...s.stats,
                    messagesSent: s.stats.messagesSent + 1,
                    bytesTransferred: s.stats.bytesTransferred + (message instanceof ArrayBuffer ? message.byteLength : JSON.stringify(message).length),
                  },
                }))
              }
              return Effect.void
            }),
            Effect.forever,
            Effect.forkScoped,
          ),
        )
      })

    const disconnect = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        yield* _(stopHeartbeat())

        const state = yield* _(Ref.get(stateRef))
        if (state.socket) {
          state.socket.close(1000, 'Normal closure')
        }

        yield* _(updateConnectionState('disconnected'))
        yield* _(Ref.update(stateRef, (s) => ({ ...s, socket: null })))
      })

    const send = (message: WebSocketMessage): Effect.Effect<void, Error, never> =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))

        if (state.connectionState !== 'connected') {
          yield* _(Effect.fail(new Error('WebSocket not connected')))
        }

        yield* _(Queue.offer(state.outboundQueue, message))
      })

    const sendBinary = (data: ArrayBuffer): Effect.Effect<void, Error, never> =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))

        if (state.connectionState !== 'connected') {
          yield* _(Effect.fail(new Error('WebSocket not connected')))
        }

        yield* _(Queue.offer(state.outboundQueue, data))
      })

    const onMessage = (): Stream.Stream<WebSocketMessage, Error, never> =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))
        return Stream.fromQueue(state.messageQueue)
      }).pipe(Stream.unwrap)

    const onConnectionStateChange = (): Stream.Stream<ConnectionState, never, never> =>
      Effect.gen(function* (_) {
        const state = yield* _(Ref.get(stateRef))
        return Stream.fromQueue(state.connectionStateQueue)
      }).pipe(Stream.unwrap)

    const getConnectionState = (): Effect.Effect<ConnectionState, never, never> => Ref.get(stateRef).pipe(Effect.map((state) => state.connectionState))

    const isConnected = (): Effect.Effect<boolean, never, never> => Ref.get(stateRef).pipe(Effect.map((state) => state.connectionState === 'connected'))

    const getStats = () =>
      Ref.get(stateRef).pipe(
        Effect.map((state) => ({
          ...state.stats,
          connectionUptime: state.connectionState === 'connected' ? Date.now() - state.lastConnectTime : 0,
        })),
      )

    return WebSocketAdapter.of({
      connect,
      disconnect,
      send,
      sendBinary,
      onMessage,
      onConnectionStateChange,
      getConnectionState,
      isConnected,
      getStats,
    })
  }),
)
