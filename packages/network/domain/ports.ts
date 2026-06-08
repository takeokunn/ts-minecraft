import type { Effect } from 'effect'
import { Context } from 'effect'
import type { NetworkMessage } from './schemas'
import type { NetworkError } from './errors'

export type NetworkClientPortShape = {
  readonly send: (message: NetworkMessage) => Effect.Effect<void, NetworkError>
  readonly close: Effect.Effect<void>
}

export class NetworkClientPort extends Context.Tag('@minecraft/network/NetworkClientPort')<
  NetworkClientPort,
  NetworkClientPortShape
>() {}

export type NetworkServerPortShape = {
  readonly broadcast: (message: NetworkMessage) => Effect.Effect<void, NetworkError>
  readonly stop: Effect.Effect<void>
}

export class NetworkServerPort extends Context.Tag('@minecraft/network/NetworkServerPort')<
  NetworkServerPort,
  NetworkServerPortShape
>() {}
