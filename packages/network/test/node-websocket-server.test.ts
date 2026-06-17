import { describe, it } from '@effect/vitest'
import { Effect, Either, Fiber, Option, Stream } from 'effect'
import { createServer } from 'node:net'
import { WebSocket } from 'ws'
import { expect } from 'vitest'
import { NetworkError } from '../domain/errors'
import { NodeWebSocketServer } from '../infrastructure/node-websocket-server'
import type { WebSocketServerHandle } from '../domain/websocket-ports'

const toBytes = (buffer: ArrayBuffer): number[] => Array.from(new Uint8Array(buffer))

const takeNext = (stream: Stream.Stream<ArrayBuffer, never, never>): Effect.Effect<ArrayBuffer, never> =>
  Effect.gen(function* () {
    const message = yield* Stream.runHead(stream)
    return Option.getOrThrow(message)
  })

const getAvailablePort = (): Effect.Effect<number, Error> =>
  Effect.async((resume) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address === 'object' && address !== null) {
        const port = address.port
        server.close(() => resume(Effect.succeed(port)))
        return
      }
      server.close(() => resume(Effect.fail(new Error('failed to allocate test port'))))
    })
    server.once('error', (cause) => {
      resume(Effect.fail(cause))
    })
  })

const waitForOpen = (socket: WebSocket): Effect.Effect<void, Error> =>
  Effect.async((resume) => {
    socket.once('open', () => resume(Effect.void))
    socket.once('error', (cause) => resume(Effect.fail(cause)))
  })

const takeClientMessage = (socket: WebSocket): Effect.Effect<ArrayBuffer, Error> =>
  Effect.async((resume) => {
    socket.once('message', (data) => {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data as Buffer)
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      resume(Effect.succeed(buffer))
    })
    socket.once('error', (cause) => resume(Effect.fail(cause)))
  })

const waitForClose = (socket: WebSocket): Effect.Effect<void, Error> =>
  Effect.async((resume) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resume(Effect.void)
      return
    }
    socket.once('close', () => resume(Effect.void))
    socket.once('error', (cause) => resume(Effect.fail(cause)))
  })

const withServer = <A, E>(
  use: (handle: WebSocketServerHandle, port: number) => Effect.Effect<A, E>,
): Effect.Effect<A, E | Error | NetworkError> =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const port = yield* getAvailablePort()
      const handle = yield* new NodeWebSocketServer().start(port)
      return { handle, port }
    }),
    ({ handle }) => handle.stop,
  ).pipe(Effect.flatMap(({ handle, port }) => use(handle, port)), Effect.scoped)

describe('network/node-websocket-server', () => {
  it.effect('accepts clients, receives client payloads, and sends server payloads', () =>
    withServer((handle, port) =>
      Effect.gen(function* () {
        const connections = yield* handle.onConnection
        const connectionFiber = yield* Effect.fork(Stream.runHead(connections))

        const client = new WebSocket(`ws://127.0.0.1:${port}`)
        yield* waitForOpen(client)

        const connection = Option.getOrThrow(yield* Fiber.join(connectionFiber))
        expect(connection.id).toMatch(/^node-/)

        const inboundFiber = yield* Effect.fork(takeNext(connection.messages))
        client.send(Buffer.from([1, 2, 3]))
        expect(toBytes(yield* Fiber.join(inboundFiber))).toEqual([1, 2, 3])

        const clientMessage = yield* Effect.fork(takeClientMessage(client))
        yield* connection.send(new Uint8Array([4, 5]).buffer)
        expect(toBytes(yield* Fiber.join(clientMessage))).toEqual([4, 5])

        client.close()
        yield* connection.onClose
      }),
    ),
  )

  it.effect('rejects sends after a connection has closed and resolves explicit close', () =>
    withServer((handle, port) =>
      Effect.gen(function* () {
        const connections = yield* handle.onConnection
        const connectionFiber = yield* Effect.fork(Stream.runHead(connections))

        const client = new WebSocket(`ws://127.0.0.1:${port}`)
        yield* waitForOpen(client)
        const connection = Option.getOrThrow(yield* Fiber.join(connectionFiber))

        yield* connection.close
        yield* waitForClose(client)
        yield* connection.onClose
        yield* connection.close

        const sendResult = yield* Effect.either(connection.send(new ArrayBuffer(0)))
        expect(Either.isLeft(sendResult)).toBe(true)
        if (Either.isLeft(sendResult)) {
          expect(sendResult.left.reason).toContain('is not open')
        }
      }),
    ),
  )

  it.effect('wraps websocket send failures in NetworkError', () =>
    withServer((handle, port) =>
      Effect.gen(function* () {
        const connections = yield* handle.onConnection
        const connectionFiber = yield* Effect.fork(Stream.runHead(connections))

        const client = new WebSocket(`ws://127.0.0.1:${port}`)
        yield* waitForOpen(client)
        const connection = Option.getOrThrow(yield* Fiber.join(connectionFiber))

        const proto = WebSocket.prototype as unknown as { send: (...args: unknown[]) => unknown }
        const originalSend = proto.send
        proto.send = () => {
          throw new Error('socket write failed')
        }
        const sendResult = yield* Effect.either(connection.send(new ArrayBuffer(1))).pipe(
          Effect.ensuring(Effect.sync(() => {
            proto.send = originalSend
            client.close()
          })),
        )

        expect(Either.isLeft(sendResult)).toBe(true)
        if (Either.isLeft(sendResult)) {
          expect(sendResult.left).toBeInstanceOf(NetworkError)
          expect(sendResult.left.reason).toContain('failed to send message')
        }
      }),
    ),
  )

  it.effect('stops active clients and rejects ports already in use', () =>
    Effect.gen(function* () {
      const port = yield* getAvailablePort()
      const firstHandle = yield* new NodeWebSocketServer().start(port)

      const client = new WebSocket(`ws://127.0.0.1:${port}`)
      yield* waitForOpen(client)

      const secondStart = yield* Effect.either(new NodeWebSocketServer().start(port))
      expect(Either.isLeft(secondStart)).toBe(true)
      if (Either.isLeft(secondStart)) {
        expect(secondStart.left).toBeInstanceOf(NetworkError)
        expect(secondStart.left.reason).toContain('failed to start websocket server')
      }

      const closed = yield* Effect.fork(waitForClose(client))
      yield* firstHandle.stop
      yield* Fiber.join(closed)
    }),
  )
})
