import { Deferred, Effect, Queue, Stream } from 'effect'
import { NetworkError } from '../domain/errors'

export interface WebSocketServerPort {
  readonly start: (port: number) => Effect.Effect<WebSocketServerHandle, NetworkError>
}

export interface WebSocketServerHandle {
  readonly onConnection: Effect.Effect<Stream.Stream<WebSocketConnection, never, never>, never>
  readonly stop: Effect.Effect<void, never>
}

export interface WebSocketConnection {
  readonly id: string
  readonly messages: Stream.Stream<ArrayBuffer, never, never>
  readonly send: (data: ArrayBuffer) => Effect.Effect<void, NetworkError>
  readonly close: Effect.Effect<void, never>
  readonly onClose: Effect.Effect<void, never>
}

export interface FakeSocketPair {
  readonly connection: FakeWebSocketConnection
  readonly clientMessages: Stream.Stream<ArrayBuffer, never, never>
  readonly clientSend: (data: ArrayBuffer) => Effect.Effect<void, NetworkError>
  readonly clientClose: Effect.Effect<void, never>
  readonly clientOnClose: Effect.Effect<void, never>
  readonly takeClientMessage: Effect.Effect<ArrayBuffer, never>
}

let nextConnectionId = 1

export class FakeWebSocketConnection implements WebSocketConnection {
  readonly messages: Stream.Stream<ArrayBuffer, never, never>
  readonly clientMessages: Stream.Stream<ArrayBuffer, never, never>
  readonly takeClientMessage: Effect.Effect<ArrayBuffer, never>
  readonly close: Effect.Effect<void, never>
  readonly onClose: Effect.Effect<void, never>

  constructor(
    readonly id: string,
    private readonly serverInbound: Queue.Queue<ArrayBuffer>,
    private readonly clientInbound: Queue.Queue<ArrayBuffer>,
    closed: Deferred.Deferred<void>,
  ) {
    this.messages = Stream.fromQueue(serverInbound)
    this.clientMessages = Stream.fromQueue(clientInbound)
    this.takeClientMessage = Queue.take(clientInbound)
    this.close = Deferred.succeed(closed, undefined).pipe(Effect.asVoid)
    this.onClose = Deferred.await(closed)
  }

  send = (data: ArrayBuffer): Effect.Effect<void, NetworkError> =>
    Queue.offer(this.clientInbound, data).pipe(
      Effect.asVoid,
      Effect.mapError((cause) => new NetworkError({ operation: 'send', reason: 'server send queue rejected data', cause })),
    )

  receiveFromClient = (data: ArrayBuffer): Effect.Effect<void, NetworkError> =>
    Queue.offer(this.serverInbound, data).pipe(
      Effect.asVoid,
      Effect.mapError((cause) => new NetworkError({ operation: 'receive', reason: 'server receive queue rejected data', cause })),
    )

}

export class FakeWebSocketServer implements WebSocketServerPort {
  private readonly connections = new Map<string, FakeWebSocketConnection>()
  private connectionQueue: Queue.Queue<WebSocketConnection> | undefined
  private running = false

  start = (_port: number): Effect.Effect<WebSocketServerHandle, NetworkError> => {
    // eslint-disable-next-line typescript-eslint/no-this-alias
    const self = this
    return Effect.gen(function* () {
      if (self.running) {
        yield* Effect.fail(new NetworkError({ operation: 'start', reason: 'fake server already started' }))
      }
      const connectionQueue = yield* Queue.unbounded<WebSocketConnection>()
      self.connectionQueue = connectionQueue
      self.running = true
      return {
        onConnection: Effect.succeed(Stream.fromQueue(connectionQueue)),
        stop: Effect.gen(function* () {
          self.running = false
          for (const connection of self.connections.values()) {
            yield* connection.close
          }
          self.connections.clear()
          self.connectionQueue = undefined
        }),
      }
    })
  }

  connectClient = (): Effect.Effect<FakeSocketPair, NetworkError> => {
    // eslint-disable-next-line typescript-eslint/no-this-alias
    const self = this
    return Effect.gen(function* () {
      const connectionQueue = self.connectionQueue
      if (!self.running || !connectionQueue) {
        yield* Effect.fail(new NetworkError({ operation: 'connect', reason: 'fake server is not running' }))
      }

      const serverInbound = yield* Queue.unbounded<ArrayBuffer>()
      const clientInbound = yield* Queue.unbounded<ArrayBuffer>()
      const closed = yield* Deferred.make<void>()
      const id = `fake-${nextConnectionId++}`
      const connection = new FakeWebSocketConnection(id, serverInbound, clientInbound, closed)
      self.connections.set(id, connection)

      yield* Queue.offer(connectionQueue!, connection).pipe(
        Effect.mapError((cause) => new NetworkError({ operation: 'connect', reason: 'failed to publish fake connection', cause })),
      )

      return {
        connection,
        clientMessages: connection.clientMessages,
        clientSend: connection.receiveFromClient,
        clientClose: connection.close,
        clientOnClose: connection.onClose,
        takeClientMessage: connection.takeClientMessage,
      }
    })
  }

  getConnection(id: string): FakeWebSocketConnection | undefined {
    return this.connections.get(id)
  }

  getConnections(): ReadonlyMap<string, FakeWebSocketConnection> {
    return this.connections
  }
}
