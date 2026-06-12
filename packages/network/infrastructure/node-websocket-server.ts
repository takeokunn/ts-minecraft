// @effect-boundary — raw WebSocket interop, Effect-safe wrapper over ws library
import { Deferred, Effect, Queue, Stream } from 'effect'
import { Buffer } from 'node:buffer'
import { WebSocket, WebSocketServer as WsServer, type RawData } from 'ws'
import { NetworkError } from '../domain/errors'
import type { WebSocketConnection, WebSocketServerHandle, WebSocketServerPort } from './websocket-server'

let nextNodeConnectionId = 1

const copyBytes = (data: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  return buffer
}

const rawDataToArrayBuffer = (data: RawData): ArrayBuffer => {
  if (data instanceof ArrayBuffer) {
    return data.slice(0)
  }
  if (Array.isArray(data)) {
    return copyBytes(Buffer.concat(data))
  }
  return copyBytes(data)
}

const runDetached = <A, E>(effect: Effect.Effect<A, E>): void => {
  Effect.runFork(effect.pipe(Effect.catchAll(() => Effect.void)))
}

const makeConnection = (socket: WebSocket): Effect.Effect<WebSocketConnection, never> =>
  Effect.gen(function* () {
    const messages = yield* Queue.unbounded<ArrayBuffer>()
    const closed = yield* Deferred.make<void>()
    const id = `node-${nextNodeConnectionId++}`

    const signalClosed = (): void => {
      runDetached(Effect.gen(function* () {
        yield* Deferred.succeed(closed, undefined)
        yield* Queue.shutdown(messages)
      }))
    }

    socket.on('message', (data) => {
      runDetached(Queue.offer(messages, rawDataToArrayBuffer(data)))
    })
    socket.on('close', signalClosed)
    socket.on('error', signalClosed)

    return {
      id,
      messages: Stream.fromQueue(messages),
      send: (data) =>
        Effect.try({
          try: () => {
          if (socket.readyState !== WebSocket.OPEN) {
            throw new NetworkError({ operation: 'send', reason: `connection ${id} is not open` })
          }
          socket.send(data)
          },
          catch: (cause) =>
            cause instanceof NetworkError
              ? cause
              : new NetworkError({ operation: 'send', reason: `failed to send message on connection ${id}`, cause }),
        }),
      close: Effect.sync(() => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close()
          return
        }
        signalClosed()
      }),
      onClose: Deferred.await(closed),
    }
  })

export class NodeWebSocketServer implements WebSocketServerPort {
  start = (port: number): Effect.Effect<WebSocketServerHandle, NetworkError> =>
    Effect.gen(function* () {
      const connectionQueue = yield* Queue.unbounded<WebSocketConnection>()

      return yield* Effect.async<WebSocketServerHandle, NetworkError>((resume) => {
        const server = new WsServer({ port })
        let settled = false

        server.on('connection', (socket) => {
          runDetached(Effect.gen(function* () {
            const connection = yield* makeConnection(socket)
            yield* Queue.offer(connectionQueue, connection)
          }))
        })

        server.once('listening', () => {
          if (!settled) {
            settled = true
            resume(Effect.succeed({
              onConnection: Effect.succeed(Stream.fromQueue(connectionQueue)),
              stop: Effect.async<void>((stopResume) => {
                for (const client of server.clients) {
                  client.terminate()
                }
                server.close(() => {
                  runDetached(Queue.shutdown(connectionQueue))
                  stopResume(Effect.void)
                })
              }),
            }))
          }
        })

        server.once('error', (cause) => {
          if (!settled) {
            settled = true
            resume(Effect.fail(new NetworkError({ operation: 'start', reason: `failed to start websocket server on port ${port}`, cause })))
          }
        })
      })
    })
}
