import { Effect, Stream } from 'effect'
import { NetworkError } from './errors'

export interface WebSocketClientPort {
  readonly connect: (url: string) => Effect.Effect<WebSocketClientHandle, NetworkError>
}

export interface WebSocketClientHandle {
  readonly messages: Stream.Stream<ArrayBuffer, never, never>
  readonly send: (data: ArrayBuffer) => Effect.Effect<void, NetworkError>
  readonly onClose: Effect.Effect<void, never>
  readonly close: Effect.Effect<void, never>
}

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
