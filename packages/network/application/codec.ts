import { Effect } from 'effect'
import { NetworkError } from '../domain/errors'
import { deserializeNetworkMessage, serializeNetworkMessage } from '../domain/schemas'
import type { NetworkMessage } from '../domain/schemas'
import type { WebSocketConnection } from '../infrastructure/websocket-server'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const encodeNetworkMessage = (
  message: NetworkMessage,
): Effect.Effect<ArrayBuffer, NetworkError> =>
  serializeNetworkMessage(message).pipe(
    Effect.map((serialized) => {
      const bytes = encoder.encode(serialized)
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }),
  )

export const decodeNetworkMessage = (
  raw: ArrayBuffer,
): Effect.Effect<NetworkMessage, NetworkError> =>
  deserializeNetworkMessage(decoder.decode(new Uint8Array(raw)))

export const sendEncodedToConnection = (
  connection: WebSocketConnection,
  message: NetworkMessage,
): Effect.Effect<void, NetworkError> =>
  encodeNetworkMessage(message).pipe(Effect.flatMap((encoded) => connection.send(encoded)))
