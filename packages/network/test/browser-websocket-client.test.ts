import { describe, it } from '@effect/vitest'
import { Effect, Either, Fiber, Option, Stream } from 'effect'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { NetworkError } from '../domain/errors'
import { BrowserWebSocketClient } from '../infrastructure/browser-websocket-client'
import type { WebSocketClientHandle } from '../domain/websocket-ports'

type SocketEventHandler = ((event: Event) => void) | null
type SocketMessageHandler = ((event: MessageEvent) => void) | null

class FakeBrowserSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeBrowserSocket[] = []
  static constructError: unknown = null

  binaryType: BinaryType = 'blob'
  readyState = FakeBrowserSocket.CONNECTING
  onopen: SocketEventHandler = null
  onmessage: SocketMessageHandler = null
  onerror: SocketEventHandler = null
  onclose: SocketEventHandler = null
  sent: ArrayBuffer[] = []
  closeCalls = 0

  constructor(readonly url: string) {
    if (FakeBrowserSocket.constructError) {
      throw FakeBrowserSocket.constructError
    }
    FakeBrowserSocket.instances.push(this)
  }

  static reset = (): void => {
    FakeBrowserSocket.instances = []
    FakeBrowserSocket.constructError = null
  }

  send = (data: ArrayBuffer): void => {
    this.sent.push(data)
  }

  close = (): void => {
    this.closeCalls += 1
    this.readyState = FakeBrowserSocket.CLOSED
    this.onclose?.(new Event('close'))
  }

  open = (): void => {
    this.readyState = FakeBrowserSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  message = (data: MessageEvent['data']): void => {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  error = (): void => {
    this.onerror?.(new Event('error'))
  }
}

const takeNext = (stream: Stream.Stream<ArrayBuffer, never, never>): Effect.Effect<ArrayBuffer, never> =>
  Effect.gen(function* () {
    const message = yield* Stream.runHead(stream)
    return Option.getOrThrow(message)
  })

const connectOpened = (): Effect.Effect<{
  readonly handle: WebSocketClientHandle
  readonly socket: FakeBrowserSocket
}, NetworkError> =>
  Effect.gen(function* () {
    const connectFiber = yield* Effect.fork(new BrowserWebSocketClient().connect('ws://test.local'))
    yield* Effect.yieldNow()
    const socket = FakeBrowserSocket.instances[0]!
    socket.open()
    const handle = yield* Fiber.join(connectFiber)
    return { handle, socket }
  })

describe('network/browser-websocket-client', () => {
  beforeEach(() => {
    FakeBrowserSocket.reset()
    vi.stubGlobal('WebSocket', FakeBrowserSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.effect('connects after open and normalizes received payloads', () =>
    Effect.gen(function* () {
      const { handle, socket } = yield* connectOpened()

      expect(socket.url).toBe('ws://test.local')
      expect(socket.binaryType).toBe('arraybuffer')

      const arrayBufferFiber = yield* Effect.fork(takeNext(handle.messages))
      const payload = new Uint8Array([1, 2, 3]).buffer
      socket.message(payload)
      expect(Array.from(new Uint8Array(yield* Fiber.join(arrayBufferFiber)))).toEqual([1, 2, 3])

      const stringFiber = yield* Effect.fork(takeNext(handle.messages))
      socket.message('hello')
      expect(new TextDecoder().decode(yield* Fiber.join(stringFiber))).toBe('hello')

      const blobFiber = yield* Effect.fork(takeNext(handle.messages))
      socket.message(new Blob([new Uint8Array([4, 5])]))
      expect(Array.from(new Uint8Array(yield* Fiber.join(blobFiber)))).toEqual([4, 5])

      const sent = new Uint8Array([9]).buffer
      yield* handle.send(sent)
      expect(socket.sent).toEqual([sent])
    }),
  )

  it.effect('fails connect when the socket constructor or initial handshake fails', () =>
    Effect.gen(function* () {
      FakeBrowserSocket.constructError = new Error('constructor failed')
      const constructorResult = yield* Effect.either(new BrowserWebSocketClient().connect('ws://broken.local'))
      expect(Either.isLeft(constructorResult)).toBe(true)
      if (Either.isLeft(constructorResult)) {
        expect(constructorResult.left).toBeInstanceOf(NetworkError)
        expect(constructorResult.left.reason).toContain('failed to create websocket')
      }

      FakeBrowserSocket.constructError = null
      const handshakeFiber = yield* Effect.fork(Effect.either(new BrowserWebSocketClient().connect('ws://fail.local')))
      yield* Effect.yieldNow()
      const socket = FakeBrowserSocket.instances[0]!
      socket.error()
      const handshakeResult = yield* Fiber.join(handshakeFiber)
      expect(Either.isLeft(handshakeResult)).toBe(true)
      if (Either.isLeft(handshakeResult)) {
        expect(handshakeResult.left).toBeInstanceOf(NetworkError)
        expect(handshakeResult.left.reason).toContain('websocket error while connecting')
      }
    }),
  )

  it.effect('rejects sends while closed and resolves onClose from closed state', () =>
    Effect.gen(function* () {
      const { handle, socket } = yield* connectOpened()

      socket.readyState = FakeBrowserSocket.CLOSED
      const sendResult = yield* Effect.either(handle.send(new ArrayBuffer(0)))
      expect(Either.isLeft(sendResult)).toBe(true)
      if (Either.isLeft(sendResult)) {
        expect(sendResult.left.reason).toBe('websocket is not open')
      }

      yield* handle.close
      yield* handle.onClose
      expect(socket.closeCalls).toBe(0)
    }),
  )

  it.effect('closes open sockets and drops unsupported inbound payloads', () =>
    Effect.gen(function* () {
      const { handle, socket } = yield* connectOpened()

      const nextMessage = yield* Effect.fork(takeNext(handle.messages))
      socket.message({ unexpected: true })
      socket.message('ok')
      expect(new TextDecoder().decode(yield* Fiber.join(nextMessage))).toBe('ok')

      yield* handle.close
      yield* handle.onClose
      expect(socket.closeCalls).toBe(1)
      expect(socket.readyState).toBe(FakeBrowserSocket.CLOSED)
    }),
  )
})
