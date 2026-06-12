import { Effect, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import type { FakeWebSocketServer } from './websocket-server'

export interface WebSocketClientPort {
  readonly connect: (url: string) => Effect.Effect<WebSocketClientHandle, NetworkError>
}

export interface WebSocketClientHandle {
  readonly messages: Stream.Stream<ArrayBuffer, never, never>
  readonly send: (data: ArrayBuffer) => Effect.Effect<void, NetworkError>
  readonly onClose: Effect.Effect<void, never>
  readonly close: Effect.Effect<void, never>
}

export class FakeWebSocketClient implements WebSocketClientPort {
  constructor(private readonly server: FakeWebSocketServer) {}

  connect = (_url: string): Effect.Effect<WebSocketClientHandle, NetworkError> => {
    const { server } = this
    return Effect.gen(function* () {
      const pair = yield* server.connectClient()
      return {
        messages: pair.clientMessages,
        send: pair.clientSend,
        onClose: pair.clientOnClose,
        close: pair.clientClose,
      }
    })
  }
}
