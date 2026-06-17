import { Effect, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import type { WebSocketClientHandle, WebSocketClientPort } from '../domain/websocket-ports'
import type { FakeWebSocketServer } from './websocket-server'

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
