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
  Effect.gen(function* () {
    const serialized = yield* serializeNetworkMessage(message)
    const bytes = encoder.encode(serialized)
    // TextEncoder.encode returns a fresh, exactly-sized Uint8Array (byteOffset 0,
    // byteLength === buffer.byteLength per the Encoding spec), so its buffer is already
    // a standalone ArrayBuffer — the previous .slice() was a redundant full copy.
    return bytes.buffer as ArrayBuffer
  })

export const decodeNetworkMessage = (
  raw: ArrayBuffer,
): Effect.Effect<NetworkMessage, NetworkError> =>
  deserializeNetworkMessage(decoder.decode(new Uint8Array(raw)))

export const sendEncodedToConnection = (
  connection: WebSocketConnection,
  message: NetworkMessage,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    const encoded = yield* encodeNetworkMessage(message)
    yield* connection.send(encoded)
  })
