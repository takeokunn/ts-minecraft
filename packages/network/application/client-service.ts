import { Context, Duration, Effect, Fiber, Layer, Option, Ref, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, WorldId, type NetworkMessage, type PlayerName } from '../domain/schemas'
import type { WebSocketClientHandle, WebSocketClientPort } from '../domain/websocket-ports'
import { decodeNetworkMessage, encodeNetworkMessage } from './codec'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed'

export type ClientServiceShape = {
  readonly connect: (serverUrl: string, playerName: PlayerName) => Effect.Effect<void, NetworkError>
  readonly disconnect: () => Effect.Effect<void, never>
  readonly getConnectionState: () => Effect.Effect<ConnectionState, never>
  readonly sendMessage: (message: NetworkMessage) => Effect.Effect<void, NetworkError>
  readonly receiveMessages: () => Effect.Effect<Stream.Stream<NetworkMessage, never, never>, never>
}

export const ClientService = Context.GenericTag<ClientServiceShape>('@minecraft/network/ClientService')

const makeInitialJoin = (playerName: PlayerName): NetworkMessage => ({
  type: MessageType.PlayerJoin,
  playerId: PlayerId.make('pending'),
  playerName,
  worldId: WorldId.make('overworld'),
  position: { x: 0, y: 64, z: 0 },
  timestamp: Date.now(),
})

const sendRawMessage = (
  handle: WebSocketClientHandle,
  message: NetworkMessage,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    const encoded = yield* encodeNetworkMessage(message)
    yield* handle.send(encoded)
  })

const backoffForAttempt = (attempt: number): Duration.Duration =>
  Duration.millis(Math.min(1_000, 10 * 2 ** Math.max(0, attempt - 1)))

export const ClientServiceImpl = (
  port: WebSocketClientPort,
  options: { readonly maxReconnectAttempts?: number } = {},
): Effect.Effect<ClientServiceShape, never> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ConnectionState>('idle')
    const handleRef = yield* Ref.make<Option.Option<WebSocketClientHandle>>(Option.none())
    const messageStreamRef = yield* Ref.make<Option.Option<Stream.Stream<NetworkMessage, never, never>>>(Option.none())
    const reconnectFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none())
    const serverUrlRef = yield* Ref.make<Option.Option<string>>(Option.none())
    const playerNameRef = yield* Ref.make<Option.Option<PlayerName>>(Option.none())
    const maxReconnectAttempts = options.maxReconnectAttempts ?? 5

    const installHandle = (handle: WebSocketClientHandle): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.set(handleRef, Option.some(handle))
        yield* Ref.set(messageStreamRef, Option.some(
          handle.messages.pipe(
            // In a real WebSocket binding, invalid messages should be dropped silently.
            // Effect.orDie is acceptable here because the fake transport uses strictly
            // typed messages — decode failures are structural errors, not runtime events.
            Stream.mapEffect((raw) => decodeNetworkMessage(raw).pipe(Effect.orDie)),
          ),
        ))
      })

    const reconnectLoop: Effect.Effect<void, never> = Effect.gen(function* () {
      for (let attempt = 1; attempt <= maxReconnectAttempts; attempt += 1) {
        yield* Ref.set(stateRef, 'reconnecting')
        yield* Effect.sleep(backoffForAttempt(attempt))
        const serverUrl = yield* Ref.get(serverUrlRef)
        const playerName = yield* Ref.get(playerNameRef)
        let result = false
        const serverUrlVal = Option.getOrNull(serverUrl)
        const playerNameVal = Option.getOrNull(playerName)
        if (serverUrlVal !== null && playerNameVal !== null) {
          result = yield* Effect.gen(function* () {
            const handle = yield* port.connect(serverUrlVal)
            yield* installHandle(handle)
            yield* sendRawMessage(handle, makeInitialJoin(playerNameVal))
            yield* Ref.set(stateRef, 'connected')
            yield* installWatcher(handle)
            return true
          }).pipe(Effect.catchAll(() => Effect.succeed(false)))
        }
        if (result) return
      }
      yield* Ref.set(stateRef, 'failed')
    }).pipe(Effect.annotateLogs({ component: 'network-client', event: 'reconnect' }))

    const watchClose = (handle: WebSocketClientHandle): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* handle.onClose
        yield* reconnectLoop
      })

    const installWatcher = (handle: WebSocketClientHandle): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkDaemon(watchClose(handle))
        yield* Ref.set(reconnectFiberRef, Option.some(fiber))
      })

    const service: ClientServiceShape = {
      connect: (serverUrl, playerName) =>
        Effect.gen(function* () {
          yield* Ref.set(stateRef, 'connecting')
          yield* Ref.set(serverUrlRef, Option.some(serverUrl))
          yield* Ref.set(playerNameRef, Option.some(playerName))
          const handle = yield* port.connect(serverUrl)
          yield* installHandle(handle)
          yield* sendRawMessage(handle, makeInitialJoin(playerName))
          yield* Ref.set(stateRef, 'connected')
          yield* installWatcher(handle)
        }).pipe(
          Effect.tapError(() => Ref.set(stateRef, 'failed')),
          Effect.annotateLogs({ component: 'network-client', event: 'connect' }),
        ),
      disconnect: () =>
        Effect.gen(function* () {
          const reconnectFiber = Option.getOrNull(yield* Ref.get(reconnectFiberRef))
          if (reconnectFiber !== null) {
            yield* Fiber.interrupt(reconnectFiber).pipe(Effect.asVoid)
          }
          yield* Ref.set(reconnectFiberRef, Option.none())
          const handle = Option.getOrNull(yield* Ref.get(handleRef))
          if (handle !== null) {
            yield* handle.close
          }
          yield* Ref.set(handleRef, Option.none())
          yield* Ref.set(stateRef, 'disconnected')
        }),
      getConnectionState: () => Ref.get(stateRef),
      sendMessage: (message) =>
        Effect.gen(function* () {
          const handle = yield* Ref.get(handleRef)
          const h = Option.getOrNull(handle)
          if (h === null) return yield* Effect.fail(new NetworkError({ operation: 'send', reason: 'client is not connected' }))
          yield* sendRawMessage(h, message)
        }),
      receiveMessages: () =>
        Effect.gen(function* () {
          const stream = yield* Ref.get(messageStreamRef)
          return Option.getOrElse(stream, () => Stream.empty)
        }),
    }

    return service
  })

export const ClientServiceDefault = (
  port: WebSocketClientPort,
  options: { readonly maxReconnectAttempts?: number } = {},
): Layer.Layer<ClientServiceShape> =>
  Layer.effect(ClientService, ClientServiceImpl(port, options))
