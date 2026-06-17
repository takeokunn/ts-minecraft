// @effect-boundary — raw WebSocket interop, Effect-safe wrapper over browser API
import { Deferred, Effect, Queue, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import type { WebSocketClientHandle, WebSocketClientPort } from '../domain/websocket-ports'

const toArrayBuffer = (data: MessageEvent['data']): Effect.Effect<ArrayBuffer, NetworkError> => {
  if (data instanceof ArrayBuffer) {
    return Effect.succeed(data)
  }
  if (data instanceof Blob) {
    return Effect.tryPromise({
      try: () => data.arrayBuffer(),
      catch: (cause) => new NetworkError({ operation: 'receive', reason: 'failed to read websocket blob message', cause }),
    })
  }
  if (typeof data === 'string') {
    const encoded = new TextEncoder().encode(data)
    const buffer = new ArrayBuffer(encoded.byteLength)
    new Uint8Array(buffer).set(encoded)
    return Effect.succeed(buffer)
  }
  return Effect.fail(new NetworkError({ operation: 'receive', reason: 'unsupported websocket message payload' }))
}

const runDetached = <A, E>(effect: Effect.Effect<A, E>): void => {
  Effect.runFork(effect.pipe(Effect.catchAll(() => Effect.void)))
}

export class BrowserWebSocketClient implements WebSocketClientPort {
  connect = (url: string): Effect.Effect<WebSocketClientHandle, NetworkError> =>
    Effect.gen(function* () {
      const messageQueue = yield* Queue.unbounded<ArrayBuffer>()
      const closed = yield* Deferred.make<void>()

      return yield* Effect.async<WebSocketClientHandle, NetworkError>((resume) => {
        let opened = false
        let settled = false
        let socket: WebSocket

        try {
          socket = new WebSocket(url) as WebSocket
        } catch (cause) {
          settled = true
          resume(Effect.fail(new NetworkError({ operation: 'connect', reason: `failed to create websocket for ${url}`, cause })))
          return
        }

        socket.binaryType = 'arraybuffer'

        const signalClosed = (): void => {
          runDetached(Effect.gen(function* () {
            yield* Deferred.succeed(closed, undefined)
            yield* Queue.shutdown(messageQueue)
          }))
        }

        const handle: WebSocketClientHandle = {
          messages: Stream.fromQueue(messageQueue),
          send: (data) =>
            Effect.try({
              try: () => {
                if (socket.readyState !== WebSocket.OPEN) {
                  throw new NetworkError({ operation: 'send', reason: 'websocket is not open' })
                }
                socket.send(data)
              },
              catch: (cause) =>
                cause instanceof NetworkError
                  ? cause
                  : new NetworkError({ operation: 'send', reason: 'failed to send websocket message', cause }),
            }),
          onClose: Deferred.await(closed),
          close: Effect.sync(() => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
              socket.close()
              return
            }
            signalClosed()
          }),
        }

        socket.onopen = () => {
          opened = true
          if (!settled) {
            settled = true
            resume(Effect.succeed(handle))
          }
        }

        socket.onmessage = (event) => {
          runDetached(Effect.gen(function* () {
            const message = yield* toArrayBuffer(event.data)
            yield* Queue.offer(messageQueue, message)
          }))
        }

        socket.onerror = (event) => {
          if (!opened && !settled) {
            settled = true
            resume(Effect.fail(new NetworkError({ operation: 'connect', reason: `websocket error while connecting to ${url}`, cause: event })))
            return
          }
          signalClosed()
        }

        socket.onclose = signalClosed
      })
    })
}
